import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const body = await req.json();
    const rating = Number(body?.rating);
    const comment = String(body?.comment || '').trim();
    const requestedCoachId = String(body?.coachId || '').trim();
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating debe ser 1..5' }, { status: 400 });
    }

    const analysisRef = adminDb.collection('analyses').doc(id);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    const analysis = analysisSnap.data() as any;
    const analysisPlayerId = String(analysis?.playerId || analysis?.userId || '');
    if (!analysisPlayerId || analysisPlayerId !== String(uid)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (!analysis?.coachCompleted) {
      return NextResponse.json({ error: 'El entrenador aún no terminó la revisión' }, { status: 400 });
    }
    const coachId = String(analysis?.coachId || requestedCoachId || '');
    if (!coachId) {
      return NextResponse.json({ error: 'Este análisis no tiene entrenador asignado' }, { status: 400 });
    }
    if (analysis?.coachAccess && typeof analysis.coachAccess === 'object') {
      const access = analysis.coachAccess[coachId];
      if (!access || access?.status !== 'paid') {
        return NextResponse.json({ error: 'El entrenador no tiene acceso pagado a este análisis' }, { status: 403 });
      }
    }

    const existingSnap = await adminDb
      .collection('coach_reviews')
      .where('analysisId', '==', id)
      .where('playerId', '==', uid)
      .where('coachId', '==', coachId)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'Reseña ya enviada' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();
    await adminDb.collection('coach_reviews').add({
      analysisId: id,
      playerId: uid,
      coachId,
      rating,
      comment,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await adminDb.runTransaction(async (tx) => {
      const coachRef = adminDb.collection('coaches').doc(coachId);
      const coachSnap = await tx.get(coachRef);
      if (!coachSnap.exists) return;
      const coachData = coachSnap.data() as any;
      const prevReviews = typeof coachData?.reviews === 'number' ? coachData.reviews : 0;
      const prevRating = typeof coachData?.rating === 'number' ? coachData.rating : 0;
      const nextReviews = prevReviews + 1;
      const nextRating = Number(((prevRating * prevReviews + rating) / nextReviews).toFixed(2));
      tx.set(coachRef, { reviews: nextReviews, rating: nextRating, updatedAt: nowIso }, { merge: true });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('coach review error', e);
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}
