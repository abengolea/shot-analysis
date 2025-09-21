import { NextRequest, NextResponse } from 'next/server';
import { analyzeMultipleShots } from '@/ai/flows/analyze-multiple-shots';

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

    console.log(`[MULTIPLE-SHOTS] Analizando múltiples tiros en video: ${videoFile.name}`);

    // Convertir el archivo a Buffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    // Usar la IA para analizar múltiples tiros
    const aiResult = await analyzeMultipleShots({ 
      videoBuffer,
      videoUrl: videoFile.name,
      shotType: 'Lanzamiento de prueba' 
    });

    console.log(`[MULTIPLE-SHOTS] Resultado de IA:`, aiResult);

    return NextResponse.json({
      success: true,
      analysis: aiResult,
      summary: {
        totalShots: aiResult.totalShotsDetected,
        validShots: aiResult.validBasketballShots,
        recommendation: aiResult.overallRecommendation,
        confidence: Math.round(aiResult.overallConfidence * 100),
        summary: aiResult.summary
      }
    });

  } catch (error: any) {
    console.error('[MULTIPLE-SHOTS] Error:', error);
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
