import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAppBaseUrl } from '@/lib/app-url';
import { sendCustomEmail } from '@/lib/email-service';
import { buildConversationId, getMessageType } from '@/lib/message-utils';

const REMINDER_DAYS = 5;

async function requireAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value?._seconds === 'number') {
    return new Date(value._seconds * 1000 + Math.round((value._nanoseconds || 0) / 1e6));
  }
  return null;
};

const hasCoachFeedback = (data: any): boolean => {
  if (!data) return false;
  const hasItems = data.items && typeof data.items === 'object' && Object.keys(data.items).length > 0;
  const hasSummary = typeof data.coachSummary === 'string' && data.coachSummary.trim().length > 0;
  return Boolean(hasItems || hasSummary);
};

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ ok: false, error: 'DB no inicializada' }, { status: 500 });
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);
    const limit = Math.max(1, Math.min(200, Number(body?.limit || 50)));

    const cutoff = new Date(Date.now() - REMINDER_DAYS * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();

    const querySnap = await adminDb
      .collection('coach_unlocks')
      .where('status', '==', 'paid')
      .where('paidAt', '<=', cutoffIso)
      .limit(limit)
      .get();

    const results = {
      scanned: querySnap.size,
      reminded: 0,
      skippedAlreadyReminded: 0,
      skippedFeedbackExists: 0,
      skippedMissingData: 0,
      dryRun,
    };

    const appBaseUrl = getAppBaseUrl({ requestOrigin: req.nextUrl.origin });

    for (const doc of querySnap.docs) {
      const data = doc.data() as any;
      if (data?.reviewReminderSentAt) {
        results.skippedAlreadyReminded += 1;
        continue;
      }

      const analysisId = String(data?.analysisId || '').trim();
      const coachId = String(data?.coachId || '').trim();
      const playerId = String(data?.playerId || '').trim();
      if (!analysisId || !coachId || !playerId) {
        results.skippedMissingData += 1;
        continue;
      }

      const paidDate = toDate(data?.paidAt) || toDate(data?.updatedAt) || toDate(data?.createdAt);
      if (!paidDate || paidDate > cutoff) {
        results.skippedMissingData += 1;
        continue;
      }

      const feedbackSnap = await adminDb
        .collection('analyses')
        .doc(analysisId)
        .collection('coach_feedback')
        .doc(coachId)
        .get();
      if (feedbackSnap.exists && hasCoachFeedback(feedbackSnap.data())) {
        results.skippedFeedbackExists += 1;
        continue;
      }

      const [coachSnap, playerSnap] = await Promise.all([
        adminDb.collection('coaches').doc(coachId).get(),
        adminDb.collection('players').doc(playerId).get(),
      ]);
      const coachData = coachSnap.exists ? (coachSnap.data() as any) : null;
      const playerData = playerSnap.exists ? (playerSnap.data() as any) : null;
      const analysisUrl = appBaseUrl && analysisId ? `${appBaseUrl}/analysis/${analysisId}` : '';

      const reminderText = `Pasaron ${REMINDER_DAYS} días desde que se abonó la revisión del lanzamiento ${analysisId}. Por favor, ingresá y dejá tu devolución.${analysisUrl ? `\n\nLink al análisis: ${analysisUrl}` : ''}`;

      let messageId = '';
      let emailSentAt = '';
      if (!dryRun) {
        const msgRef = await adminDb.collection('messages').add({
          fromId: 'system',
          fromName: 'Chaaaas.com',
          toId: coachId,
          toCoachDocId: coachId,
          toName: coachData?.name || coachId,
          text: reminderText,
          analysisId,
          createdAt: new Date().toISOString(),
          read: false,
          messageType: getMessageType({ fromId: 'system', analysisId }),
          conversationId: buildConversationId({
            fromId: 'system',
            toId: coachId,
            analysisId,
          }),
        });
        messageId = msgRef.id;

        if (coachData?.email) {
          const emailOk = await sendCustomEmail({
            to: coachData.email,
            subject: 'Recordatorio: devolución pendiente',
            html: `<p>Hola ${coachData?.name || ''},</p>
              <p>Pasaron ${REMINDER_DAYS} días desde que se abonó la revisión del lanzamiento ${analysisId}.</p>
              <p>Por favor, ingresá y dejá tu devolución.</p>
              ${analysisUrl ? `<p>Link al análisis: <a href="${analysisUrl}">${analysisUrl}</a></p>` : ''}
              <p>Equipo Shot Analysis</p>`,
          });
          if (emailOk) emailSentAt = new Date().toISOString();
        }

        await doc.ref.set(
          {
            reviewReminderSentAt: new Date().toISOString(),
            reviewReminderMessageId: messageId || null,
            ...(emailSentAt ? { reviewReminderEmailSentAt: emailSentAt } : {}),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      results.reminded += 1;
    }

    return NextResponse.json({ ok: true, results });
  } catch (error: any) {
    console.error('coach reminders job error', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Error interno' }, { status: 500 });
  }
}
