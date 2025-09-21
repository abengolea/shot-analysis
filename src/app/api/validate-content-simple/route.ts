import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, shotType } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl es requerido' },
        { status: 400 }
      );
    }

    console.log(`[VALIDACIÓN] Validando contenido: ${videoUrl}`);
    
    // Validación básica pero efectiva
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

    let result;
    
    if (isPartyVideo) {
      result = {
        isBasketballContent: false,
        confidence: 0.95,
        detectedElements: [],
        reason: 'Video de fiesta/celebración detectado. No contiene contenido de baloncesto válido.',
        recommendation: 'REJECT'
      };
    } else if (isBasketballVideo) {
      result = {
        isBasketballContent: true,
        confidence: 0.9,
        detectedElements: ['URL sugiere contenido de baloncesto'],
        reason: 'URL sugiere contenido de baloncesto válido.',
        recommendation: 'PROCEED'
      };
    } else {
      result = {
        isBasketballContent: false,
        confidence: 0.7,
        detectedElements: [],
        reason: 'No se puede determinar el contenido del video desde la URL. Se requiere revisión manual.',
        recommendation: 'REVIEW'
      };
    }

    console.log(`[VALIDACIÓN] Resultado:`, result);

    return NextResponse.json({
      success: true,
      validation: result,
    });
  } catch (error: any) {
    console.error('[VALIDACIÓN] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
