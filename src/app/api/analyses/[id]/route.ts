import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { hasPaidCoachAccessToPlayer } from '@/lib/coach-access';
import { buildScoreMetadata, loadWeightsFromFirestore } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }

    const { id: analysisId } = await params;

    if (!analysisId) {
      return NextResponse.json(
        { error: 'ID de análisis es requerido' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    let uid: string | null = null;
    let role: string | null = null;
    let coachSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    let playerSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;

      const [coachDoc, playerDoc] = await Promise.all([
        adminDb.collection('coaches').doc(uid).get(),
        adminDb.collection('players').doc(uid).get(),
      ]);
      coachSnap = coachDoc;
      playerSnap = playerDoc;
      const coachData = coachDoc.exists ? (coachDoc.data() as any) : null;
      const playerData = playerDoc.exists ? (playerDoc.data() as any) : null;
      role = coachData?.role || playerData?.role || null;
    }

    console.log('🔍 Buscando análisis específico:', analysisId);

    // Obtener el análisis específico desde Firestore
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

    const analysisData = analysisDoc.data();
    const analysis = {
      id: analysisDoc.id,
      ...analysisData
    };

    const analysisPlayerId = (analysisData as any)?.playerId;
    const analysisUserId = (analysisData as any)?.userId;
    if (uid) {
      const coachAccess = (analysisData as any)?.coachAccess || {};
      const coachAccessForUser = coachAccess?.[uid];
      const isAdmin = role === 'admin';
      const isOwnerPlayer =
        (analysisPlayerId && String(analysisPlayerId) === String(uid)) ||
        (analysisUserId && String(analysisUserId) === String(uid));
      const hasPaidCoachAccess = coachSnap?.exists && coachAccessForUser?.status === 'paid';
      const hasPlayerPaidAccess = !hasPaidCoachAccess && analysisPlayerId && coachSnap?.exists
        ? await hasPaidCoachAccessToPlayer({
            adminDb,
            coachId: uid,
            playerId: String(analysisPlayerId),
          })
        : false;
      if (!isAdmin && !isOwnerPlayer && !hasPaidCoachAccess && !hasPlayerPaidAccess) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
    }

    const analysisResult = (analysisData as any)?.analysisResult || {};
    const existingScoreMetadata = analysisResult?.scoreMetadata;
    if (!existingScoreMetadata) {
      const detailedChecklist = Array.isArray(analysisResult?.detailedChecklist)
        ? analysisResult.detailedChecklist
        : Array.isArray((analysisData as any)?.detailedChecklist)
          ? (analysisData as any).detailedChecklist
          : [];
      if (detailedChecklist.length > 0) {
        const shotType = (analysisData as any)?.shotType || analysisResult?.shotType;
        const weights = await loadWeightsFromFirestore(shotType);
        const scoreMetadata = buildScoreMetadata(detailedChecklist, shotType, weights);
        await analysisDoc.ref.update({
          'analysisResult.scoreMetadata': scoreMetadata,
          updatedAt: new Date().toISOString(),
        });
        (analysis as any).analysisResult = { ...analysisResult, scoreMetadata };
      }
    }

    console.log(`✅ Análisis encontrado: ${analysisId}`);

    return NextResponse.json({
      analysis,
      success: true
    });

  } catch (error) {
    console.error('❌ Error al obtener análisis:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
