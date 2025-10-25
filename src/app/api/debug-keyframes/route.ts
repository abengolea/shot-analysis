import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminAvailable } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('id') || 'analysis_1761185478108_2mtoi1vav';
    
    console.log('🔍 [DEBUG-KEYFRAMES] Analizando:', analysisId);
    
    if (!isFirebaseAdminAvailable()) {
      return NextResponse.json({ error: 'Firebase Admin no disponible' });
    }

    // 1. Verificar el análisis principal
    const analysisDoc = await adminDb.collection('analyses').doc(analysisId).get();
    
    if (!analysisDoc.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' });
    }
    
    const analysisData = analysisDoc.data();
    
    // 2. Verificar campos de keyframes
    const smartKeyframes = analysisData?.smartKeyframes;
    const keyframes = analysisData?.keyframes;
    const keyframesExtractedAt = analysisData?.keyframesExtractedAt;
    const keyframesMetadata = analysisData?.keyframesMetadata;
    
    // 3. Verificar documentos de keyframes separados
    const keyframesDocs = await adminDb
      .collection('analyses')
      .doc(analysisId)
      .collection('keyframes')
      .get();
    
    const keyframesData = {};
    for (const doc of keyframesDocs.docs) {
      const angle = doc.id;
      const framesDoc = await adminDb
        .collection('analyses')
        .doc(analysisId)
        .collection('keyframes')
        .doc(angle)
        .collection('frames')
        .get();
      
      keyframesData[angle] = framesDoc.docs.length;
    }
    
    return NextResponse.json({
      analysisId,
      analysisExists: analysisDoc.exists,
      smartKeyframes: smartKeyframes ? Object.keys(smartKeyframes).map(k => ({ [k]: smartKeyframes[k]?.length || 0 })) : null,
      keyframes: keyframes ? Object.keys(keyframes).map(k => ({ [k]: keyframes[k]?.length || 0 })) : null,
      keyframesExtractedAt,
      keyframesMetadata,
      keyframesDocs: keyframesDocs.docs.length,
      keyframesData,
      allFields: Object.keys(analysisData || {})
    });
    
  } catch (error) {
    console.error('❌ [DEBUG-KEYFRAMES] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
