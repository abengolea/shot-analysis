import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Convertir el archivo a buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    
    // Subir el video a Firebase Storage
    const videoId = `verify-${uuidv4()}`;
    const videoFileName = `test-videos/${videoId}.mp4`;
    
    console.log('📤 Subiendo video para verificación...');
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
        // Obtener información REAL del video con FFmpeg
        let realDuration = 0;
    let width = 0;
    let height = 0;
    let fps = 'unknown';
    let fileSizeBytes = videoFile.size;
    let bitrate = 'unknown';
    
    try {
      // Duración
      const { stdout: durationOutput } = await execAsync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoUrl}"`
      );
      realDuration = parseFloat(durationOutput.trim()) || 0;
      
      // Resolución
      const { stdout: resolutionOutput } = await execAsync(
        `ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoUrl}"`
      );
      const resolutionParts = resolutionOutput.trim().split(',');
      width = parseInt(resolutionParts[0]) || 0;
      height = parseInt(resolutionParts[1]) || 0;
      
      // FPS
      const { stdout: fpsOutput } = await execAsync(
        `ffprobe -v quiet -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "${videoUrl}"`
      );
      fps = fpsOutput.trim() || 'unknown';
      
      // Bitrate
      const { stdout: bitrateOutput } = await execAsync(
        `ffprobe -v quiet -show_entries format=bit_rate -of csv=p=0 "${videoUrl}"`
      );
      bitrate = bitrateOutput.trim() || 'unknown';
      
    } catch (ffmpegError) {
      console.warn('⚠️ Error con FFmpeg, usando información básica:', ffmpegError);
      // Usar información básica del archivo
      realDuration = 0; // No podemos obtener duración sin FFmpeg
    }
    
        console.log('⏱️ Duración real:', realDuration, 'segundos');
    console.log('📐 Resolución:', width, 'x', height);
    console.log('🎬 FPS:', fps);
        console.log('🔗 Bitrate:', bitrate);

    return NextResponse.json({
      success: true,
      video_info: {
        duracion_real_segundos: realDuration,
        duracion_real_minutos: (realDuration / 60).toFixed(2),
        resolucion: `${width}x${height}`,
        fps: fps,
        tamaño_bytes: fileSizeBytes,
        tamaño_mb: (fileSizeBytes / 1024 / 1024).toFixed(2),
        bitrate: bitrate,
        archivo_original: videoFile.name,
        url_video: videoUrl
      },
      comparacion: {
        duracion_ia_vs_real: `IA detectó: 7.5s vs Real: ${realDuration.toFixed(1)}s`,
        diferencia: `${(realDuration - 7.5).toFixed(1)}s de diferencia`,
        porcentaje_error: `${(((realDuration - 7.5) / realDuration) * 100).toFixed(1)}% de error`
      }
    });

  } catch (error: any) {
    console.error('Error en verificación de video:', error);
    return NextResponse.json(
      { error: 'Error en verificación de video', details: error.message },
      { status: 500 }
    );
  } finally {
    // NO eliminar el video - lo necesitamos para análisis
      }
}
