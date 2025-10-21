import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShotSimple } from '@/ai/flows/analyze-basketball-shot';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let videoRef: any = null;
  let tempDir: string | null = null;
  
  try {
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
    
    // Subir el video original a Firebase Storage
    const videoId = `5fps-test-${uuidv4()}`;
    const videoFileName = `test-videos/${videoId}.mp4`;
    
    console.log('📤 Subiendo video original...');
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
        // Crear directorio temporal
    tempDir = path.join(process.cwd(), 'temp', videoId);
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Obtener duración real del video
        let realDuration = 0;
    try {
      const { stdout: durationOutput } = await execAsync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoUrl}"`
      );
      realDuration = parseFloat(durationOutput.trim());
      console.log('⏱️ Duración real del video:', realDuration, 'segundos');
    } catch (error) {
      console.warn('⚠️ No se pudo obtener duración con FFmpeg:', error);
      realDuration = 45; // Estimación
    }
    
    // Procesar video a 5 FPS
        const processedVideoPath = path.join(tempDir, 'video_5fps.mp4');
    
    try {
      // Comando FFmpeg corregido
      const ffmpegCommand = `ffmpeg -i "${videoUrl}" -vf "fps=5,scale=1280:720" -c:v libx264 -preset fast -crf 23 -an "${processedVideoPath}" -y`;
            const { stdout, stderr } = await execAsync(ffmpegCommand);
            if (stderr)       // Verificar que el archivo se creó
      const fileExists = await fs.promises.access(processedVideoPath).then(() => true).catch(() => false);
      if (!fileExists) {
        throw new Error('El archivo procesado no se creó');
      }
      
      const stats = await fs.promises.stat(processedVideoPath);
          } catch (error) {
      console.error('❌ Error procesando video:', error);
      throw new Error(`Error procesando video: ${error}`);
    }
    
    // Subir video procesado a Firebase
    const processedBuffer = await fs.promises.readFile(processedVideoPath);
    const processedVideoId = `5fps-processed-${uuidv4()}`;
    const processedVideoFileName = `test-videos/${processedVideoId}.mp4`;
    
    console.log('📤 Subiendo video procesado a 5 FPS...');
    const processedVideoRef = adminStorage.bucket().file(processedVideoFileName);
    await processedVideoRef.save(processedBuffer, {
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          originalName: `${videoFile.name}_5fps`,
          uploadedAt: new Date().toISOString(),
          fps: 5,
          resolution: '1280x720'
        }
      }
    });
    
    const processedVideoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${processedVideoFileName}`;
        // Analizar video procesado
    console.log('🤖 Analizando video procesado con IA...');
    const analysis = await analyzeBasketballShotSimple({
      videoUrl: processedVideoUrl,
      ageCategory: ageCategory as any,
      playerLevel,
      shotType,
      availableKeyframes: [],
    });
    
            console.log('⏱️ Duración detectada:', analysis.verificacion_inicial?.duracion_video);

    return NextResponse.json({
      success: true,
      video_info: {
        duracion_original: realDuration,
        duracion_detectada_ia: analysis.verificacion_inicial?.duracion_video,
        tiros_detectados: analysis.verificacion_inicial?.tiros_detectados,
        archivo_original: videoFile.name,
        tamaño_original: videoFile.size,
        fps_procesado: 5,
        resolucion_procesada: '1280x720'
      },
      analysis: analysis,
      resumen: {
        metodo: 'Video procesado a 5 FPS para reducir tokens',
        ventaja: 'Mantiene calidad visual pero reduce significativamente los tokens',
        duracion_original: realDuration,
        duracion_detectada: analysis.verificacion_inicial?.duracion_video,
        tiros_detectados: analysis.verificacion_inicial?.tiros_detectados,
        diferencia_tiempo: realDuration - parseFloat(analysis.verificacion_inicial?.duracion_video?.replace('s', '') || '0')
      }
    });

  } catch (error: any) {
    console.error('Error en análisis 5 FPS:', error);
    return NextResponse.json(
      { error: 'Error en análisis 5 FPS', details: error.message },
      { status: 500 }
    );
  } finally {
    // Limpiar archivos temporales
    try {
      if (tempDir) {
        await fs.promises.rmdir(tempDir, { recursive: true });
      }
      if (videoRef) {
        await videoRef.delete();
      }
    } catch (cleanupError) {
      console.warn('Error al limpiar archivos temporales:', cleanupError);
    }
  }
}
