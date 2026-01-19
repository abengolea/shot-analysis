import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { fetchDlocalPayment } from '@/lib/dlocal';
import { processCoachReviewPayment } from '@/lib/mercadopago';

const APPROVED_STATUSES = new Set(['paid', 'approved', 'success', 'completed', 'succeeded']);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const paymentId = typeof body?.paymentId === 'string' ? body.paymentId.trim() : '';
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const fallbackAnalysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : '';
    if (!paymentId && !orderId) {
      return NextResponse.json({ error: 'paymentId u orderId requerido' }, { status: 400 });
    }

    const payment = await fetchDlocalPayment(paymentId || orderId);
    const statusRaw = String(payment?.status || '').toLowerCase();
    const approved = APPROVED_STATUSES.has(statusRaw);

    const metadata = payment?.metadata || {};
    const productId = metadata?.productId as string | undefined;
    const analysisId = (metadata?.analysisId as string | undefined) || fallbackAnalysisId || undefined;
    const coachId = metadata?.coachId as string | undefined;
    const unlockId = metadata?.unlockId as string | undefined;
    const playerId = (metadata?.playerId as string | undefined) || (metadata?.userId as string | undefined);

    if (playerId && decoded?.uid && String(playerId) !== String(decoded.uid)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const providerPaymentId = String(
      payment?.id || payment?.payment_id || payment?.order_id || orderId || paymentId
    );
    const nowIso = new Date().toISOString();

    if (adminDb) {
      await adminDb.collection('payments').doc(providerPaymentId).set(
        {
          provider: 'dlocal',
          providerPaymentId,
          productId: productId || 'coach_review',
          amount: payment?.amount,
          currency: payment?.currency || 'ARS',
          status: statusRaw || payment?.status || 'unknown',
          raw: payment,
          updatedAt: nowIso,
          createdAt: nowIso,
          ...(playerId ? { userId: playerId } : {}),
          ...(coachId ? { coachId } : {}),
          ...(analysisId ? { analysisId } : {}),
        },
        { merge: true }
      );
    }

    let alreadyProcessed = false;
    if (approved && adminDb && (unlockId || (analysisId && coachId))) {
      if (unlockId) {
        const unlockSnap = await adminDb.collection('coach_unlocks').doc(unlockId).get();
        if (unlockSnap.exists && unlockSnap.data()?.status === 'paid') {
          alreadyProcessed = true;
        }
      }
      if (!alreadyProcessed && analysisId && coachId) {
        const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
        const coachAccess = analysisSnap.exists ? (analysisSnap.data() as any)?.coachAccess?.[coachId] : null;
        if (coachAccess?.status === 'paid') {
          alreadyProcessed = true;
        }
      }
    }

    if (approved && productId === 'coach_review' && !alreadyProcessed) {
      await processCoachReviewPayment({
        payment,
        analysisId,
        coachId,
        unlockId,
        playerId: playerId || decoded?.uid,
      });
    }

    return NextResponse.json({
      success: approved,
      status: statusRaw || payment?.status,
      alreadyProcessed,
    });
  } catch (err: any) {
    console.error('check-dlocal-payment error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error interno' }, { status: 500 });
  }
}
