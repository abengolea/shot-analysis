import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const playerId = decoded.uid;

    const body = await req.json();
    const analysisId = String(body?.analysisId || '').trim();
    const coachId = String(body?.coachId || '').trim();
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';

    if (!analysisId || !coachId || !Number.isFinite(rating)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'La calificación debe ser entre 1 y 5' }, { status: 400 });
    }

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }
    const analysis = analysisSnap.data() as any;
    if (String(analysis?.playerId || '') !== String(playerId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const coachAccess = analysis?.coachAccess || {};
    const coachAccessData = coachAccess[coachId];
    const coachHasAccess = Boolean(analysis?.coachId && String(analysis.coachId) === String(coachId))
      || (coachAccessData && coachAccessData.status === 'paid');

    if (!coachHasAccess) {
      return NextResponse.json({ error: 'El entrenador no corresponde al análisis' }, { status: 400 });
    }

    const feedbackSnap = await adminDb
      .collection('analyses')
      .doc(analysisId)
      .collection('coach_feedback')
      .doc(coachId)
      .get();

    const hasCoachFeedback = feedbackSnap.exists;
    const isCoachCompleted = analysis?.coachCompleted === true;
    if (!hasCoachFeedback && !isCoachCompleted) {
      return NextResponse.json({ error: 'Aún no hay devolución del entrenador' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const reviewId = `${analysisId}_${playerId}_${coachId}`;
    const reviewRef = adminDb.collection('coach_reviews').doc(reviewId);
    const prevReview = await reviewRef.get();
    const createdAt = prevReview.exists ? (prevReview.data() as any)?.createdAt || nowIso : nowIso;

    await reviewRef.set({
      analysisId,
      coachId,
      playerId,
      rating,
      comment,
      createdAt,
      updatedAt: nowIso,
    }, { merge: true });

    // Recalcular rating promedio del coach
    const reviewsSnap = await adminDb.collection('coach_reviews').where('coachId', '==', coachId).get();
    let count = 0;
    let sum = 0;
    reviewsSnap.docs.forEach((doc) => {
      const data = doc.data() as any;
      const r = Number(data?.rating);
      if (Number.isFinite(r)) {
        count += 1;
        sum += r;
      }
    });
    const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
    await adminDb.collection('coaches').doc(coachId).set({
      rating: avg,
      reviews: count,
      updatedAt: nowIso,
    }, { merge: true });

    return NextResponse.json({ ok: true, rating: avg, reviews: count });
  } catch (e) {
    console.error('coach-reviews POST error', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
