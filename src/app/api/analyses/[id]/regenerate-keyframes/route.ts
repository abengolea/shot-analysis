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
    
    // 1. Verificar si el análisis existe en 'analyses' o 'video-analysis'
    let analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    let analysisData = analysisDoc.exists ? analysisDoc.data() : null;
    
    if (!analysisDoc.exists) {
      // Intentar en 'video-analysis'
      analysisDoc = await adminDb.collection('video-analysis').doc(analysisId).get();
      if (analysisDoc.exists) {
        analysisData = analysisDoc.data();
      }
    }
    
    if (!analysisDoc.exists || !analysisData) {
      return NextResponse.json({
        success: false,
        error: 'Analysis not found in any collection',
        analysisId,
        checked: ['analyses', 'video-analysis']
      }, { status: 404 });
    }
    
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
    
    // Extraer el nombre del archivo de la URL
    const fileName = videoUrl.split('/').pop()?.split('?')[0];
    if (!fileName) {
      return NextResponse.json({
        success: false,
        error: 'Invalid video URL format',
        analysisId
      }, { status: 400 });
    }
    
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    
    console.log('⬇️ [REGENERATE-KEYFRAMES] Descargando video:', fileName);
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
