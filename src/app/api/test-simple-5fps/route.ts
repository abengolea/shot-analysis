import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShotSimple } from '@/ai/flows/analyze-basketball-shot';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let videoRef: any = null;
  
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
    
    // 1. PROCESAR PRIMERO a 5 FPS localmente
        const videoId = `simple-5fps-${uuidv4()}`;
    const processedVideoId = `5fps-processed-${uuidv4()}`;
    const processedVideoFileName = `test-videos/${processedVideoId}.mp4`;
    
    try {
      // Guardar video original temporalmente
      const tempVideoPath = `temp_${videoId}.mp4`;
      await fs.promises.writeFile(tempVideoPath, videoBuffer);
      console.log('📁 Video temporal guardado:', tempVideoPath);
      
        // Procesar video local con FFmpeg (escribir a archivo temporal) - REDUCIR TAMAÑO
        const tempProcessedPath = `temp_processed_${videoId}.mp4`;
        const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -vf "fps=5,scale=640:480" -c:v libx264 -preset fast -crf 28 -b:v 500k -an -movflags +faststart "${tempProcessedPath}" -y`;
                await execAsync(ffmpegCommand);
        
        // Leer el archivo procesado
        const processedVideoBuffer = await fs.promises.readFile(tempProcessedPath);
                // Limpiar archivos temporales
        await fs.promises.unlink(tempProcessedPath);
        await fs.promises.unlink(tempVideoPath);
      
      // 2. SUBIR UNA SOLA VEZ el video procesado
      console.log('📤 Subiendo video procesado a Firebase...');
      const processedVideoRef = adminStorage.bucket().file(processedVideoFileName);
      await processedVideoRef.save(Buffer.from(processedVideoBuffer, 'binary'), {
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            originalName: `${videoFile.name}_5fps`,
            uploadedAt: new Date().toISOString(),
            fps: 5,
            resolution: '640x480'
          }
        }
      });
      
      const processedVideoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${processedVideoFileName}`;
            // 3. ANALIZAR el video procesado
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
          duracion_detectada: analysis.verificacion_inicial?.duracion_video,
          tiros_detectados: analysis.verificacion_inicial?.tiros_detectados
        }
      });

    } catch (ffmpegError) {
      console.error('❌ Error con FFmpeg:', ffmpegError);
      
      // Fallback: subir video original y analizar
      console.log('🔄 Fallback: subiendo video original...');
      const fallbackVideoId = `simple-5fps-fallback-${uuidv4()}`;
      const fallbackVideoFileName = `test-videos/${fallbackVideoId}.mp4`;
      
      const fallbackVideoRef = adminStorage.bucket().file(fallbackVideoFileName);
      await fallbackVideoRef.save(videoBuffer, {
        metadata: {
          contentType: videoFile.type,
          metadata: {
            originalName: videoFile.name,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      const fallbackVideoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${fallbackVideoFileName}`;
      console.log('✅ Video original subido (fallback):', fallbackVideoUrl);
      
      const analysis = await analyzeBasketballShotSimple({
        videoUrl: fallbackVideoUrl,
        ageCategory: ageCategory as any,
        playerLevel,
        shotType,
        availableKeyframes: [],
      });
      
      return NextResponse.json({
        success: true,
        video_info: {
          duracion_detectada_ia: analysis.verificacion_inicial?.duracion_video,
          tiros_detectados: analysis.verificacion_inicial?.tiros_detectados,
          archivo_original: videoFile.name,
          tamaño_original: videoFile.size,
          fps_procesado: 'original',
          resolucion_procesada: 'original'
        },
        analysis: analysis,
        resumen: {
          metodo: 'Video original (FFmpeg falló)',
          ventaja: 'Análisis del video original sin procesamiento',
          duracion_detectada: analysis.verificacion_inicial?.duracion_video,
          tiros_detectados: analysis.verificacion_inicial?.tiros_detectados,
          warning: 'FFmpeg falló, usando video original'
        }
      });
    }

  } catch (error: any) {
    console.error('Error en análisis simple 5 FPS:', error);
    return NextResponse.json(
      { error: 'Error en análisis simple 5 FPS', details: error.message },
      { status: 500 }
    );
  } finally {
    // NO eliminar el video - lo necesitamos para análisis
      }
}
