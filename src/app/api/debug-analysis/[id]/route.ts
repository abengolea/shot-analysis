import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    
    console.log('🔍 Debugging analysis:', analysisId);
    
    // 1. Verificar si el análisis existe
    const analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    
    if (!analysisDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found',
        analysisId
      });
    }
    
    const analysisData = analysisDoc.data();
    
    // 2. Verificar keyframes
    const hasKeyframes = !!analysisData?.keyframes;
    const keyframesStructure = analysisData?.keyframes || null;
    
    // 3. Verificar smart keyframes
    const smartKeyframesDoc = await adminDb.collection('smart_keyframes').doc(analysisId).get();
    const hasSmartKeyframes = smartKeyframesDoc.exists;
    const smartKeyframesData = smartKeyframesDoc.exists ? smartKeyframesDoc.data() : null;
    
    // 4. Verificar videos disponibles
    const videoKeys = ['videoUrl', 'videoFrontUrl', 'videoBackUrl', 'videoLeftUrl', 'videoRightUrl'];
    const availableVideos = videoKeys.filter(key => analysisData?.[key]);
    
    // 5. Verificar logs de procesamiento
    const logsQuery = await adminDb.collection('processing_logs')
      .where('analysisId', '==', analysisId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const processingLogs = logsQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 6. Verificar si hay errores de FFmpeg
    const ffmpegErrors = processingLogs.filter(log => 
      log.message?.includes('ffmpeg') || 
      log.message?.includes('FFmpeg') ||
      log.error?.includes('ffmpeg') ||
      log.error?.includes('FFmpeg')
    );
    
    const result = {
      success: true,
      analysisId,
      analysis: {
        id: analysisDoc.id,
        createdAt: analysisData?.createdAt,
        status: analysisData?.status,
        analysisMethod: analysisData?.analysisMethod,
        hasKeyframes,
        keyframesStructure,
        hasSmartKeyframes,
        smartKeyframesData,
        availableVideos: availableVideos.map(key => ({
          key,
          url: analysisData?.[key]
        })),
        processingLogs,
        ffmpegErrors,
        summary: {
          totalLogs: processingLogs.length,
          ffmpegErrorCount: ffmpegErrors.length,
          hasAnyKeyframes: hasKeyframes || hasSmartKeyframes,
          videoCount: availableVideos.length
        }
      }
    };
    
    console.log('🔍 Debug result:', JSON.stringify(result, null, 2));
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      analysisId: params.id
    }, { status: 500 });
  }
}
