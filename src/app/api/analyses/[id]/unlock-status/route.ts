import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: analysisId } = await params;
    if (!analysisId) {
      return NextResponse.json({ error: 'ID de análisis es requerido' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const coachData = coachSnap.exists ? (coachSnap.data() as any) : null;
    const playerData = playerSnap.exists ? (playerSnap.data() as any) : null;
    const role = coachData?.role || playerData?.role;
    if (!coachSnap.exists && !playerSnap.exists) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 403 });
    }

    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }

    const analysisData = analysisSnap.data() as any;
    const analysisPlayerId = analysisData?.playerId;
    const coachAccess = analysisData?.coachAccess || {};
    const coachAccessForUser = coachAccess?.[uid];

    const isAdmin = role === 'admin';
    const isOwnerPlayer = playerSnap.exists && analysisPlayerId && String(analysisPlayerId) === String(uid);
    const hasPaidCoachAccess = coachSnap.exists && coachAccessForUser?.status === 'paid';
    if (!isAdmin && !isOwnerPlayer && !hasPaidCoachAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const unlockSnapshot = await adminDb.collection('coach_unlocks')
      .where('analysisId', '==', analysisId)
      .where('playerId', '==', analysisPlayerId)
      .get();

    const unlocks: Array<{
      id: string;
      coachId: string;
      coachName: string;
      status: string;
      paymentProvider?: string | null;
      preferenceId?: string | null;
      paymentId?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }> = [];

    const coachIdsSet = new Set<string>();
    for (const doc of unlockSnapshot.docs) {
      const unlockData = doc.data() as any;
      unlocks.push({
        id: doc.id,
        coachId: unlockData.coachId,
        coachName: unlockData.coachName || '',
        status: unlockData.status || 'pending',
        paymentProvider: unlockData.paymentProvider || null,
        preferenceId: unlockData.preferenceId || null,
        paymentId: unlockData.paymentId || null,
        createdAt: unlockData.createdAt || null,
        updatedAt: unlockData.updatedAt || null,
      });
      if (unlockData.coachId) coachIdsSet.add(unlockData.coachId);
    }

    for (const coachId of Object.keys(coachAccess)) {
      coachIdsSet.add(coachId);
    }

    const coachNames: Record<string, string> = {};
    if (coachIdsSet.size > 0) {
      const coachDocs = await Promise.all(
        Array.from(coachIdsSet).map((coachId) => adminDb.collection('coaches').doc(coachId).get())
      );
      const coachIds = Array.from(coachIdsSet);
      for (let i = 0; i < coachDocs.length; i++) {
        const doc = coachDocs[i];
        if (doc.exists) {
          const coachInfo = doc.data() as any;
          coachNames[coachIds[i]] = coachInfo?.name || 'Entrenador';
        }
      }
    }

    const paidCoachIds: string[] = [];
    const pendingCoachIds: string[] = [];

    for (const unlock of unlocks) {
      if (unlock.status === 'paid') {
        paidCoachIds.push(unlock.coachId);
        continue;
      }
      if (unlock.paymentId) {
        const paymentSnap = await adminDb.collection('payments').doc(unlock.paymentId).get();
        if (paymentSnap.exists) {
          const paymentData = paymentSnap.data() as any;
          if (paymentData?.status === 'approved' || paymentData?.status === 'paid') {
            paidCoachIds.push(unlock.coachId);
          }
        }
      }
    }

    for (const [coachId, access] of Object.entries(coachAccess)) {
      const accessData = access as any;
      if (accessData.status === 'paid') {
        if (!paidCoachIds.includes(coachId)) {
          paidCoachIds.push(coachId);
        }
      }
    }

    for (const unlock of unlocks) {
      if (unlock.status === 'pending' && !paidCoachIds.includes(unlock.coachId)) {
        pendingCoachIds.push(unlock.coachId);
      }
    }

    let hasCoachFeedback = false;
    const feedbackSnapshot = await adminDb.collection('analyses')
      .doc(analysisId)
      .collection('coach_feedback')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    if (!feedbackSnapshot.empty) {
      const feedbackData = feedbackSnapshot.docs[0].data() as any;
      hasCoachFeedback = Boolean(
        (feedbackData?.items && typeof feedbackData.items === 'object' && Object.keys(feedbackData.items).length > 0) ||
        (feedbackData?.coachSummary && String(feedbackData.coachSummary).trim().length > 0)
      );
    }

    const hasPaidUnlock = paidCoachIds.length > 0;
    const hasPendingUnlock = pendingCoachIds.length > 0;
    const status: 'none' | 'pending_payment' | 'paid_pending_review' | 'reviewed' =
      hasCoachFeedback
        ? 'reviewed'
        : hasPaidUnlock
          ? 'paid_pending_review'
          : hasPendingUnlock
            ? 'pending_payment'
            : 'none';

    return NextResponse.json({
      status,
      hasCoachFeedback,
      paidCoachIds: paidCoachIds.map((id) => ({
        coachId: id,
        coachName: coachNames[id] || 'Entrenador',
      })),
      pendingCoachIds: pendingCoachIds.map((id) => ({
        coachId: id,
        coachName: coachNames[id] || 'Entrenador',
      })),
      unlocks,
    });
  } catch (error) {
    console.error('Error en unlock-status:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
