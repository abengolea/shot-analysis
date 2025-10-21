import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShotSimple } from '@/ai/flows/analyze-basketball-shot';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  let videoRef: any = null;
  
  try {
        // Verificar que el content-type sea correcto
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type debe ser multipart/form-data' }, { status: 400 });
    }
    
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const ageCategory = formData.get('ageCategory') as string || 'Sub-15';
    const playerLevel = formData.get('playerLevel') as string || 'Avanzado';
    const shotType = formData.get('shotType') as string || 'Lanzamiento de Tres';
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Convertir el archivo a buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    
    // Subir el video a Firebase Storage
    const videoId = `simple-test-${uuidv4()}`;
    const videoFileName = `test-videos/${videoId}.mp4`;
    
    console.log('📤 Subiendo video para detección simple...');
    videoRef = adminStorage.bucket().file(videoFileName);
    await videoRef.save(videoBuffer, {
      metadata: {
        contentType: videoFile.type,
        metadata: {
          originalName: videoFile.name,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Generar URL pública del video
    const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${videoFileName}`;
        // Ejecutar detección simple
        const analysis = await analyzeBasketballShotSimple({
      videoUrl,
      ageCategory: ageCategory as any,
      playerLevel,
      shotType,
      availableKeyframes: [],
    });
    
            console.log('⏱️ Duración:', analysis.verificacion_inicial?.duracion_video);

    return NextResponse.json({
      success: true,
      analysis,
      video_info: {
        duracion: analysis.verificacion_inicial?.duracion_video,
        tiros_detectados: analysis.verificacion_inicial?.tiros_detectados,
        archivo_original: videoFile.name,
        tamaño: videoFile.size
      }
    });

  } catch (error: any) {
    console.error('Error en detección simple:', error);
    return NextResponse.json(
      { error: 'Error en detección simple', details: error.message },
      { status: 500 }
    );
  } finally {
    // NO eliminar el video - la IA lo necesita para analizar
      }
}
