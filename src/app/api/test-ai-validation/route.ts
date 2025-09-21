import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoContent } from '@/ai/flows/analyze-video-content';

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

    console.log(`[AI-VALIDATION] Analizando video con IA: ${videoUrl}`);

    // Usar la IA real para analizar el contenido del video
    const aiResult = await analyzeVideoContent({ 
      videoUrl, 
      shotType: shotType || 'Lanzamiento de prueba' 
    });

    console.log(`[AI-VALIDATION] Resultado de IA:`, aiResult);

    return NextResponse.json({
      success: true,
      aiAnalysis: aiResult,
      summary: {
        isBasketball: aiResult.isBasketballContent,
        confidence: Math.round(aiResult.confidence * 100),
        recommendation: aiResult.recommendation,
        reason: aiResult.reason
      }
    });

  } catch (error: any) {
    console.error('[AI-VALIDATION] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
        details: error.stack
      },
      { status: 500 }
    );
  }
}
