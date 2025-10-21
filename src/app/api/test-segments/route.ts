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
    
    // Subir el video a Firebase Storage
    const videoId = `segments-test-${uuidv4()}`;
    const videoFileName = `test-videos/${videoId}.mp4`;
    
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
    
    // Obtener duración real del video con FFmpeg
        const { stdout: durationOutput } = await execAsync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoUrl}"`
    );
    const realDuration = parseFloat(durationOutput.trim());
    console.log('⏱️ Duración real del video:', realDuration, 'segundos');
    
    // Dividir video en segmentos de 10 segundos
    const segmentDuration = 10;
    const segments = Math.ceil(realDuration / segmentDuration);
        const segmentResults = [];
    let totalShots = 0;
    
    for (let i = 0; i < segments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, realDuration);
      
      console.log(`🔍 Analizando segmento ${i + 1}/${segments} (${startTime}s - ${endTime}s)...`);
      
      // Crear segmento de video
      const segmentFileName = `segment_${i + 1}.mp4`;
      const segmentPath = path.join(tempDir, segmentFileName);
      
      await execAsync(
        `ffmpeg -i "${videoUrl}" -ss ${startTime} -t ${endTime - startTime} -c copy "${segmentPath}" -y`
      );
      
      // Subir segmento a Firebase
      const segmentBuffer = await fs.promises.readFile(segmentPath);
      const segmentId = `segment-${videoId}-${i + 1}`;
      const segmentFileName_firebase = `test-videos/${segmentId}.mp4`;
      
      const segmentRef = adminStorage.bucket().file(segmentFileName_firebase);
      await segmentRef.save(segmentBuffer, {
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            segment: i + 1,
            startTime,
            endTime
          }
        }
      });
      
      const segmentUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${segmentFileName_firebase}`;
      
      // Analizar segmento
      try {
        const analysis = await analyzeBasketballShotSimple({
          videoUrl: segmentUrl,
          ageCategory: ageCategory as any,
          playerLevel,
          shotType,
          availableKeyframes: [],
        });
        
        const segmentShots = analysis.verificacion_inicial?.tiros_detectados || 0;
        totalShots += segmentShots;
        
        segmentResults.push({
          segment: i + 1,
          startTime,
          endTime,
          shots: segmentShots,
          duration: analysis.verificacion_inicial?.duracion_video || 'N/A',
          analysis: analysis.analysisSummary
        });
        
                // Limpiar segmento temporal
        await fs.promises.unlink(segmentPath);
        await segmentRef.delete();
        
      } catch (error) {
        console.error(`❌ Error en segmento ${i + 1}:`, error);
        segmentResults.push({
          segment: i + 1,
          startTime,
          endTime,
          shots: 0,
          duration: 'Error',
          analysis: 'Error en análisis'
        });
      }
    }

            return NextResponse.json({
      success: true,
      video_info: {
        duracion_real: realDuration,
        duracion_detectada_ia: 'N/A',
        tiros_detectados_total: totalShots,
        segmentos_analizados: segments,
        archivo_original: videoFile.name,
        tamaño: videoFile.size
      },
      segmentos: segmentResults,
      resumen: {
        metodo: 'Análisis por segmentos de 10 segundos',
        ventaja: 'Detecta tiros en videos largos',
        total_tiros: totalShots,
        duracion_real: realDuration
      }
    });

  } catch (error: any) {
    console.error('Error en análisis por segmentos:', error);
    return NextResponse.json(
      { error: 'Error en análisis por segmentos', details: error.message },
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

