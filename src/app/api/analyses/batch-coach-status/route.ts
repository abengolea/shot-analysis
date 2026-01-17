import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * Endpoint optimizado para obtener el estado de coach feedback y unlock status
 * para múltiples análisis en una sola llamada.
 * 
 * Recibe: { analysisIds: string[] }
 * Devuelve: { [analysisId]: { hasCoachFeedback: boolean, unlockStatus: {...} } }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const playerId = decoded.uid;

    const body = await request.json();
    const analysisIds: string[] = Array.isArray(body.analysisIds) ? body.analysisIds.map(String) : [];
    
    if (analysisIds.length === 0) {
      return NextResponse.json({ statusByAnalysis: {} });
    }

    // Limitar a 50 análisis por rendimiento
    const limitedIds: string[] = analysisIds.slice(0, 50);

    // Obtener todos los análisis de una vez
    const analysisPromises = limitedIds.map(id => 
      adminDb.collection('analyses').doc(id).get()
    );
    const analysisDocs = await Promise.all(analysisPromises);

    // Verificar que todos los análisis pertenezcan al jugador
    const validAnalyses: Array<{ id: string; data: any }> = [];
    for (let i = 0; i < analysisDocs.length; i++) {
      const doc = analysisDocs[i];
      if (doc.exists) {
        const data = doc.data() as any;
        if (String(data.playerId) === String(playerId)) {
          validAnalyses.push({ id: limitedIds[i], data });
        }
      }
    }

    // Obtener todos los unlocks para estos análisis en batch
    const unlockPromises = validAnalyses.map(a => 
      adminDb.collection('coach_unlocks')
        .where('analysisId', '==', a.id)
        .where('playerId', '==', playerId)
        .get()
    );
    const unlockSnapshots = await Promise.all(unlockPromises);

    // Recolectar todos los coach IDs únicos
    const coachIdsSet = new Set<string>();
    const unlocksByAnalysis: Record<string, any[]> = {};
    
    for (let i = 0; i < validAnalyses.length; i++) {
      const analysis = validAnalyses[i];
      const unlocks: any[] = [];
      
      for (const doc of unlockSnapshots[i].docs) {
        const unlockData = doc.data();
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
        if (unlockData.coachId) {
          coachIdsSet.add(unlockData.coachId);
        }
      }
      
      unlocksByAnalysis[analysis.id] = unlocks;
      
      // También agregar coach IDs de coachAccess
      const coachAccess = analysis.data.coachAccess || {};
      for (const coachId of Object.keys(coachAccess)) {
        coachIdsSet.add(coachId);
      }
    }

    // Obtener nombres de coaches en batch
    const coachNames: Record<string, string> = {};
    if (coachIdsSet.size > 0) {
      const coachPromises = Array.from(coachIdsSet).map(coachId =>
        adminDb.collection('coaches').doc(coachId).get()
      );
      const coachDocs = await Promise.all(coachPromises);
      
      for (let i = 0; i < coachDocs.length; i++) {
        const doc = coachDocs[i];
        if (doc.exists) {
          const coachData = doc.data() as any;
          const coachId = Array.from(coachIdsSet)[i];
          coachNames[coachId] = coachData.name || 'Entrenador';
        }
      }
    }

    // Obtener feedback de coach para todos los análisis en batch
    const feedbackPromises = validAnalyses.map(a =>
      adminDb.collection('analyses')
        .doc(a.id)
        .collection('coach_feedback')
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get()
    );
    const feedbackSnapshots = await Promise.all(feedbackPromises);

    // Obtener reseñas ya realizadas por el jugador para cada análisis
    const reviewPromises = validAnalyses.map(a =>
      adminDb.collection('coach_reviews')
        .where('analysisId', '==', a.id)
        .where('playerId', '==', playerId)
        .get()
    );
    const reviewSnapshots = await Promise.all(reviewPromises);

    // Construir respuesta
    const statusByAnalysis: Record<string, {
      hasCoachFeedback: boolean;
      unlockStatus: {
        status: 'none' | 'pending_payment' | 'paid_pending_review' | 'reviewed';
        paidCoachIds: Array<{ coachId: string; coachName: string }>;
        pendingCoachIds: Array<{ coachId: string; coachName: string }>;
      };
      unlocks: Array<{
        id: string;
        coachId: string;
        coachName: string;
        status: string;
        paymentProvider?: string | null;
        preferenceId?: string | null;
        paymentId?: string | null;
        createdAt?: string | null;
        updatedAt?: string | null;
      }>;
      reviewedCoachIds: string[];
    }> = {};

    for (let i = 0; i < validAnalyses.length; i++) {
      const analysis = validAnalyses[i];
      const analysisData = analysis.data;
      
      // Verificar feedback
      const feedbackSnapshot = feedbackSnapshots[i];
      let hasCoachFeedback = false;
      if (!feedbackSnapshot.empty) {
        const feedbackData = feedbackSnapshot.docs[0].data();
        hasCoachFeedback = feedbackData && (
          (feedbackData.items && typeof feedbackData.items === 'object' && Object.keys(feedbackData.items).length > 0) ||
          (feedbackData.coachSummary && String(feedbackData.coachSummary).trim().length > 0)
        );
      }

      // Procesar unlocks y coachAccess
      const unlocks = unlocksByAnalysis[analysis.id] || [];
      const reviewSnapshot = reviewSnapshots[i];
      const reviewedCoachIds = Array.from(new Set(
        reviewSnapshot.docs
          .map((doc) => (doc.data() as any)?.coachId)
          .filter((id) => typeof id === 'string' && id.length > 0)
      ));
      const coachAccess = analysisData.coachAccess || {};
      const paidCoachIds: string[] = [];
      const pendingCoachIds: string[] = [];
      
      // De unlocks
      for (const unlock of unlocks) {
        if (unlock.status === 'paid') {
          paidCoachIds.push(unlock.coachId);
        } else if (unlock.status === 'pending') {
          pendingCoachIds.push(unlock.coachId);
        }
      }
      
      // De coachAccess
      for (const [coachId, access] of Object.entries(coachAccess)) {
        const accessData = access as any;
        if (accessData.status === 'paid') {
          if (!paidCoachIds.includes(coachId)) {
            paidCoachIds.push(coachId);
          }
        } else if (accessData.status === 'pending') {
          if (!pendingCoachIds.includes(coachId)) {
            pendingCoachIds.push(coachId);
          }
        }
      }

      // Determinar estado
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

      statusByAnalysis[analysis.id] = {
        hasCoachFeedback,
        unlockStatus: {
          status,
          paidCoachIds: paidCoachIds.map(id => ({
            coachId: id,
            coachName: coachNames[id] || 'Entrenador',
          })),
          pendingCoachIds: pendingCoachIds.map(id => ({
            coachId: id,
            coachName: coachNames[id] || 'Entrenador',
          })),
        },
        unlocks,
        reviewedCoachIds,
      };
    }

    return NextResponse.json({ statusByAnalysis });
  } catch (error) {
    console.error('Error al obtener estado batch de coach:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

