import { NextRequest, NextResponse } from 'next/server';
import { validateBasketballContent } from '@/ai/flows/validate-basketball-content';

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

    console.log(`[TEST] Validando contenido: ${videoUrl}`);
    
    const result = await validateBasketballContent({
      videoUrl,
      shotType: shotType || 'Lanzamiento de prueba',
    });

    console.log(`[TEST] Resultado de validación:`, result);

    return NextResponse.json({
      success: true,
      validation: result,
    });
  } catch (error: any) {
    console.error('[TEST] Error en validación:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
