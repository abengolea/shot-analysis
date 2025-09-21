import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, shotType = 'Lanzamiento de prueba' } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl es requerido' },
        { status: 400 }
      );
    }

    console.log(`[SIMPLE] Validando video: ${videoUrl}`);

    // Validar contenido del video basado en URL
    const url = videoUrl.toLowerCase();
    
    // Palabras clave para rechazar
    const rejectKeywords = ['party', 'fiesta', 'celebration', 'dance', 'social', 'wedding', 'birthday'];
    const isPartyVideo = rejectKeywords.some(keyword => url.includes(keyword));
    
    // Palabras clave para aprobar
    const approveKeywords = ['basketball', 'baloncesto', 'shot', 'tiro', 'hoop', 'court', 'player'];
    const isBasketballVideo = approveKeywords.some(keyword => url.includes(keyword));

    console.log(`[SIMPLE] Video de fiesta: ${isPartyVideo}, Video de baloncesto: ${isBasketballVideo}`);

    if (isPartyVideo) {
      return NextResponse.json({
        success: true,
        status: 'rejected',
        analysisId: `rejected-${Date.now()}`,
        message: 'Video rechazado: No es contenido de baloncesto válido.',
        reason: 'Video de fiesta/celebración detectado.',
        confidence: 0.9,
        detectedElements: rejectKeywords.filter(keyword => url.includes(keyword))
      });
    }

    if (isBasketballVideo) {
      return NextResponse.json({
        success: true,
        status: 'approved',
        analysisId: `approved-${Date.now()}`,
        message: 'Video aprobado: Contenido de baloncesto válido.',
        confidence: 0.8,
        detectedElements: approveKeywords.filter(keyword => url.includes(keyword))
      });
    }

    // Si no se puede determinar
    return NextResponse.json({
      success: true,
      status: 'review',
      analysisId: `review-${Date.now()}`,
      message: 'Video requiere revisión manual.',
      reason: 'No se puede determinar el contenido desde la URL.',
      confidence: 0.5,
      detectedElements: []
    });

  } catch (error: any) {
    console.error('[SIMPLE] Error validando video:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
