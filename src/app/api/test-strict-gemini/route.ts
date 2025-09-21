import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballStrict } from '@/ai/flows/analyze-basketball-strict';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, testType } = await request.json();

    if (!videoUrl) {
      return NextResponse.json({ error: 'No se proporcionó URL de video' }, { status: 400 });
    }

    console.log('[API] Probando análisis estricto de Gemini:', videoUrl);
    console.log('[API] Tipo de prueba:', testType);

    // Análisis estricto anti-alucinación
    const result = await analyzeBasketballStrict({
      videoUrl,
      testType
    });

    console.log('[API] Resultado del análisis estricto:', result.success ? 'Éxito' : 'Error');

    // Determinar si está alucinando basado en el resultado
    const isHallucinating = detectHallucination(result, testType);

    return NextResponse.json({
      ...result,
      isHallucinating,
      testType,
      videoUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[API] Error en análisis estricto:', error?.message || error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error?.message 
    }, { status: 500 });
  }
}

/**
 * Detecta si Gemini está alucinando basado en el resultado
 */
function detectHallucination(result: any, testType: string): boolean {
  if (!result.success) return false;

  // Para videos de fiesta, si dice que ve elementos de baloncesto claramente, está alucinando
  if (testType === 'party-video') {
    const hasBasketballElements = 
      result.visibility?.hoopVisible === 'sí' ||
      result.visibility?.ballVisible === 'sí' ||
      result.preparation?.handPosition === 'visible' ||
      result.execution?.playerJumps === 'sí' ||
      result.result?.shotOutcome !== 'no_visible';

    return hasBasketballElements;
  }

  // Para videos de baloncesto, si dice que no ve nada, puede estar siendo demasiado estricto
  if (testType === 'basketball-video') {
    const seesNothing = 
      result.visibility?.playerVisible === 'no' &&
      result.visibility?.hoopVisible === 'no' &&
      result.visibility?.ballVisible === 'no';

    return seesNothing;
  }

  return false;
}
