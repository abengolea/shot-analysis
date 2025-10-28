import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { analyzeBasketballShotSimple } from '@/ai/flows/analyze-basketball-shot';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No se proporcionó video' }, { status: 400 });
    }

    // Convertir a buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const videoId = uuidv4();
    const videoFileName = `test-videos/simple-direct-${videoId}.mp4`;

    // Subir video original a Firebase
    const videoRef = adminStorage.bucket().file(videoFileName);
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
        // Analizar video original directamente
    console.log('🤖 Analizando video con IA...');
    const analysis = await analyzeBasketballShotSimple({
      videoUrl: videoUrl,
      ageCategory: 'youth',
      playerLevel: 'beginner',
      shotType: 'free_throw',
      availableKeyframes: [],
    });
    
            console.log('⏱️ Duración detectada:', analysis.verificacion_inicial?.duracion_video);

    return NextResponse.json({
      success: true,
      video_info: {
        duracion_detectada_ia: analysis.verificacion_inicial?.duracion_video,
        tiros_detectados: analysis.verificacion_inicial?.tiros_detectados,
        archivo_original: videoFile.name,
        tamaño_archivo: videoBuffer.length,
        resumen: analysis.analysisSummary,
        fortalezas: analysis.strengths,
        debilidades: analysis.weaknesses,
        recomendaciones: analysis.recommendations,
        checklist_detallado: analysis.detailedChecklist,
        resumen_evaluacion: analysis.resumen_evaluacion,
        caracteristicas_unicas: analysis.caracteristicas_unicas
      },
      analysis: analysis
    });

  } catch (error) {
    console.error('Error en análisis directo:', error);
    return NextResponse.json({ 
      error: 'Error en análisis directo', 
      details: error instanceof Error ? error.message : 'Error desconocido' 
    }, { status: 500 });
  }
}





