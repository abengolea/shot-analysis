import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballPose } from '@/ai/flows/analyze-basketball-pose';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('video') as File;
    const shotType = formData.get('shotType') as string || 'jump-shot';
    const ageCategory = formData.get('ageCategory') as string || 'adult';

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
    }

    console.log('[API] Analizando video con OpenPose:', file.name);

    // Convertir archivo a buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Analizar con OpenPose
    const result = await analyzeBasketballPose({
      videoBuffer: buffer,
      videoUrl: file.name,
      shotType,
      ageCategory
    });

        return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API] Error en análisis de pose:', error?.message || error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error?.message 
    }, { status: 500 });
  }
}
