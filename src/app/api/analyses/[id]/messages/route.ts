import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAppBaseUrl } from '@/lib/app-url';
import { hasPaidCoachAccessToPlayer } from '@/lib/coach-access';
import { buildConversationId, getMessageType } from '@/lib/message-utils';
import { sendCustomEmail } from '@/lib/email-service';
import { coachMessageTemplate } from '@/lib/email/templates/coach-message';
import { playerReplyToCoachTemplate } from '@/lib/email/templates/player-reply-to-coach';

/**
 * POST: enviar mensaje en la conversación del análisis (coach ↔ jugador).
 * Escribe en Firestore; si el remitente es el coach envía email al jugador; si es el jugador envía email al coach.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: analysisId } = await params;
    if (!analysisId) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await request.json().catch(() => ({}));
    const text = String(body?.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'text requerido' }, { status: 400 });

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    const analysis = analysisSnap.data() as any;
    const playerId = analysis?.playerId;
    const coachId = analysis?.coachId;
    if (!playerId) return NextResponse.json({ error: 'Análisis sin jugador' }, { status: 400 });

    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const isCoach = coachSnap.exists;
    const isPlayer = playerSnap.exists;
    const isAdmin = (decoded as any).claims?.admin === true;

    const coachAccess = analysis?.coachAccess || {};
    const access = coachAccess?.[uid];
    const hasAccess =
      isAdmin ||
      String(coachId) === String(uid) ||
      access?.status === 'paid' ||
      (await hasPaidCoachAccessToPlayer({ adminDb, coachId: uid, playerId: String(playerId) }));
    let assignedCoachMatch = false;
    try {
      const playerDoc = await adminDb.collection('players').doc(playerId).get();
      const p = playerDoc.exists ? (playerDoc.data() as any) : null;
      assignedCoachMatch = p?.coachId === uid;
    } catch {}
    const canSendAsCoach = isCoach && (hasAccess || assignedCoachMatch);
    const canSendAsPlayer = isPlayer && String(playerId) === String(uid);
    if (!canSendAsCoach && !canSendAsPlayer) {
      return NextResponse.json({ error: 'No autorizado para enviar en este análisis' }, { status: 403 });
    }

    const fromName = isCoach
      ? (coachSnap.data() as any)?.name || 'Entrenador'
      : (playerSnap.data() as any)?.name || (decoded as any).name || 'Jugador';
    const toId = isCoach ? playerId : coachId;
    if (!toId) return NextResponse.json({ error: 'Sin destinatario' }, { status: 400 });

    let toName = '';
    if (isCoach) {
      const targetPlayerSnap = await adminDb.collection('players').doc(playerId).get();
      const p = targetPlayerSnap.exists ? (targetPlayerSnap.data() as any) : null;
      toName = p?.name || p?.fullName || playerId;
    } else {
      const c = coachSnap.exists ? (coachSnap.data() as any) : null;
      toName = c?.name || 'Entrenador';
    }

    const nowIso = new Date().toISOString();
    const fromAvatarUrl = isCoach
      ? (coachSnap.data() as any)?.avatarUrl || ''
      : (playerSnap.data() as any)?.avatarUrl || '';
    const payload: any = {
      fromId: uid,
      fromName,
      fromAvatarUrl: fromAvatarUrl || undefined,
      toId,
      toName,
      text,
      analysisId,
      createdAt: nowIso,
      read: false,
      messageType: getMessageType({ fromId: uid, analysisId }),
      conversationId: buildConversationId({ fromId: uid, toId, analysisId }),
    };
    if (isCoach) payload.toCoachDocId = coachId;

    const docRef = await adminDb.collection('messages').add(payload);

    if (isCoach) {
      let playerEmail = '';
      try {
        const userRecord = await adminAuth.getUser(playerId);
        playerEmail = userRecord.email?.trim() || '';
      } catch {}
      if (!playerEmail) {
        try {
          const pData = (await adminDb.collection('players').doc(playerId).get()).data() as any;
          if (pData?.email) playerEmail = String(pData.email).trim();
        } catch {}
      }
      if (playerEmail) {
        const baseUrl = getAppBaseUrl({ requestOrigin: request.nextUrl?.origin });
        const conversationUrl = baseUrl ? `${baseUrl}/analysis/${analysisId}#messages` : '';
        try {
          const { html, text: textPlain } = coachMessageTemplate({
            playerName: toName || undefined,
            coachName: fromName,
            messageText: text,
            conversationUrl,
            siteUrl: baseUrl,
          });
          await sendCustomEmail({
            to: playerEmail,
            subject: 'Tu entrenador te escribió en tu análisis',
            html,
            text: textPlain,
          });
        } catch (emailErr) {
          console.warn('⚠️ Email al jugador (messages):', emailErr);
        }
      }
    } else if (isPlayer) {
      let coachEmail = '';
      try {
        const userRecord = await adminAuth.getUser(coachId);
        coachEmail = userRecord.email?.trim() || '';
      } catch {}
      if (!coachEmail) {
        try {
          const coachDoc = await adminDb.collection('coaches').doc(coachId).get();
          const cData = coachDoc.exists ? (coachDoc.data() as any) : null;
          if (cData?.email) coachEmail = String(cData.email).trim();
        } catch {}
      }
      if (coachEmail) {
        const baseUrl = getAppBaseUrl({ requestOrigin: request.nextUrl?.origin });
        const conversationUrl = baseUrl ? `${baseUrl}/analysis/${analysisId}#messages` : '';
        try {
          const { html, text: textPlain } = playerReplyToCoachTemplate({
            coachName: toName || undefined,
            playerName: fromName,
            messageText: text,
            conversationUrl,
            siteUrl: baseUrl,
          });
          await sendCustomEmail({
            to: coachEmail,
            subject: `${fromName} te respondió en el análisis`,
            html,
            text: textPlain,
          });
        } catch (emailErr) {
          console.warn('⚠️ Email al coach (messages):', emailErr);
        }
      }
    }

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e: any) {
    console.error('POST analyses/[id]/messages error', e);
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}
