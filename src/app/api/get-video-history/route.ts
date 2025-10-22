import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const playerId = searchParams.get('playerId');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!userId) {
      return NextResponse.json({ error: 'No se proporcionó userId' }, { status: 400 });
    }

        if (playerId) {
          }

    // Construir query
    let query = adminDb.collection('video-analysis')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // Filtrar por playerId si se proporciona
    if (playerId) {
      query = query.where('playerId', '==', playerId);
    }

    // Ejecutar query
    const snapshot = await query.get();
    
    if (snapshot.empty) {
            return NextResponse.json({
        success: true,
        message: 'No se encontraron análisis en el historial',
        analyses: [],
        total: 0
      });
    }

    // Procesar resultados
    const analyses = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.id,
        userId: data.userId,
        playerId: data.playerId,
        playerName: data.playerName,
        videoUrl: data.videoUrl,
        originalFileName: data.originalFileName,
        analysis: data.analysis,
        metadata: data.metadata,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });

        return NextResponse.json({
      success: true,
      message: 'Historial obtenido exitosamente',
      analyses: analyses,
      total: analyses.length,
      userId: userId,
      playerId: playerId || null,
      limit: limit
    });

  } catch (error: any) {
    console.error('❌ Error obteniendo historial:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo historial',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
    try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');
    const userId = searchParams.get('userId');
    
    if (!analysisId) {
      return NextResponse.json({ error: 'No se proporcionó analysisId' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'No se proporcionó userId' }, { status: 400 });
    }

        // Verificar que el análisis pertenece al usuario
    const doc = await adminDb.collection('video-analysis').doc(analysisId).get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }

    const data = doc.data();
    if (data?.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado para eliminar este análisis' }, { status: 403 });
    }

    // Eliminar de Firestore
    await adminDb.collection('video-analysis').doc(analysisId).delete();
    
    // TODO: Eliminar video de Firebase Storage
    // const videoRef = adminStorage.bucket().file(data.videoFileName);
    // await videoRef.delete();
    
    return NextResponse.json({
      success: true,
      message: 'Análisis eliminado exitosamente',
      analysisId: analysisId
    });

  } catch (error: any) {
    console.error('❌ Error eliminando análisis:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error eliminando análisis',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

