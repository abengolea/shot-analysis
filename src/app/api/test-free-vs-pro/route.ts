import { NextRequest, NextResponse } from 'next/server';
import { analyzeBasketballShot, analyzeBasketballShotTest, analyzeBasketballShotTestWithEvidence, analyzeBasketballShotTestPage } from '@/ai/flows/analyze-basketball-shot';
import { extractKeyframesFromBuffer, extractFramesFromMultipleShots } from '@/lib/ffmpeg';
import { getVideoDurationSecondsFromBuffer } from '@/lib/ffmpeg';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let videoRef: any = null;
  let videoUrl: string = '';
  
  try {
        console.log('🔍 Content-Type:', request.headers.get('content-type'));
    
    // Verificar que el content-type sea correcto
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      console.error('❌ Content-Type incorrecto:', contentType);
      return NextResponse.json({ error: 'Content-Type debe ser multipart/form-data' }, { status: 400 });
    }
    
        const formData = await request.formData();
        console.log('🔍 FormData keys:', Array.from(formData.keys()));
    
    const videoFile = formData.get('video') as File;
    const ageCategory = formData.get('ageCategory') as string;
    const playerLevel = formData.get('playerLevel') as string;
    const shotType = formData.get('shotType') as string;
    
    console.log('🔍 Video file:', videoFile ? `${videoFile.name} (${videoFile.size} bytes)` : 'No file');
                if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Convertir el archivo a buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    
    // 1. PROCESAR PRIMERO a 5 FPS localmente
        const videoId = `test-${uuidv4()}`;
    const processedVideoId = `5fps-processed-${uuidv4()}`;
    const processedVideoFileName = `test-videos/${processedVideoId}.mp4`;
    
    try {
      // Guardar video original temporalmente
      const tempVideoPath = `temp_${videoId}.mp4`;
      await fs.promises.writeFile(tempVideoPath, videoBuffer);
      console.log('📁 Video temporal guardado:', tempVideoPath);
      
        // Procesar video local con FFmpeg - SOLO PRIMEROS 15 SEGUNDOS A 12 FPS
        const tempProcessedPath = `temp_processed_${videoId}.mp4`;
        const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -t 15 -vf "fps=12,scale=1280:-1:flags=lanczos" -c:v libx264 -preset fast -crf 28 -b:v 500k -an -movflags +faststart "${tempProcessedPath}" -y`;
        console.log('🔧 Comando FFmpeg (15s máximo, 12 FPS):', ffmpegCommand);

      await execAsync(ffmpegCommand);
      
      // Leer el archivo procesado
      const processedVideoBuffer = await fs.promises.readFile(tempProcessedPath);
              // Limpiar archivos temporales
      await fs.promises.unlink(tempProcessedPath);
      await fs.promises.unlink(tempVideoPath);
      
      // 2. SUBIR UNA SOLA VEZ el video procesado
      console.log('📤 Subiendo video procesado a Firebase...');
      videoRef = adminStorage.bucket().file(processedVideoFileName);
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
      
      videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${processedVideoFileName}`;
          } catch (ffmpegError) {
      console.error('❌ Error con FFmpeg:', ffmpegError);
      
      // Fallback: subir video original y analizar
      console.log('🔄 Fallback: subiendo video original...');
      const fallbackVideoId = `test-fallback-${uuidv4()}`;
      const fallbackVideoFileName = `test-videos/${fallbackVideoId}.mp4`;
      
      videoRef = adminStorage.bucket().file(fallbackVideoFileName);
      await videoRef.save(videoBuffer, {
        metadata: {
          contentType: videoFile.type,
          metadata: {
            originalName: videoFile.name,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${fallbackVideoFileName}`;
      console.log('✅ Video original subido (fallback):', videoUrl);
    }
                                // NO extraer frames - solo usar la IA para detectar tiros
            console.log('🎯 Usando solo IA para detección de tiros (sin extracción de frames)...');
            const shotsWithFrames = []; // Vacío - no extraemos frames
            const keyframes = []; // Vacío - no extraemos frames

            // Generar ID único para este análisis
            const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log('📝 Analysis ID:', analysisId);

            // NO subir frames - solo usar IA
                        const frameUrls: string[] = []; // Vacío - no subimos frames
    
            // NO usar frames - solo análisis de IA
            const availableKeyframes = []; // Vacío - no usamos frames
            const freeKeyframes = []; // Vacío - no usamos frames
            const proKeyframes = []; // Vacío - no usamos frames
            
                // Configuración básica del prompt
    const promptConfig = {
      intro: "Análisis de tiro de baloncesto",
      fluidezHelp: "Evalúa la continuidad del movimiento",
      setPointHelp: "Observa el punto más alto del tiro",
      resources: ["Mecánica básica de tiro"],
      categoryGuides: {}
    };

            // NO usar frames - solo análisis de IA
            const freeAvailableKeyframes = []; // Vacío - no usamos frames
            const proAvailableKeyframes = []; // Vacío - no usamos frames

            // Ejecutar análisis FREE (usando prompt de prueba mejorado)
            console.log('🔍 Ejecutando análisis FREE (prompt de prueba)...');
            const freeStartTime = Date.now();
            const freeAnalysis = await analyzeBasketballShotTestPage({
              videoUrl,
              ageCategory: ageCategory as any,
              playerLevel,
              shotType,
              availableKeyframes: freeAvailableKeyframes,
            });
            const freeTime = (Date.now() - freeStartTime) / 1000;
                        // Ejecutar análisis PRO (usando prompt de prueba mejorado)
            console.log('🔍 Ejecutando análisis PRO (prompt de prueba)...');
            const proStartTime = Date.now();
            const proAnalysis = await analyzeBasketballShotTestPage({
              videoUrl,
              ageCategory: ageCategory as any,
              playerLevel,
              shotType,
              availableKeyframes: proAvailableKeyframes,
            });
            const proTime = (Date.now() - proStartTime) / 1000;
                // Calcular diferencias
    const freeEvaluableParams = freeAnalysis.detailedChecklist.reduce((acc, cat) => 
      acc + cat.items.filter(item => !item.na).length, 0);
    const proEvaluableParams = proAnalysis.detailedChecklist.reduce((acc, cat) => 
      acc + cat.items.filter(item => !item.na).length, 0);

    const freeNoEvaluableParams = freeAnalysis.detailedChecklist.reduce((acc, cat) => 
      acc + cat.items.filter(item => item.na).length, 0);
    const proNoEvaluableParams = proAnalysis.detailedChecklist.reduce((acc, cat) => 
      acc + cat.items.filter(item => item.na).length, 0);

    // Programar limpieza automática (solo para FREE)
    try {
      // Determinar si es análisis FREE o PRO basado en la cantidad de keyframes
      const isProAnalysis = availableKeyframes.length > 8;
      
      if (!isProAnalysis) {
        // Solo programar limpieza para análisis FREE (24 horas)
        await adminStorage.bucket().file(`cleanup/${analysisId}.json`).save(JSON.stringify({
          analysisId,
          userType: 'FREE',
          createdAt: new Date().toISOString(),
          scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }));
        console.log('🧹 Limpieza programada para FREE (24h)');
      } else {
        // Análisis PRO - marcar como permanente
        await adminStorage.bucket().file(`permanent/${analysisId}.json`).save(JSON.stringify({
          analysisId,
          userType: 'PRO',
          createdAt: new Date().toISOString(),
          status: 'permanent'
        }));
        console.log('💎 Análisis PRO - frames permanentes');
      }
    } catch (cleanupError) {
      console.warn('⚠️ No se pudo programar limpieza:', cleanupError);
    }

    // Preparar respuesta comparativa
    const response = {
      free: {
        ...freeAnalysis,
        tiempo_analisis: freeTime,
        parametros_evaluados: freeEvaluableParams,
        parametros_no_evaluables: freeNoEvaluableParams,
        keyframes_analizados: freeKeyframes.length,
        tipo_analisis: "FREE - Análisis básico"
      },
      pro: {
        ...proAnalysis,
        tiempo_analisis: proTime,
        parametros_evaluados: proEvaluableParams,
        parametros_no_evaluables: proNoEvaluableParams,
        keyframes_analizados: proKeyframes.length,
        tipo_analisis: "PRO - Análisis completo"
      },
      keyframes: [], // Vacío - no usamos frames
      frameUrls: [], // Vacío - no usamos frames
      analysisId, // ID para referencia
      // Información de detección de tiros por IA
      shotDetection: {
        method: "IA_VISION_ONLY",
        note: "Detección de tiros realizada únicamente por análisis de IA del video completo"
      },
      comparison: {
        diferencia_score: Number((proAnalysis.resumen_evaluacion.score_global - freeAnalysis.resumen_evaluacion.score_global).toFixed(2)),
        diferencia_confianza: proAnalysis.resumen_evaluacion.confianza_analisis === 'alta' ? 
          (freeAnalysis.resumen_evaluacion.confianza_analisis === 'alta' ? 0 : 
           freeAnalysis.resumen_evaluacion.confianza_analisis === 'media' ? 1 : 2) : 0,
        diferencia_tiempo: Number((proTime - freeTime).toFixed(2)),
        parametros_extra_pro: proEvaluableParams - freeEvaluableParams,
        keyframes_extra_pro: 0, // No usamos frames
        ventajas_pro: [
          "Análisis más profundo de la técnica",
          "Detección precisa de múltiples tiros",
          "Evaluación de consistencia entre tiros",
          "Análisis individual de cada lanzamiento"
        ]
      },
      video_info: {
        duracion: freeAnalysis.verificacion_inicial.duracion_video, // Duración real del video
        duracion_analizada: "15s máximo", // Solo primeros 15 segundos
        keyframes_extraidos: 0, // No extraemos frames
        calidad_video: "Buena - Análisis por IA",
        procesamiento: "12 FPS - Optimizado para IA - 15s máximo",
        resolucion_procesada: "1280x720",
        fps_procesado: 12,
        limite_tiempo: "Solo primeros 15 segundos del video"
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error en análisis FREE vs PRO:', error);
    return NextResponse.json(
      { error: 'Error en el análisis', details: error.message },
      { status: 500 }
    );
  } finally {
    // Limpiar archivo temporal si existe
    try {
      if (videoRef) {
        await videoRef.delete();
      }
    } catch (cleanupError) {
      console.warn('Error al limpiar archivo temporal:', cleanupError);
    }
  }
}