import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'admin') return { ok: true, uid, role: 'admin' };
    if (role === 'player') return { ok: true, uid, role: 'player' };
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

    await adminDb.runTransaction(async (tx: any) => {
      const analysisSnap = await tx.get(analysisRef);
      if (!analysisSnap.exists) {
        throw new Error('ANALYSIS_NOT_FOUND');
      }
      const analysisData = analysisSnap.data() as any;
      const ownerId = String(analysisData?.playerId || analysisData?.userId || '');
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
