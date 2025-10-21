import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, shotType = 'Lanzamiento de prueba', playerId = 'test-user' } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl es requerido' },
        { status: 400 }
      );
    }

        // 1. VALIDAR CONTENIDO DEL VIDEO
    const url = videoUrl.toLowerCase();
    const isPartyVideo = url.includes('party') || 
                        url.includes('fiesta') || 
                        url.includes('celebration') ||
                        url.includes('dance') ||
                        url.includes('social');
    
    const isBasketballVideo = url.includes('basketball') || 
                             url.includes('baloncesto') ||
                             url.includes('shot') ||
                             url.includes('tiro');

    console.log(`[LOCAL] Video de fiesta: ${isPartyVideo}, Video de baloncesto: ${isBasketballVideo}`);

    // 2. SI ES VIDEO DE FIESTA - RECHAZAR
    if (isPartyVideo) {
      const docId = `rejected-${Date.now()}`;
      
      const rejectedAnalysisData = {
        playerId,
        createdAt: new Date().toISOString(),
        videoUrl,
        shotType,
        status: 'rejected',
        rejectionReason: 'Video de fiesta/celebración detectado. No es contenido de baloncesto válido.',
        analysisSummary: 'Video rechazado: No contiene contenido válido de baloncesto.',
        strengths: [],
        weaknesses: [],
        recommendations: ['Sube un video que muestre claramente un tiro de baloncesto.'],
        selectedKeyframes: [],
        keyframeAnalysis: 'No aplicable - Video rechazado.',
        detailedChecklist: [],
      };

      try {
        if (adminDb) {
          const rejectedAnalysisRef = adminDb.collection('analyses').doc(docId);
          await rejectedAnalysisRef.set(rejectedAnalysisData);
          console.log(`[LOCAL] Video rechazado y guardado: ${docId}`);
        } else {
          console.log(`[LOCAL] Firebase Admin no disponible, solo simulando rechazo: ${docId}`);
        }
      } catch (dbError) {
        console.error(`[LOCAL] Error guardando en DB:`, dbError);
        console.log(`[LOCAL] Continuando sin guardar en DB: ${docId}`);
      }

      return NextResponse.json({
        success: true,
        status: 'rejected',
        analysisId: docId,
        message: 'Video rechazado: No es contenido de baloncesto válido.',
        reason: 'Video de fiesta/celebración detectado.'
      });
    }

    // 3. SI ES VIDEO DE BALONCESTO - PROCESAR
    if (isBasketballVideo) {
      const docId = `approved-${Date.now()}`;
      
      const approvedAnalysisData = {
        playerId,
        createdAt: new Date().toISOString(),
        videoUrl,
        shotType,
        status: 'approved',
        analysisSummary: 'Video de baloncesto detectado. Análisis procesado correctamente.',
        strengths: ['Contenido válido de baloncesto'],
        weaknesses: [],
        recommendations: ['Video aprobado para análisis.'],
        selectedKeyframes: [],
        keyframeAnalysis: 'Video de baloncesto válido.',
        detailedChecklist: [],
      };

      try {
        if (adminDb) {
          const approvedAnalysisRef = adminDb.collection('analyses').doc(docId);
          await approvedAnalysisRef.set(approvedAnalysisData);
          console.log(`[LOCAL] Video aprobado y guardado: ${docId}`);
        } else {
          console.log(`[LOCAL] Firebase Admin no disponible, solo simulando aprobación: ${docId}`);
        }
      } catch (dbError) {
        console.error(`[LOCAL] Error guardando en DB:`, dbError);
        console.log(`[LOCAL] Continuando sin guardar en DB: ${docId}`);
      }

      return NextResponse.json({
        success: true,
        status: 'approved',
        analysisId: docId,
        message: 'Video aprobado: Contenido de baloncesto válido.',
      });
    }

    // 4. SI NO SE PUEDE DETERMINAR - REVISAR
    const docId = `review-${Date.now()}`;
    
    const reviewAnalysisData = {
      playerId,
      createdAt: new Date().toISOString(),
      videoUrl,
      shotType,
      status: 'review',
      analysisSummary: 'No se puede determinar el contenido del video. Se requiere revisión manual.',
      strengths: [],
      weaknesses: [],
      recommendations: ['Revisar manualmente el contenido del video.'],
      selectedKeyframes: [],
      keyframeAnalysis: 'No aplicable - Requiere revisión.',
      detailedChecklist: [],
    };

    try {
      if (adminDb) {
        const reviewAnalysisRef = adminDb.collection('analyses').doc(docId);
        await reviewAnalysisRef.set(reviewAnalysisData);
        console.log(`[LOCAL] Video marcado para revisión: ${docId}`);
      } else {
        console.log(`[LOCAL] Firebase Admin no disponible, solo simulando revisión: ${docId}`);
      }
    } catch (dbError) {
      console.error(`[LOCAL] Error guardando en DB:`, dbError);
      console.log(`[LOCAL] Continuando sin guardar en DB: ${docId}`);
    }

    return NextResponse.json({
      success: true,
      status: 'review',
      analysisId: docId,
      message: 'Video requiere revisión manual.',
      reason: 'No se puede determinar el contenido desde la URL.'
    });

  } catch (error: any) {
    console.error('[LOCAL] Error procesando video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
