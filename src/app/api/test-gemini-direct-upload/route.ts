import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  console.log('🎬 Probando subida directa de video a Gemini...');
  
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'No se encontró GEMINI_API_KEY' }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    console.log('📁 Video recibido:', videoFile.name, 'Tamaño:', videoBuffer.length, 'bytes');

    // 1. PROCESAR VIDEO A 12 FPS (primeros 15 segundos)
        const videoId = `gemini-direct-${uuidv4()}`;
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

      // 2. SUBIR VIDEO DIRECTAMENTE A GEMINI
      console.log('📤 Subiendo video directamente a Gemini...');
      
      // Convertir video a base64
      const videoBase64 = processedVideoBuffer.toString('base64');
      const videoMimeType = 'video/mp4';
      
                  // 3. ENVIAR A GEMINI CON VIDEO EN BASE64
            const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: 'Responde EXACTAMENTE lo que ves en este video de baloncesto. Si no ves algo, di "no visible". No inventes nada.'
              },
              {
                inline_data: {
                  mime_type: videoMimeType,
                  data: videoBase64
                }
              }
            ]
          }]
        })
      });

      const geminiData = await geminiResponse.json();
            // 4. RESPUESTA CON RESULTADOS
      const response = {
        success: true,
        message: 'Subida directa de video a Gemini completada',
        video_info: {
          original_name: videoFile.name,
          original_size: videoFile.size,
          processed_size: processedVideoBuffer.length,
          base64_size: videoBase64.length,
          duration: '15.0s (limitado)',
          fps: 12,
          resolution: '1280x720',
          mime_type: videoMimeType
        },
        gemini_response: geminiData,
        processing_time: new Date().toISOString()
      };

      console.log('🎬 Subida directa finalizada');
      return NextResponse.json(response);

    } catch (ffmpegError) {
      console.error('❌ Error con FFmpeg:', ffmpegError);
      
      // Fallback: usar video original
      console.log('🔄 Fallback: usando video original...');
      
      // Convertir video original a base64
      const videoBase64 = videoBuffer.toString('base64');
      const videoMimeType = videoFile.type || 'video/mp4';
      
                  // Enviar a Gemini con video original
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: 'Responde EXACTAMENTE lo que ves en este video de baloncesto. Si no ves algo, di "no visible". No inventes nada.'
              },
              {
                inline_data: {
                  mime_type: videoMimeType,
                  data: videoBase64
                }
              }
            ]
          }]
        })
      });

      const geminiData = await geminiResponse.json();
      console.log('✅ Respuesta de Gemini recibida (fallback)');

      const response = {
        success: true,
        message: 'Subida directa de video a Gemini completada (fallback)',
        video_info: {
          original_name: videoFile.name,
          original_size: videoFile.size,
          processed_size: videoFile.size,
          base64_size: videoBase64.length,
          duration: 'Original (sin procesar)',
          fps: 'Original',
          resolution: 'Original',
          mime_type: videoMimeType
        },
        gemini_response: geminiData,
        processing_time: new Date().toISOString(),
        warning: 'El video no pudo ser procesado a 12 FPS. Se usó el video original.'
      };

      return NextResponse.json(response);
    }

  } catch (error: any) {
    console.error('❌ Error en subida directa:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en subida directa de video',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
















