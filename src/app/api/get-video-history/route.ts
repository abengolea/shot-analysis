import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email'); // Nuevo parámetro para buscar por email
    const playerId = searchParams.get('playerId');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'No se proporcionó userId o email' }, { status: 400 });
    }

    let analyses: any[] = [];
    
    // Si se proporciona userId, buscar por userId
    if (userId) {
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
      
      if (!snapshot.empty) {
        analyses = snapshot.docs.map(doc => {
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
      }
    }
    
    // Si se proporciona email, buscar por email en los perfiles de usuario
    if (email && analyses.length === 0) {
      console.log(`🔍 Buscando análisis por email: ${email}`);
      
      // Buscar en perfiles de jugadores
      const playersQuery = adminDb.collection('players').where('email', '==', email);
      const playersSnapshot = await playersQuery.get();
      
      if (!playersSnapshot.empty) {
        const playerDoc = playersSnapshot.docs[0];
        const playerData = playerDoc.data();
        console.log(`👤 Jugador encontrado: ${playerData.name} (${playerDoc.id})`);
        
        // Buscar análisis de este jugador
        let playerQuery = adminDb.collection('video-analysis')
          .where('userId', '==', playerDoc.id)
          .orderBy('createdAt', 'desc')
          .limit(limit);
          
        if (playerId) {
          playerQuery = playerQuery.where('playerId', '==', playerId);
        }
        
        const playerAnalysesSnapshot = await playerQuery.get();
        
        if (!playerAnalysesSnapshot.empty) {
          analyses = playerAnalysesSnapshot.docs.map(doc => {
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
        }
      }
      
      // Si no se encontró en jugadores, buscar en entrenadores
      if (analyses.length === 0) {
        const coachesQuery = adminDb.collection('coaches').where('email', '==', email);
        const coachesSnapshot = await coachesQuery.get();
        
        if (!coachesSnapshot.empty) {
          const coachDoc = coachesSnapshot.docs[0];
          const coachData = coachDoc.data();
          console.log(`👨‍🏫 Entrenador encontrado: ${coachData.name} (${coachDoc.id})`);
          
          // Buscar análisis de este entrenador
          let coachQuery = adminDb.collection('video-analysis')
            .where('userId', '==', coachDoc.id)
            .orderBy('createdAt', 'desc')
            .limit(limit);
            
          if (playerId) {
            coachQuery = coachQuery.where('playerId', '==', playerId);
          }
          
          const coachAnalysesSnapshot = await coachQuery.get();
          
          if (!coachAnalysesSnapshot.empty) {
            analyses = coachAnalysesSnapshot.docs.map(doc => {
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
          }
        }
      }
    }
    
    if (analyses.length === 0) {
            return NextResponse.json({
        success: true,
        message: 'No se encontraron análisis en el historial',
        analyses: [],
        total: 0,
        searchMethod: email ? 'email' : 'userId',
        searchValue: email || userId
      });
    }

        return NextResponse.json({
      success: true,
      message: 'Historial obtenido exitosamente',
      analyses: analyses,
      total: analyses.length,
      userId: userId,
      email: email,
      playerId: playerId || null,
      limit: limit,
      searchMethod: email ? 'email' : 'userId'
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

