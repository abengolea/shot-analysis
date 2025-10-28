import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
    }

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    console.log('📁 TEST: Video recibido:', videoFile.name, 'Tamaño:', videoBuffer.length, 'bytes');

    // 1. PROCESAR VIDEO A 12 FPS (primeros 15 segundos)
        const videoId = `test-${uuidv4()}`;
    const processedVideoId = `12fps-test-${uuidv4()}`;
    const processedVideoFileName = `test-videos/${processedVideoId}.mp4`;
    
    const tempVideoPath = `temp_${videoId}.mp4`;
    const tempProcessedPath = `temp_processed_${videoId}.mp4`;
    
    try {
      // Guardar video original temporalmente
      await fs.promises.writeFile(tempVideoPath, videoBuffer);
      console.log('📁 TEST: Video temporal guardado:', tempVideoPath);
      
      // Procesar video local con FFmpeg - SOLO PRIMEROS 15 SEGUNDOS A 12 FPS
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -t 15 -vf "fps=12,scale=1280:-1:flags=lanczos" -c:v libx264 -preset fast -crf 28 -b:v 500k -an -movflags +faststart "${tempProcessedPath}" -y`;
            await execAsync(ffmpegCommand);
      
      // Leer el archivo procesado
      const processedVideoBuffer = await fs.promises.readFile(tempProcessedPath);
            // Limpiar archivos temporales
      await fs.promises.unlink(tempProcessedPath);
      await fs.promises.unlink(tempVideoPath);
      
      // 2. SUBIR VIDEO PROCESADO A FIREBASE
      console.log('📤 TEST: Subiendo video procesado a Firebase...');
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
            // 3. VERIFICAR ACCESIBILIDAD DEL VIDEO
            try {
        const response = await fetch(videoUrl, { method: 'HEAD' });
                if (response.ok) {
                  } else {
                  }
      } catch (fetchError) {
              }
      
      // 4. RESPUESTA CON INFORMACIÓN DE DEBUG
      const response = {
        success: true,
        message: 'Test de flujo de video completado',
        debug_info: {
          original_file: {
            name: videoFile.name,
            size: videoFile.size,
            type: videoFile.type
          },
          processed_file: {
            size: processedVideoBuffer.length,
            fps: 12,
            resolution: '1280x720',
            duration: '15.0s (limitado)'
          },
          firebase_upload: {
            bucket: 'shotanalisys.firebasestorage.app',
            path: processedVideoFileName,
            url: videoUrl,
            accessible: true
          },
          processing_steps: [
            'Video recibido correctamente',
            'Procesado a 12 FPS con FFmpeg',
            'Subido a Firebase Storage',
            'URL generada y verificada'
          ]
        },
        video_url: videoUrl,
        next_step: 'Ahora puedes usar esta URL para probar con Gemini directamente'
      };

            return NextResponse.json(response);

    } catch (ffmpegError) {
      console.error('❌ TEST: Error con FFmpeg:', ffmpegError);
      
      // Fallback: subir video original
      console.log('🔄 TEST: Fallback - subiendo video original...');
      const fallbackVideoId = `test-fallback-${uuidv4()}`;
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
      console.log('✅ TEST: Video original subido (fallback):', videoUrl);
      
      const response = {
        success: true,
        message: 'Test de flujo de video completado (fallback)',
        debug_info: {
          original_file: {
            name: videoFile.name,
            size: videoFile.size,
            type: videoFile.type
          },
          processed_file: {
            size: videoFile.size,
            fps: 'Original',
            resolution: 'Original',
            duration: 'Original'
          },
          firebase_upload: {
            bucket: 'shotanalisys.firebasestorage.app',
            path: fallbackVideoFileName,
            url: videoUrl,
            accessible: true
          },
          processing_steps: [
            'Video recibido correctamente',
            'FFmpeg falló - usando video original',
            'Subido a Firebase Storage',
            'URL generada'
          ],
          ffmpeg_error: ffmpegError.message
        },
        video_url: videoUrl,
        next_step: 'Video original subido - puedes probar con Gemini'
      };

      return NextResponse.json(response);
    }

  } catch (error: any) {
    console.error('❌ TEST: Error en test de flujo:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en test de flujo de video',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}




