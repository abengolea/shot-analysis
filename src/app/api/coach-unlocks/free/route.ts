import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAppBaseUrl } from '@/lib/app-url';
import { buildConversationId, getMessageType } from '@/lib/message-utils';

export const dynamic = 'force-dynamic';

async function requirePlayerOrAdmin(req: NextRequest): Promise<{ ok: true; uid: string; role: 'player' | 'admin' } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const coachRole = coachSnap.exists ? (coachSnap.data() as any)?.role : undefined;
    const playerRole = playerSnap.exists ? (playerSnap.data() as any)?.role : undefined;
    if (coachRole === 'admin' || playerRole === 'admin') return { ok: true, uid, role: 'admin' };
    if (playerSnap.exists || playerRole === 'player') return { ok: true, uid, role: 'player' };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePlayerOrAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    if (!adminDb) return NextResponse.json({ ok: false, error: 'Admin SDK no inicializado' }, { status: 500 });
    const body = await req.json();
    const analysisId = String(body?.analysisId || '');
    const coachId = String(body?.coachId || '');
    if (!analysisId || !coachId) {
      return NextResponse.json({ ok: false, error: 'analysisId y coachId son requeridos' }, { status: 400 });
    }

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
    const coachName = coachSnap.exists ? String((coachSnap.data() as any)?.name || '') : '';
    let freeLeft = 0;
    let playerId = '';
    let playerName = '';
    let analysisShotType = '';

    await adminDb.runTransaction(async (tx: any) => {
      const analysisSnap = await tx.get(analysisRef);
      if (!analysisSnap.exists) {
        throw new Error('ANALYSIS_NOT_FOUND');
      }
      const analysisData = analysisSnap.data() as any;
      const ownerId = String(analysisData?.playerId || analysisData?.userId || '');
      playerId = ownerId;
      playerName = String(analysisData?.playerName || '');
      analysisShotType = String(analysisData?.shotType || '');
      if (auth.role !== 'admin' && ownerId !== auth.uid) {
        throw new Error('FORBIDDEN');
      }
      const coachAccess = (analysisData?.coachAccess || {}) as Record<string, any>;
      const existing = coachAccess[coachId];
      if (existing?.status === 'paid') {
        throw new Error('ALREADY_PAID');
      }
      if (existing?.status === 'pending') {
        throw new Error('PENDING_PAYMENT');
      }

      const walletUserId = ownerId || auth.uid;
      const walletRef = adminDb.collection('wallets').doc(walletUserId);
      const walletSnap = await tx.get(walletRef);
      const walletData = walletSnap.exists ? (walletSnap.data() as any) : {};
      const currentFree = Number(walletData?.freeCoachReviews || 0);
      if (currentFree <= 0) {
        throw new Error('NO_FREE_CREDITS');
      }

      const nowIso = new Date().toISOString();
      freeLeft = currentFree - 1;
      tx.set(walletRef, { freeCoachReviews: freeLeft, updatedAt: nowIso }, { merge: true });
      tx.set(analysisRef, {
        coachAccess: {
          [coachId]: {
            status: 'paid',
            source: 'free_credit',
            coachId,
            coachName,
            unlockedBy: auth.uid,
            createdAt: nowIso,
            updatedAt: nowIso,
          }
        },
        updatedAt: nowIso,
      }, { merge: true });
      const unlockRef = adminDb.collection('coach_unlocks').doc();
      tx.set(unlockRef, {
        analysisId,
        coachId,
        coachName,
        userId: walletUserId,
        status: 'paid',
        source: 'free_credit',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });

    try {
      const [coachDoc, playerDoc] = await Promise.all([
        adminDb.collection('coaches').doc(coachId).get(),
        playerId ? adminDb.collection('players').doc(playerId).get() : Promise.resolve(null as any),
      ]);
      const coachData = coachDoc?.exists ? (coachDoc.data() as any) : null;
      const playerData = playerDoc?.exists ? (playerDoc.data() as any) : null;
      const resolvedPlayerName = playerName || playerData?.name || playerId || 'Jugador';
      const resolvedCoachName = coachName || coachData?.name || coachId || 'Entrenador';
      const appBaseUrl = getAppBaseUrl();
      const analysisUrl = appBaseUrl ? `${appBaseUrl}/analysis/${analysisId}` : '';
      const analysisLabel = analysisShotType ? ` (${analysisShotType})` : '';

      await adminDb.collection('messages').add({
        fromId: 'system',
        fromName: 'Chaaaas.com',
        toId: coachId,
        toCoachDocId: coachId,
        toName: resolvedCoachName,
        text: `El jugador ${resolvedPlayerName} usó una revisión gratis para este análisis${analysisLabel}. Podés ingresar y dejar tu devolución.${analysisUrl ? `\n\nLink al análisis: ${analysisUrl}` : ''}`,
        analysisId,
        createdAt: new Date().toISOString(),
        read: false,
        messageType: getMessageType({ fromId: 'system', analysisId }),
        conversationId: buildConversationId({ fromId: 'system', toId: coachId, analysisId }),
      });

      if (playerId) {
        await adminDb.collection('messages').add({
          fromId: 'system',
          fromName: 'Chaaaas.com',
          toId: playerId,
          toName: resolvedPlayerName,
          text: 'Tu revisión gratis fue activada correctamente. El entrenador ya puede ver tu análisis y pronto dejará su devolución.',
          analysisId,
          createdAt: new Date().toISOString(),
          read: false,
          messageType: getMessageType({ fromId: 'system', analysisId }),
          conversationId: buildConversationId({ fromId: 'system', toId: playerId, analysisId }),
        });
      }
    } catch (e) {
      console.error('Error notificando revisión gratis:', e);
    }

    return NextResponse.json({ ok: true, freeCoachReviewsLeft: freeLeft });
  } catch (e: any) {
    const code = String(e?.message || '');
    if (code === 'ANALYSIS_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Análisis no encontrado' }, { status: 404 });
    }
    if (code === 'FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    }
    if (code === 'ALREADY_PAID') {
      return NextResponse.json({ ok: false, error: 'El análisis ya está desbloqueado para este entrenador.' }, { status: 409 });
    }
    if (code === 'PENDING_PAYMENT') {
      return NextResponse.json({ ok: false, error: 'Ya hay un pago pendiente para este entrenador.' }, { status: 409 });
    }
    if (code === 'NO_FREE_CREDITS') {
      return NextResponse.json({ ok: false, error: 'No tenés revisiones de coach gratis disponibles.' }, { status: 400 });
    }
    console.error('coach-unlocks/free error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
