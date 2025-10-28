import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const execAsync = promisify(exec);

const VerifyVideoDirectInputSchema = z.object({
  videoUrl: z.string().describe('URL of the basketball shot video.'),
});

const VerifyVideoDirectOutputSchema = z.object({
  respuesta_directa: z.string().describe('Descripción directa de lo que se ve en el video'),
  confirma_video: z.boolean().describe('Confirma que está viendo el video real'),
  detalles_especificos: z.array(z.string()).describe('3 detalles específicos únicos del video'),
  elementos_visibles: z.array(z.string()).describe('Elementos que realmente se ven'),
  elementos_no_visibles: z.array(z.string()).describe('Elementos que NO se ven'),
  duracion_real: z.string().describe('Duración real del video'),
  angulo_real: z.string().describe('Ángulo real de la cámara'),
  vestimenta_real: z.string().describe('Vestimenta real del jugador'),
  canasta_real: z.string().describe('Si se ve o no la canasta'),
  entorno_real: z.string().describe('Entorno real visible')
});

export type VerifyVideoDirectInput = z.infer<typeof VerifyVideoDirectInputSchema>;
export type VerifyVideoDirectOutput = z.infer<typeof VerifyVideoDirectOutputSchema>;

const verifyVideoDirectPrompt = ai.definePrompt({
  name: 'verifyVideoDirectPrompt',
  input: {schema: VerifyVideoDirectInputSchema},
  output: {schema: VerifyVideoDirectOutputSchema},
  prompt: `Responde EXACTAMENTE lo que ves en este video. Si no ves algo, di "no visible". No inventes nada.

Video: {{videoUrl}}`
});

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
        const videoId = `verify-direct-${uuidv4()}`;
    const processedVideoId = `12fps-verify-direct-${uuidv4()}`;
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
            // 3. VERIFICACIÓN DIRECTA
            const verificationResult = await verifyVideoDirectPrompt({
        videoUrl
      });
      
            // 4. RESPUESTA CON RESULTADOS
      const response = {
        success: true,
        message: 'Verificación directa completada',
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
      const fallbackVideoId = `verify-direct-fallback-${uuidv4()}`;
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
      const verificationResult = await verifyVideoDirectPrompt({
        videoUrl
      });
      
      const response = {
        success: true,
        message: 'Verificación directa completada (fallback)',
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
    console.error('❌ Error en verificación directa:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en verificación directa',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}




