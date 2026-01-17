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
      return NextResponse.json(
        { error: 'ID de análisis es requerido' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const playerId = decoded.uid;

    // Obtener el análisis
    const analysisDoc = await adminDb
      .collection('analyses')
      .doc(analysisId)
      .get();

    if (!analysisDoc.exists) {
      return NextResponse.json(
        { error: 'Análisis no encontrado' },
        { status: 404 }
      );
    }

    const analysisData = analysisDoc.data() as any;
    
    // Verificar que el análisis pertenezca al jugador
    if (String(analysisData.playerId) !== String(playerId)) {
      return NextResponse.json(
        { error: 'No autorizado para este análisis' },
        { status: 403 }
      );
    }

    // Buscar unlocks para este análisis
    // Los unlocks tienen formato: analysisId__coachId
    const unlockSnapshot = await adminDb
      .collection('coach_unlocks')
      .where('analysisId', '==', analysisId)
      .get();

    const unlocks: any[] = [];
    for (const doc of unlockSnapshot.docs) {
      const unlockData = doc.data();
      // Verificar que el unlock pertenezca al jugador
      if (String(unlockData.playerId) === String(playerId)) {
        unlocks.push({
          id: doc.id,
          coachId: unlockData.coachId,
          coachName: unlockData.coachName || '',
          status: unlockData.status || 'pending', // 'pending' | 'paid'
          paymentId: unlockData.paymentId || null,
          paymentProvider: unlockData.paymentProvider || null,
          preferenceId: unlockData.preferenceId || null,
          createdAt: unlockData.createdAt,
          updatedAt: unlockData.updatedAt,
        });
      }
    }

    // También verificar coachAccess en el análisis
    const coachAccess = analysisData.coachAccess || {};
    const paidCoachIds: string[] = [];
    const pendingCoachIds: string[] = [];
    const paidCoachData: Array<{ coachId: string; paymentId?: string }> = [];
    
    for (const [coachId, access] of Object.entries(coachAccess)) {
      const accessData = access as any;
      if (accessData.status === 'paid') {
        paidCoachIds.push(coachId);
        paidCoachData.push({
          coachId,
          paymentId: accessData.paymentId,
        });
      } else if (accessData.status === 'pending') {
        pendingCoachIds.push(coachId);
      }
    }

    // Obtener nombres de los coaches pagados/pendientes
    const coachIds = [...new Set([...paidCoachIds, ...pendingCoachIds])];
    const coachNames: Record<string, string> = {};
    
    for (const coachId of coachIds) {
      try {
        const coachDoc = await adminDb.collection('coaches').doc(coachId).get();
        if (coachDoc.exists) {
          const coachData = coachDoc.data() as any;
          coachNames[coachId] = coachData.name || 'Entrenador';
        }
      } catch (e) {
        console.error(`Error obteniendo nombre del coach ${coachId}:`, e);
      }
    }

    // Verificar si hay feedback de entrenador (revisión completada)
    let hasCoachFeedback = false;
    try {
      const feedbackCollRef = adminDb.collection('analyses').doc(analysisId).collection('coach_feedback');
      const feedbackSnapshot = await feedbackCollRef.orderBy('updatedAt', 'desc').limit(1).get();
      if (!feedbackSnapshot.empty) {
        const feedbackData = feedbackSnapshot.docs[0].data();
        hasCoachFeedback = feedbackData && (
          (feedbackData.items && typeof feedbackData.items === 'object' && Object.keys(feedbackData.items).length > 0) ||
          (feedbackData.coachSummary && String(feedbackData.coachSummary).trim().length > 0)
        );
      }
    } catch (e) {
      console.error('Error verificando feedback:', e);
    }

    // Verificar si el jugador ya dejó reseña para este análisis
    let reviewedCoachIds: string[] = [];
    try {
      const reviewSnapshot = await adminDb
        .collection('coach_reviews')
        .where('analysisId', '==', analysisId)
        .where('playerId', '==', playerId)
        .get();
      reviewedCoachIds = Array.from(new Set(
        reviewSnapshot.docs
          .map((doc) => (doc.data() as any)?.coachId)
          .filter((id) => typeof id === 'string' && id.length > 0)
      ));
    } catch (e) {
      console.error('Error verificando reseñas:', e);
    }

    // Determinar el estado general
    const hasPaidUnlock = unlocks.some(u => u.status === 'paid') || paidCoachIds.length > 0;
    const hasPendingUnlock = unlocks.some(u => u.status === 'pending') || pendingCoachIds.length > 0;

    return NextResponse.json({
      analysisId,
      unlocks,
      paidCoachIds: paidCoachIds.map(id => {
        const coachData = paidCoachData.find(c => c.coachId === id);
        return {
          coachId: id,
          coachName: coachNames[id] || 'Entrenador',
          paymentId: coachData?.paymentId || null,
        };
      }),
      pendingCoachIds: pendingCoachIds.map(id => ({
        coachId: id,
        coachName: coachNames[id] || 'Entrenador',
      })),
      hasPaidUnlock,
      hasPendingUnlock,
      hasCoachFeedback,
      reviewedCoachIds,
      status: hasCoachFeedback 
        ? 'reviewed' 
        : hasPaidUnlock 
          ? 'paid_pending_review' 
          : hasPendingUnlock 
            ? 'pending_payment' 
            : 'none',
    });
  } catch (error) {
    console.error('Error al obtener estado de unlock:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
