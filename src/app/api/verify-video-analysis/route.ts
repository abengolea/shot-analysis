import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { verifyVideoAnalysis } from '@/ai/flows/verify-video-analysis';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
    }

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    console.log('📁 Video recibido:', videoFile.name, 'Tamaño:', videoBuffer.length, 'bytes');

    // 1. PROCESAR VIDEO A 12 FPS (primeros 15 segundos)
        const videoId = `verify-${uuidv4()}`;
    const processedVideoId = `12fps-verify-${uuidv4()}`;
    const processedVideoFileName = `test-videos/${processedVideoId}.mp4`;
    
    const tempVideoPath = `temp_${videoId}.mp4`;
    const tempProcessedPath = `temp_processed_${videoId}.mp4`;
    
    try {
      // Guardar video original temporalmente
      await fs.promises.writeFile(tempVideoPath, videoBuffer);
      console.log('📁 Video temporal guardado:', tempVideoPath);
      
      // Procesar video local con FFmpeg - SOLO PRIMEROS 15 SEGUNDOS A 12 FPS
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -t 15 -vf "fps=12,scale=1280:-1:flags=lanczos" -c:v libx264 -preset fast -crf 28 -b:v 500k -an -movflags +faststart "${tempProcessedPath}" -y`;
      console.log('🔧 Comando FFmpeg (15s máximo, 12 FPS):', ffmpegCommand);
    
      await execAsync(ffmpegCommand);
      
      // Leer el archivo procesado
      const processedVideoBuffer = await fs.promises.readFile(tempProcessedPath);
            // Limpiar archivos temporales
      await fs.promises.unlink(tempProcessedPath);
      await fs.promises.unlink(tempVideoPath);
      
      // 2. SUBIR VIDEO PROCESADO A FIREBASE
      console.log('📤 Subiendo video procesado a Firebase...');
      const videoRef = adminStorage.bucket().file(processedVideoFileName);
      await videoRef.save(Buffer.from(processedVideoBuffer, 'binary'), {
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            originalName: `${videoFile.name}_12fps`,
            uploadedAt: new Date().toISOString(),
            fps: 12,
            resolution: '1280x720'
          }
        }
      });
      
      const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${processedVideoFileName}`;
            // 3. VERIFICACIÓN DE ANÁLISIS
            const verificationResult = await verifyVideoAnalysis({
        videoUrl
      });
      
            // 4. RESPUESTA CON RESULTADOS DE VERIFICACIÓN
      const response = {
        success: true,
        message: 'Verificación de análisis completada',
        video_info: {
          original_name: videoFile.name,
          original_size: videoFile.size,
          processed_size: processedVideoBuffer.length,
          duration: '15.0s (limitado)',
          fps: 12,
          resolution: '1280x720',
          video_url: videoUrl
        },
        verification_result: verificationResult,
        processing_time: new Date().toISOString()
      };

            return NextResponse.json(response);

    } catch (ffmpegError) {
      console.error('❌ Error con FFmpeg:', ffmpegError);
      
      // Fallback: subir video original y verificar
      console.log('🔄 Fallback: subiendo video original...');
      const fallbackVideoId = `verify-fallback-${uuidv4()}`;
      const fallbackVideoFileName = `test-videos/${fallbackVideoId}.mp4`;
      
      const videoRef = adminStorage.bucket().file(fallbackVideoFileName);
      await videoRef.save(videoBuffer, {
        metadata: {
          contentType: videoFile.type,
          metadata: {
            originalName: videoFile.name,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${fallbackVideoFileName}`;
      console.log('✅ Video original subido (fallback):', videoUrl);
      
      // Verificación con video original
      const verificationResult = await verifyVideoAnalysis({
        videoUrl
      });
      
      const response = {
        success: true,
        message: 'Verificación de análisis completada (fallback)',
        video_info: {
          original_name: videoFile.name,
          original_size: videoFile.size,
          processed_size: videoFile.size,
          duration: 'Original (sin procesar)',
          fps: 'Original',
          resolution: 'Original',
          video_url: videoUrl
        },
        verification_result: verificationResult,
        processing_time: new Date().toISOString()
      };

      return NextResponse.json(response);
    }

  } catch (error: any) {
    console.error('❌ Error en verificación de análisis:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en verificación de análisis',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}




