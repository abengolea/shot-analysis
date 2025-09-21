import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoFrames } from '@/ai/flows/analyze-video-frames';

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

    console.log(`[REAL-VALIDATION] Analizando video real: ${videoFile.name}`);

    // Convertir el archivo a Buffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    // Usar la IA real para analizar frames del video
    const aiResult = await analyzeVideoFrames({ 
      videoBuffer,
      videoUrl: videoFile.name,
      shotType: 'Lanzamiento de prueba' 
    });

    console.log(`[REAL-VALIDATION] Resultado de IA:`, aiResult);

    return NextResponse.json({
      success: true,
      aiAnalysis: aiResult,
      summary: {
        isBasketball: aiResult.isBasketballContent,
        confidence: Math.round(aiResult.confidence * 100),
        recommendation: aiResult.recommendation,
        reason: aiResult.reason,
        analyzedFrames: aiResult.analyzedFrames
      }
    });

  } catch (error: any) {
    console.error('[REAL-VALIDATION] Error:', error);
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
