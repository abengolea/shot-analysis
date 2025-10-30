import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { adminDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const userId = formData.get('userId') as string;
    const playerId = formData.get('playerId') as string;
    const playerName = formData.get('playerName') as string;
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No se proporcionó archivo de video' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'No se proporcionó userId' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'No se encontró GEMINI_API_KEY' }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    console.log('📁 Video recibido:', videoFile.name, 'Tamaño:', videoBuffer.length, 'bytes');

    // 1. PROCESAR VIDEO A 12 FPS (primeros 15 segundos)
        const videoId = `analysis-${uuidv4()}`;
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

      // 2. SUBIR VIDEO A FIREBASE STORAGE
      console.log('📤 Subiendo video a Firebase Storage...');
      const videoFileName = `video-analysis/${userId}/${videoId}.mp4`;
      const videoRef = adminStorage.bucket().file(videoFileName);
      
      await videoRef.save(Buffer.from(processedVideoBuffer, 'binary'), {
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            originalName: videoFile.name,
            userId: userId,
            playerId: playerId || '',
            playerName: playerName || '',
            uploadedAt: new Date().toISOString(),
            fps: 12,
            resolution: '1280x720',
            analysisId: videoId
          }
        }
      });

      const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${videoFileName}`;
            // 3. ANALIZAR VIDEO CON GEMINI
            const videoBase64 = processedVideoBuffer.toString('base64');
      const videoMimeType = 'video/mp4';
      
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
            // 4. GUARDAR ANÁLISIS EN FIRESTORE
            const analysisData = {
        id: videoId,
        userId: userId,
        playerId: playerId || null,
        playerName: playerName || null,
        videoUrl: videoUrl,
        videoFileName: videoFileName,
        originalFileName: videoFile.name,
        analysis: geminiData,
        metadata: {
          originalSize: videoFile.size,
          processedSize: processedVideoBuffer.length,
          base64Size: videoBase64.length,
          duration: '15.0s (limitado)',
          fps: 12,
          resolution: '1280x720',
          mimeType: videoMimeType
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Guardar en Firestore
      await adminDb.collection('video-analysis').doc(videoId).set(analysisData);
            // 5. RESPUESTA CON RESULTADOS
      const response = {
        success: true,
        message: 'Video y análisis guardados en historial',
        analysisId: videoId,
        videoUrl: videoUrl,
        analysis: geminiData,
        metadata: {
          userId: userId,
          playerId: playerId || null,
          playerName: playerName || null,
          originalFileName: videoFile.name,
          processedSize: processedVideoBuffer.length,
          duration: '15.0s (limitado)',
          fps: 12,
          resolution: '1280x720'
        },
        createdAt: new Date().toISOString()
      };

            return NextResponse.json(response);

    } catch (ffmpegError) {
      console.error('❌ Error con FFmpeg:', ffmpegError);
      
      // Fallback: usar video original
      console.log('🔄 Fallback: usando video original...');
      
      // Subir video original a Firebase Storage
      const videoFileName = `video-analysis/${userId}/${videoId}.mp4`;
      const videoRef = adminStorage.bucket().file(videoFileName);
      
      await videoRef.save(videoBuffer, {
        metadata: {
          contentType: videoFile.type,
          metadata: {
            originalName: videoFile.name,
            userId: userId,
            playerId: playerId || '',
            playerName: playerName || '',
            uploadedAt: new Date().toISOString(),
            analysisId: videoId
          }
        }
      });

      const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${videoFileName}`;
            // Analizar video original con Gemini
      const videoBase64 = videoBuffer.toString('base64');
      const videoMimeType = videoFile.type || 'video/mp4';
      
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
      console.log('✅ Análisis de Gemini completado (fallback)');

      // Guardar análisis en Firestore
      const analysisData = {
        id: videoId,
        userId: userId,
        playerId: playerId || null,
        playerName: playerName || null,
        videoUrl: videoUrl,
        videoFileName: videoFileName,
        originalFileName: videoFile.name,
        analysis: geminiData,
        metadata: {
          originalSize: videoFile.size,
          processedSize: videoFile.size,
          base64Size: videoBase64.length,
          duration: 'Original (sin procesar)',
          fps: 'Original',
          resolution: 'Original',
          mimeType: videoMimeType
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await adminDb.collection('video-analysis').doc(videoId).set(analysisData);
      console.log('✅ Análisis guardado en Firestore (fallback)');

      const response = {
        success: true,
        message: 'Video y análisis guardados en historial (fallback)',
        analysisId: videoId,
        videoUrl: videoUrl,
        analysis: geminiData,
        metadata: {
          userId: userId,
          playerId: playerId || null,
          playerName: playerName || null,
          originalFileName: videoFile.name,
          processedSize: videoFile.size,
          duration: 'Original (sin procesar)',
          fps: 'Original',
          resolution: 'Original'
        },
        createdAt: new Date().toISOString(),
        warning: 'El video no pudo ser procesado a 12 FPS. Se usó el video original.'
      };

      return NextResponse.json(response);
    }

  } catch (error: any) {
    console.error('❌ Error en guardado de historial:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en guardado de historial',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}






