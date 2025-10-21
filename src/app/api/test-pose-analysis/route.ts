import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

// Función para eliminar directorios recursivamente (Windows compatible)
async function deleteDirectoryRecursive(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  
  const files = await fs.promises.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.promises.stat(filePath);
    
    if (stat.isDirectory()) {
      await deleteDirectoryRecursive(filePath);
    } else {
      await fs.promises.unlink(filePath);
    }
  }
  
  await fs.promises.rmdir(dirPath);
}

import { extractPosesFromFolder, calculateBiomechanicalAngles, detectShotPhases } from '@/lib/pose-detection';
import { analyzeBasketballShotTestPage } from '@/ai/flows/analyze-basketball-shot';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
    try {
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    console.log('📁 Video recibido:', videoFile.name, videoFile.size, 'bytes');

    // 1. PROCESAR VIDEO A 5 FPS Y 15 SEGUNDOS MÁXIMO
    console.log('🎬 Procesando video a 5 FPS (15s máximo)...');
    const videoId = `pose-${uuidv4()}`;
    const processedVideoId = `5fps-pose-${uuidv4()}`;
    const processedVideoFileName = `test-videos/${processedVideoId}.mp4`;
    
    // Guardar video original temporalmente
    const tempVideoPath = `temp_${videoId}.mp4`;
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await fs.promises.writeFile(tempVideoPath, videoBuffer);
    console.log('📁 Video temporal guardado:', tempVideoPath);
    
    // Procesar video local con FFmpeg - SOLO PRIMEROS 15 SEGUNDOS
    const tempProcessedPath = `temp_processed_${videoId}.mp4`;
    const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -t 15 -vf "fps=5,scale=640:480" -c:v libx264 -preset fast -crf 28 -b:v 500k -an -movflags +faststart "${tempProcessedPath}" -y`;
    console.log('🔧 Comando FFmpeg (15s máximo):', ffmpegCommand);
  
    await execAsync(ffmpegCommand);
    
    // Leer el archivo procesado
    const processedVideoBuffer = await fs.promises.readFile(tempProcessedPath);
      // 2. EXTRAER FRAMES CON ARQUITECTURA OPTIMIZADA (8 FPS + VENTANAS)
    const framesDir = `frames_${videoId}`;
  await fs.promises.mkdir(framesDir, { recursive: true });
  
  // Extraer frames de baja resolución (8 FPS) para detección general
  const extractFramesCommand = `ffmpeg -i "${tempProcessedPath}" -vf "fps=8,scale=640:-1:flags=lanczos" "${framesDir}/frame_%05d.jpg" -y`;
  console.log('🔧 Extrayendo frames (8 FPS):', extractFramesCommand);
  
  await execAsync(extractFramesCommand);
  
  // Contar frames extraídos
  const frameFiles = await fs.promises.readdir(framesDir);
  const jpgFrames = frameFiles.filter(f => f.endsWith('.jpg'));
    // 3. POSE DETECTION CON ARQUITECTURA OPTIMIZADA
    const poseData = await extractPosesFromFolder(framesDir, 8);
      // 4. CALCULAR ÁNGULOS BIOMECÁNICOS
        const angles = calculateBiomechanicalAngles(poseData.frames);
      // 5. DETECTAR LANZAMIENTOS REALES
  console.log('🏀 Detectando lanzamientos reales...');
  const { detectShots } = await import('@/lib/pose-detection');
  const shotDetection = detectShots(poseData.frames, angles);
    // 6. DETECTAR FASES DEL TIRO (compatibilidad)
  console.log('🏀 Detectando fases del tiro...');
  const phases = detectShotPhases(angles, poseData.frames);
      // 6. SUBIR VIDEO PROCESADO A FIREBASE
    console.log('📤 Subiendo video procesado a Firebase...');
    const videoRef = adminStorage.bucket().file(processedVideoFileName);
    await videoRef.save(Buffer.from(processedVideoBuffer, 'binary'), {
      metadata: {
        contentType: 'video/mp4',
        metadata: {
          originalName: `${videoFile.name}_5fps_pose`,
          uploadedAt: new Date().toISOString(),
          fps: 5,
          resolution: '640x480',
          duration: '15s',
          poseDetection: 'enabled'
        }
      }
    });
    
    const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${processedVideoFileName}`;
        // 7. ANÁLISIS CON GEMINI 2.5 FLASH
        const analysisResult = await analyzeBasketballShotTestPage({
      videoUrl,
      ageCategory: 'Sub-15',
      playerLevel: 'Avanzado',
      shotType: 'Lanzamiento de Tres',
      availableKeyframes: []
    });
    
        // 8. LIMPIAR ARCHIVOS TEMPORALES
    console.log('🧹 Limpiando archivos temporales...');
    
    try {
      // Limpiar archivos de video
      if (fs.existsSync(tempVideoPath)) {
        await fs.promises.unlink(tempVideoPath);
      }
      if (fs.existsSync(tempProcessedPath)) {
        await fs.promises.unlink(tempProcessedPath);
      }
      
      // Limpiar frames recursivamente (Windows compatible)
      if (fs.existsSync(framesDir)) {
        await deleteDirectoryRecursive(framesDir);
      }
      
          } catch (cleanupError) {
      console.warn('⚠️ Error limpiando archivos temporales:', cleanupError);
      // No fallar por errores de limpieza
    }
    
        // 9. RESPUESTA CON DATOS COMPLETOS
    const response = {
      success: true,
      message: 'Análisis con pose detection completado exitosamente',
      video_info: {
        original_name: videoFile.name,
        original_size: videoFile.size,
        processed_size: processedVideoBuffer.length,
        duration: '15.0s (limitado)',
        fps: 8,
        resolution: '640x480',
        video_url: videoUrl
      },
      pose_detection: {
        frames_processed: poseData.frames.length,
        fps: poseData.fps,
        keypoints_per_frame: poseData.frames[0]?.keypoints.length || 0,
        total_keypoints: poseData.frames.reduce((sum, frame) => sum + frame.keypoints.length, 0)
      },
      shot_detection: {
        total_shots: shotDetection.totalShots,
        shots: shotDetection.shots.map(shot => ({
          id: shot.id,
          start_frame: shot.startFrame,
          end_frame: shot.endFrame,
          start_time: `${(shot.startTime / 1000).toFixed(1)}s`,
          end_time: `${(shot.endTime / 1000).toFixed(1)}s`,
          duration: `${(shot.duration / 1000).toFixed(1)}s`,
          phases: {
            start: shot.phases.start,
            load: shot.phases.load,
            release: shot.phases.release,
            apex: shot.phases.apex,
            landing: shot.phases.landing
          }
        }))
      },
      biomechanical_analysis: {
        angles_calculated: angles.length,
        phases_detected: phases,
        sample_angles: angles.slice(0, 3) // Primeros 3 frames como muestra
      },
      ai_analysis: analysisResult,
      processing_time: new Date().toISOString()
    };
    
        return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('❌ Error en análisis con pose detection:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en análisis con pose detection',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
