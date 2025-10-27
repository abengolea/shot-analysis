import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('id');
    
    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId is required' }, { status: 400 });
    }
    
    console.log('🔍 [CHECK-KEYFRAMES-LOGS] Checking logs for:', analysisId);
    
    // 1. Buscar el análisis
    const analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    
    if (!analysisDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found',
        analysisId
      }, { status: 404 });
    }
    
    const analysisData = analysisDoc.data();
    
    // 2. Verificar si tiene keyframes
    const hasKeyframes = !!analysisData?.keyframes;
    const hasSmartKeyframes = !!analysisData?.smartKeyframes;
    const keyframesExtractedAt = analysisData?.keyframesExtractedAt;
    
    // 3. Buscar logs de procesamiento (sin orderBy para evitar índice)
    let logs: any[] = [];
    try {
      const logsQuery = await adminDb.collection('processing_logs')
        .where('analysisId', '==', analysisId)
        .limit(50)
        .get();
      
      logs = logsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Ordenar en memoria
      logs.sort((a, b) => {
        const timeA = a.timestamp || a.createdAt || 0;
        const timeB = b.timestamp || b.createdAt || 0;
        return timeB - timeA;
      });
    } catch (e) {
      console.warn('Could not fetch processing logs:', e);
    }
    
    // 4. Verificar subcolecciones de keyframes
    const keyframesCounts = {
      front: 0,
      back: 0,
      left: 0,
      right: 0
    };
    
    const angles = ['front', 'back', 'left', 'right'];
    for (const angle of angles) {
      try {
        const angleDoc = await adminDb
          .collection('analyses')
          .doc(analysisId)
          .collection('keyframes')
          .doc(angle)
          .collection('frames')
          .count()
          .get();
        
        keyframesCounts[angle] = angleDoc.data().count || 0;
      } catch (e) {
        // Ignore
      }
    }
    
    const result = {
      success: true,
      analysisId,
      analysis: {
        id: analysisDoc.id,
        createdAt: analysisData?.createdAt,
        status: analysisData?.status,
        analysisMethod: analysisData?.analysisMethod,
      },
      keyframes: {
        hasKeyframes,
        hasSmartKeyframes,
        keyframesExtractedAt,
        smartKeyframesCount: analysisData?.smartKeyframes?.front?.length || 0,
        subcollectionCounts: keyframesCounts
      },
      logs: logs,
      summary: {
        totalLogs: logs.length,
        hasAnyKeyframes: hasKeyframes || hasSmartKeyframes,
        keyframesGenerated: keyframesExtractedAt ? true : false,
        totalSubcollectionFrames: Object.values(keyframesCounts).reduce((a, b) => a + b, 0)
      }
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ [CHECK-KEYFRAMES-LOGS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
