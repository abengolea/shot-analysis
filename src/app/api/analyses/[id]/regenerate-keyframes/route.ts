import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { extractAndUploadSmartKeyframesAsync } from '@/lib/smart-keyframes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let analysisId: string | undefined;
  try {
    const resolvedParams = await params;
    analysisId = resolvedParams.id;
    
    console.log('🔄 [REGENERATE-KEYFRAMES] Iniciando regeneración para:', analysisId);
    
    // 1. Verificar si el análisis existe
    const analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    
    if (!analysisDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found',
        analysisId,
        hint: 'The analysis may still be processing or failed during processing'
      }, { status: 404 });
    }
    
    const analysisData = analysisDoc.data();
    
    // 2. Verificar si tiene video (considerar todos los ángulos)
    const candidateUrls = {
      back: analysisData?.videoBackUrl || analysisData?.videoUrl,
      front: analysisData?.videoFrontUrl,
      left: analysisData?.videoLeftUrl,
      right: analysisData?.videoRightUrl,
    } as Record<string, string | undefined>;

    // Prioridad: back -> front -> left -> right
    const selectedAngle = (['back', 'front', 'left', 'right'] as const).find(
      (k) => Boolean(candidateUrls[k])
    );

    const videoUrl = selectedAngle ? candidateUrls[selectedAngle] : undefined;

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'No video found in analysis (none of videoBackUrl, videoUrl, videoFrontUrl, videoLeftUrl, videoRightUrl)',
        analysisId
      }, { status: 400 });
    }
    
    console.log('📹 [REGENERATE-KEYFRAMES] Video encontrado:', { url: videoUrl, angle: selectedAngle });
    
    // 3. Verificar que adminStorage esté disponible
    if (!adminStorage) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin Storage no disponible',
        analysisId
      }, { status: 500 });
    }
    
    // 4. Descargar video desde Storage usando Firebase Admin
    const bucket = adminStorage.bucket();
    const bucketName = bucket.name;
    
    // Extraer la ruta completa del video en el bucket
    // La videoUrl puede ser una signed URL o una GCS path
    let storagePath = '';
    
    console.log('🔍 [REGENERATE-KEYFRAMES] Video URL recibida:', videoUrl);
    
    if (videoUrl.includes('storage.googleapis.com')) {
      // Signed URL: https://storage.googleapis.com/bucket/path?GoogleAccessId=...
      const url = new URL(videoUrl);
      storagePath = url.pathname;
      // Remover el primer "/" si existe
      if (storagePath.startsWith('/')) {
        storagePath = storagePath.substring(1);
      }
      // Si contiene el nombre del bucket al inicio, removerlo
      const bucketPrefix = `${bucketName}/`;
      if (storagePath.startsWith(bucketPrefix)) {
        storagePath = storagePath.substring(bucketPrefix.length);
      }
    } else if (videoUrl.startsWith('gs://')) {
      // GCS URI: gs://bucket/path
      const match = videoUrl.match(/gs:\/\/.*?\/(.+)$/);
      storagePath = match ? match[1] : '';
    } else if (videoUrl.includes('firebasestorage.googleapis.com')) {
      // URL pública: https://firebasestorage.googleapis.com/v0/b/bucket/o/path?alt=media
      const match = videoUrl.match(/\/o\/(.*)\?/);
      storagePath = match ? decodeURIComponent(match[1]) : '';
    } else {
      // Fallback: asumir que es el path directo
      storagePath = videoUrl;
    }
    
    console.log('📁 [REGENERATE-KEYFRAMES] Storage path extraído:', storagePath);
    
    if (!storagePath) {
      return NextResponse.json({
        success: false,
        error: 'Invalid video URL format',
        analysisId,
        videoUrl
      }, { status: 400 });
    }
    
    const file = bucket.file(storagePath);
    
    console.log('⬇️ [REGENERATE-KEYFRAMES] Descargando video:', storagePath);
    const [videoBuffer] = await file.download();
    
    // 5. Preparar buffers de video para keyframes según el ángulo detectado
    const videoBuffers = {
      back: selectedAngle === 'back' ? videoBuffer : undefined,
      front: selectedAngle === 'front' ? videoBuffer : undefined,
      left: selectedAngle === 'left' ? videoBuffer : undefined,
      right: selectedAngle === 'right' ? videoBuffer : undefined,
    } as const;
    
    // 6. Extraer keyframes inteligentes
    console.log('🔍 [REGENERATE-KEYFRAMES] Extrayendo keyframes...');
    console.log('🔍 [REGENERATE-KEYFRAMES] Analysis data:', JSON.stringify(analysisData, null, 2));
    console.log('🔍 [REGENERATE-KEYFRAMES] Video buffer size:', videoBuffer.length);
    console.log('🔍 [REGENERATE-KEYFRAMES] Calling extractAndUploadSmartKeyframesAsync...');
    await extractAndUploadSmartKeyframesAsync({
      analysisId: analysisId,
      videoBuffers,
      userId: analysisData?.playerId || analysisData?.userId || 'unknown'
    });
    console.log('✅ [REGENERATE-KEYFRAMES] extractAndUploadSmartKeyframesAsync completado');
    
    // Verificar si se guardaron los keyframes
    const updatedAnalysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    const updatedData = updatedAnalysisDoc.data();
    console.log('🔍 [REGENERATE-KEYFRAMES] Verificando keyframes en DB...');
    console.log('🔍 [REGENERATE-KEYFRAMES] smartKeyframes:', updatedData?.smartKeyframes ? 'EXISTS' : 'NULL');
    console.log('🔍 [REGENERATE-KEYFRAMES] keyframesExtractedAt:', updatedData?.keyframesExtractedAt);
    
    console.log('✅ [REGENERATE-KEYFRAMES] Keyframes regenerados exitosamente');
    
    return NextResponse.json({
      success: true,
      message: 'Keyframes regenerated successfully',
      analysisId
    });
    
  } catch (error) {
    console.error('❌ [REGENERATE-KEYFRAMES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      analysisId: analysisId || 'unknown'
    }, { status: 500 });
  }
}
