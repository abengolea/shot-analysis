import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const playerId = decoded.uid;

    const body = await req.json();
    const analysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : '';
    const coachId = typeof body?.coachId === 'string' ? body.coachId.trim() : '';
    const ratingRaw = body?.rating;
    const commentRaw = typeof body?.comment === 'string' ? body.comment.trim() : '';
    const rating = Number(ratingRaw);

    if (!analysisId || !coachId) {
      return NextResponse.json({ error: 'analysisId y coachId son requeridos.' }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating debe ser un entero entre 1 y 5.' }, { status: 400 });
    }
    if (commentRaw.length > 2000) {
      return NextResponse.json({ error: 'El comentario es demasiado largo.' }, { status: 400 });
    }

    const analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisDoc.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado.' }, { status: 404 });
    }
    const analysisData = analysisDoc.data() as any;
    if (String(analysisData.playerId) !== String(playerId)) {
      return NextResponse.json({ error: 'No autorizado para este análisis.' }, { status: 403 });
    }

    const unlockId = `${analysisId}__${coachId}`;
    const unlockDoc = await adminDb.collection('coach_unlocks').doc(unlockId).get();
    const unlockData = unlockDoc.exists ? (unlockDoc.data() as any) : null;
    const coachAccess = analysisData?.coachAccess?.[coachId] as any | undefined;
    const isPaid = unlockData?.status === 'paid' || coachAccess?.status === 'paid';

    if (!isPaid) {
      return NextResponse.json({ error: 'La evaluación del entrenador aún no está habilitada.' }, { status: 403 });
    }

    let isCoachFeedbackReady = false;
    try {
      const feedbackSnapshot = await adminDb
        .collection('analyses')
        .doc(analysisId)
        .collection('coach_feedback')
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();
      if (!feedbackSnapshot.empty) {
        const feedbackData = feedbackSnapshot.docs[0].data();
        isCoachFeedbackReady = feedbackData && (
          (feedbackData.items && typeof feedbackData.items === 'object' && Object.keys(feedbackData.items).length > 0) ||
          (feedbackData.coachSummary && String(feedbackData.coachSummary).trim().length > 0)
        );
      }
    } catch (e) {
      console.error('Error verificando coach feedback para reseña:', e);
    }

    if (!isCoachFeedbackReady) {
      const requestDate =
        toDate(unlockData?.createdAt) ||
        toDate(coachAccess?.unlockedAt) ||
        null;

      if (!requestDate) {
        return NextResponse.json({ error: 'No se pudo determinar la fecha de solicitud.' }, { status: 400 });
      }

      const now = Date.now();
      const eligibleAt = requestDate.getTime() + REVIEW_WINDOW_MS;
      if (now < eligibleAt) {
        return NextResponse.json(
          { error: 'Aún no se cumplen 7 días desde la solicitud.', eligibleAt: new Date(eligibleAt).toISOString() },
          { status: 403 }
        );
      }
    }

    const reviewId = `${analysisId}__${coachId}__${playerId}`;
    const reviewRef = adminDb.collection('coach_reviews').doc(reviewId);
    const coachRef = adminDb.collection('coaches').doc(coachId);
    const nowIso = new Date().toISOString();

    await adminDb.runTransaction(async (tx) => {
      const reviewSnap = await tx.get(reviewRef);
      if (reviewSnap.exists) {
        throw new Error('REVIEW_EXISTS');
      }
      const coachSnap = await tx.get(coachRef);
      if (!coachSnap.exists) {
        throw new Error('COACH_NOT_FOUND');
      }
      const coachData = coachSnap.data() as any;
      const prevReviews = Number(coachData?.reviews || 0);
      const prevRating = Number(coachData?.rating || 0);
      const nextReviews = prevReviews + 1;
      const nextRating = prevReviews > 0
        ? (prevRating * prevReviews + rating) / nextReviews
        : rating;

      tx.set(reviewRef, {
        analysisId,
        coachId,
        playerId,
        coachName: coachData?.name || '',
        playerName: analysisData?.playerName || '',
        rating,
        comment: commentRaw || '',
        hidden: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      tx.set(coachRef, {
        rating: Number(nextRating.toFixed(2)),
        reviews: nextReviews,
        updatedAt: nowIso,
      }, { merge: true });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.message === 'REVIEW_EXISTS') {
      return NextResponse.json({ error: 'Ya dejaste una reseña para este entrenador.' }, { status: 409 });
    }
    if (e?.message === 'COACH_NOT_FOUND') {
      return NextResponse.json({ error: 'Entrenador no encontrado.' }, { status: 404 });
    }
    console.error('Error creando reseña de entrenador:', e);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
