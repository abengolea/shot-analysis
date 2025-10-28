import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoSimplePrompt } from '@/utils/gemini-simple-prompt';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extraer archivos de video
    const videoFile1 = formData.get('videoFile1') as File;
    const videoFile2 = formData.get('videoFile2') as File | null;
    const videoFile3 = formData.get('videoFile3') as File | null;
    
    // Extraer configuración
    const ageCategory = formData.get('ageCategory') as string || 'adult';
    const playerLevel = formData.get('playerLevel') as string || 'intermediate';
    const shotType = formData.get('shotType') as string || 'jump_shot';

    if (!videoFile1) {
      return NextResponse.json({ error: 'Video 1 es requerido' }, { status: 400 });
    }

        console.log('📁 Archivos recibidos:', {
      video1: videoFile1?.name,
      video2: videoFile2?.name || 'N/A',
      video3: videoFile3?.name || 'N/A'
    });

    // Convertir archivos a buffers
    const videoBuffer1 = Buffer.from(await videoFile1.arrayBuffer());
    const videoBuffer2 = videoFile2 ? Buffer.from(await videoFile2.arrayBuffer()) : null;
    const videoBuffer3 = videoFile3 ? Buffer.from(await videoFile3.arrayBuffer()) : null;

    // Llamar a la función de análisis con prompt simplificado
    const analysisResult = await analyzeVideoSimplePrompt(
      videoBuffer1,
      videoFile1.name,
      videoBuffer2,
      videoFile2?.name,
      videoBuffer3,
      videoFile3?.name,
      ageCategory,
      playerLevel,
      shotType
    );

        return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('❌ Error en test-simple-prompt:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}





