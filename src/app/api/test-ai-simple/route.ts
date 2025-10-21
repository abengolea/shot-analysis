import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShot } from '@/ai/flows/analyze-basketball-shot';

export async function GET(request: NextRequest) {
  try {
        // Datos de prueba simples
    const testData = {
      videoUrl: "https://storage.googleapis.com/shotanalisys.firebasestorage.app/test-videos/sample-basketball-shot.mp4",
      ageCategory: "Sub-15" as const,
      playerLevel: "Intermedio",
      shotType: "Tiro Libre",
      availableKeyframes: [
        { index: 0, timestamp: 1.0, description: "Preparación" },
        { index: 1, timestamp: 2.0, description: "Ascenso" },
        { index: 2, timestamp: 3.0, description: "Set point" },
        { index: 3, timestamp: 4.0, description: "Liberación" }
      ],
      promptConfig: {
        intro: "Análisis básico de tiro",
        fluidezHelp: "Evalúa fluidez general",
        setPointHelp: "Observa set point básico"
      }
    };

        const startTime = Date.now();
    
    const result = await analyzeBasketballShot(testData);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
        return NextResponse.json({
      success: true,
      duration: duration,
      result: {
        verificacion_inicial: result.verificacion_inicial,
        analysisSummary: result.analysisSummary,
        score_global: result.resumen_evaluacion.score_global,
        parametros_evaluados: result.resumen_evaluacion.parametros_evaluados
      }
    });

  } catch (error: any) {
    console.error('❌ Error en prueba de IA:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}

