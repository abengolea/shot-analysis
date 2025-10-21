import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoReal } from '@/lib/gemini-video-real';

export async function POST(request: NextRequest) {
  // Configurar timeout para análisis largos
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 5 minutes')), 5 * 60 * 1000);
  });

  try {
    // Usar Promise.race para aplicar timeout
    const result = await Promise.race([
      performVideoRealTest(request),
      timeoutPromise
    ]);
    
    return result;
  } catch (error) {
    console.error('❌ Error en test de video real:', error);
    return NextResponse.json(
      { 
        error: 'Error en la verificación', 
        details: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    );
  }
}

async function performVideoRealTest(request: NextRequest) {
  const formData = await request.formData();
  const videoFile1 = formData.get('video1') as File;
  const videoFile2 = formData.get('video2') as File;
  const videoFile3 = formData.get('video3') as File;

  if (!videoFile1) {
    return NextResponse.json({ error: 'Video 1 (lateral) requerido' }, { status: 400 });
  }

    console.log(`📁 Video 1: ${videoFile1.name} (${(videoFile1.size / 1024 / 1024).toFixed(2)} MB)`);
  if (videoFile2) {
    console.log(`📁 Video 2: ${videoFile2.name} (${(videoFile2.size / 1024 / 1024).toFixed(2)} MB)`);
  }
  if (videoFile3) {
    console.log(`📁 Video 3: ${videoFile3.name} (${(videoFile3.size / 1024 / 1024).toFixed(2)} MB)`);
  }

  // Convertir videos a buffer
  const videoBuffer1 = Buffer.from(await videoFile1.arrayBuffer());
  const videoBuffer2 = videoFile2 ? Buffer.from(await videoFile2.arrayBuffer()) : null;
  const videoBuffer3 = videoFile3 ? Buffer.from(await videoFile3.arrayBuffer()) : null;
  
  // Análisis optimizado para verificación
    const result = await analyzeVideoReal(
    videoBuffer1,
    videoFile1.name,
    videoBuffer2,
    videoFile2?.name,
    videoBuffer3,
    videoFile3?.name
  );

    const videoCount = [videoFile1, videoFile2, videoFile3].filter(Boolean).length;
  return NextResponse.json({
    success: true,
    message: videoCount > 1 ? `Análisis multi-cámara (${videoCount} videos) completado` : 'Verificación de video real completada',
    ...result
  });
}
