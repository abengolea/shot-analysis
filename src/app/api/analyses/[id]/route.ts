import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Authorization Bearer token requerido' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const role = coachSnap.exists
      ? (coachSnap.data() as any)?.role
      : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (!role) {
      return NextResponse.json({ error: 'Usuario no autorizado' }, { status: 403 });
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
    const coachAccess = (analysisData as any)?.coachAccess || {};
    const coachAccessForUser = coachAccess?.[uid];

    if (role !== 'admin') {
      if (role === 'player') {
        if (!analysisPlayerId || String(analysisPlayerId) !== String(uid)) {
          return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
      } else if (role === 'coach') {
        if (!coachAccessForUser || coachAccessForUser.status !== 'paid') {
          return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
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
