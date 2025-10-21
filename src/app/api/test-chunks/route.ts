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
    const videoId = `chunks-test-${uuidv4()}`;
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
        let realDuration = 0;
    try {
      const { stdout: durationOutput } = await execAsync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoUrl}"`
      );
      realDuration = parseFloat(durationOutput.trim());
      console.log('⏱️ Duración real del video:', realDuration, 'segundos');
    } catch (error) {
      console.warn('⚠️ No se pudo obtener duración con FFmpeg:', error);
      // Estimar duración basada en el tamaño del archivo
      // 6.73 MB ≈ 30-45 segundos típicamente
      realDuration = 45; // Estimación conservadora
          }
    
    // Dividir video en chunks de 5 segundos (más pequeños)
    const chunkDuration = 5;
    const chunks = realDuration > 0 ? Math.ceil(realDuration / chunkDuration) : 10; // Fallback a 10 chunks
        const chunkResults = [];
    let totalShots = 0;
    
    for (let i = 0; i < chunks; i++) {
      const startTime = i * chunkDuration;
      const endTime = realDuration > 0 ? Math.min((i + 1) * chunkDuration, realDuration) : (i + 1) * chunkDuration;
      
      console.log(`🔍 Analizando chunk ${i + 1}/${chunks} (${startTime}s - ${endTime}s)...`);
      
      try {
        // Crear chunk de video
        const chunkFileName = `chunk_${i + 1}.mp4`;
        const chunkPath = path.join(tempDir, chunkFileName);
        
        await execAsync(
          `ffmpeg -i "${videoUrl}" -ss ${startTime} -t ${endTime - startTime} -c copy "${chunkPath}" -y`
        );
        
        // Subir chunk a Firebase
        const chunkBuffer = await fs.promises.readFile(chunkPath);
        const chunkId = `chunk-${videoId}-${i + 1}`;
        const chunkFileName_firebase = `test-videos/${chunkId}.mp4`;
        
        const chunkRef = adminStorage.bucket().file(chunkFileName_firebase);
        await chunkRef.save(chunkBuffer, {
          metadata: {
            contentType: 'video/mp4',
            metadata: {
              chunk: i + 1,
              startTime,
              endTime
            }
          }
        });
        
        const chunkUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${chunkFileName_firebase}`;
        
        // Analizar chunk
        try {
          const analysis = await analyzeBasketballShotSimple({
            videoUrl: chunkUrl,
            ageCategory: ageCategory as any,
            playerLevel,
            shotType,
            availableKeyframes: [],
          });
          
          const chunkShots = analysis.verificacion_inicial?.tiros_detectados || 0;
          totalShots += chunkShots;
          
          chunkResults.push({
            chunk: i + 1,
            startTime,
            endTime,
            shots: chunkShots,
            duration: analysis.verificacion_inicial?.duracion_video || 'N/A',
            analysis: analysis.analysisSummary,
            success: true
          });
          
                  } catch (chunkError: any) {
          console.error(`❌ Error en chunk ${i + 1}:`, chunkError.message);
          chunkResults.push({
            chunk: i + 1,
            startTime,
            endTime,
            shots: 0,
            duration: 'Error',
            analysis: `Error: ${chunkError.message}`,
            success: false,
            error: chunkError.message
          });
        }
        
        // Limpiar chunk temporal
        await fs.promises.unlink(chunkPath);
        await chunkRef.delete();
        
      } catch (error) {
        console.error(`❌ Error en chunk ${i + 1}:`, error);
        chunkResults.push({
          chunk: i + 1,
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
        tiros_detectados_total: totalShots,
        chunks_analizados: chunks,
        archivo_original: videoFile.name,
        tamaño: videoFile.size
      },
      chunks: chunkResults,
      resumen: {
        metodo: 'Análisis por chunks de 5 segundos',
        ventaja: 'Evita límites de procesamiento de IA',
        total_tiros: totalShots,
        duracion_real: realDuration,
        chunks_exitosos: chunkResults.filter(c => c.shots > 0).length,
        chunks_con_error: chunkResults.filter(c => c.shots === 0).length
      }
    });

  } catch (error: any) {
    console.error('Error en análisis por chunks:', error);
    return NextResponse.json(
      { error: 'Error en análisis por chunks', details: error.message },
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
