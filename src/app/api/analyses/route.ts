import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminAvailable, getFirebaseAdminError } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ANALYSES] Endpoint llamado');
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    console.log('🔍 [ANALYSES] userId:', userId);
    
    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // Verificar Firebase Admin
    if (!isFirebaseAdminAvailable()) {
      console.error('❌ [ANALYSES] Firebase Admin no disponible:', getFirebaseAdminError());
      return NextResponse.json({
        analyses: [],
        count: 0,
        error: 'Base de datos no disponible',
        details: getFirebaseAdminError()
      });
    }

    console.log('🔍 [ANALYSES] Buscando en ambas colecciones...');

    // Buscar en colección 'analyses'
    const analysesSnapshot = await adminDb
      .collection('analyses')
      .where('playerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log(`📊 [ANALYSES] Colección 'analyses': ${analysesSnapshot.docs.length} documentos`);
    
    type AnalysisEntry = { id: string; createdAt?: any; source: string; [key: string]: any };

    const analysesFromAnalyses: AnalysisEntry[] = analysesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'analyses'
    }));

    // Buscar en colección 'video-analysis' (sin orderBy para evitar error de índice)
    const videoAnalysisSnapshot = await adminDb
      .collection('video-analysis')
      .where('userId', '==', userId)
      .get();
    
    console.log(`📊 [ANALYSES] Colección 'video-analysis': ${videoAnalysisSnapshot.docs.length} documentos`);
    
    const analysesFromVideoAnalysis: AnalysisEntry[] = videoAnalysisSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        playerId: data.userId,
        shotType: data.shotType || 'Tipo no especificado',
        status: data.analysis ? 'analyzed' : 'uploaded',
        createdAt: data.createdAt,
        videoUrl: data.videoUrl,
        analysis: data.analysis,
        metadata: data.metadata,
        originalFileName: data.originalFileName,
        source: 'video-analysis'
      };
    });

    // Combinar resultados
    const allAnalyses = [...analysesFromAnalyses, ...analysesFromVideoAnalysis];
    
    // Ordenar por fecha
    allAnalyses.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    console.log(`✅ [ANALYSES] Total encontrados: ${allAnalyses.length}`);
    
    return NextResponse.json({
      analyses: allAnalyses,
      count: allAnalyses.length,
      userId: userId,
      sources: {
        analyses: analysesFromAnalyses.length,
        videoAnalysis: analysesFromVideoAnalysis.length
      }
    });

  } catch (error) {
    console.error('❌ [ANALYSES] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
        analyses: [],
        count: 0
      },
      { status: 500 }
    );
  }
}