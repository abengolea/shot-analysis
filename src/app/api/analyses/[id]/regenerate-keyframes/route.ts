import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { extractAndUploadSmartKeyframesAsync } from '@/lib/smart-keyframes';
import { Storage } from '@google-cloud/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    
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
    
    // 2. Verificar si tiene video
    const videoUrl = analysisData?.videoUrl || analysisData?.videoBackUrl;
    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'No video found in analysis',
        analysisId
      }, { status: 400 });
    }
    
    console.log('📹 [REGENERATE-KEYFRAMES] Video encontrado:', videoUrl);
    
    // 3. Descargar video desde Storage
    const storage = new Storage();
    const bucketName = 'shotanalisys.firebasestorage.app';
    
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
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(storagePath);
    
    console.log('⬇️ [REGENERATE-KEYFRAMES] Descargando video:', storagePath);
    const [videoBuffer] = await file.download();
    
    // 4. Preparar buffers de video para keyframes
    const videoBuffers = {
      back: videoBuffer, // El video principal (back)
      front: undefined,
      left: undefined,
      right: undefined
    };
    
    // 5. Extraer keyframes inteligentes
    console.log('🔍 [REGENERATE-KEYFRAMES] Extrayendo keyframes...');
    await extractAndUploadSmartKeyframesAsync({
      analysisId: analysisId,
      videoBuffers,
      userId: analysisData?.userId || 'unknown'
    });
    
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
      analysisId: params.id
    }, { status: 500 });
  }
}
