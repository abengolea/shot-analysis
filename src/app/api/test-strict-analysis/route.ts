import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoFramesStrict } from '@/ai/flows/analyze-video-frames-strict';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json(
        { error: 'Archivo de video es requerido' },
        { status: 400 }
      );
    }

    console.log(`[STRICT-ANALYSIS] Analizando video estricto: ${videoFile.name}`);

    // Convertir el archivo a Buffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    // Usar la IA para análisis estricto de frames
    const aiResult = await analyzeVideoFramesStrict({ 
      videoBuffer,
      videoUrl: videoFile.name
    });

    console.log(`[STRICT-ANALYSIS] Resultado de IA:`, aiResult);

    return NextResponse.json({
      success: true,
      analysis: aiResult,
      summary: {
        isBasketballContent: aiResult.isBasketballContent,
        confidence: Math.round(aiResult.confidence * 100),
        recommendation: aiResult.recommendation,
        reason: aiResult.reason,
        framesAnalyzed: aiResult.frameAnalysis.length
      }
    });

  } catch (error: any) {
    console.error('[STRICT-ANALYSIS] Error:', error);
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
