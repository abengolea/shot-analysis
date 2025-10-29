import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

// Resolver FFmpeg dinámicamente para manejar imports en runtime
let RESOLVED_FFMPEG: string = 'ffmpeg'; // Default

// Resolver FFmpeg de forma síncrona
try {
  // Primero intentar con require directo (sincrónico)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegStatic = require('ffmpeg-static');
  console.log('🔍 [FFmpeg] ffmpeg-static module:', typeof ffmpegStatic);
  
  if (ffmpegStatic && (ffmpegStatic.path || ffmpegStatic)) {
    RESOLVED_FFMPEG = ffmpegStatic.path || ffmpegStatic;
    
    // Verificar que exista
    const { accessSync, constants } = require('fs');
    try {
      accessSync(RESOLVED_FFMPEG, constants.F_OK);
      console.log('✅ [FFmpeg] Usando ffmpeg-static (path directo):', RESOLVED_FFMPEG);
      
      // Hacer ejecutable
      try {
        const { chmodSync } = require('fs');
        chmodSync(RESOLVED_FFMPEG, 0o755);
      } catch {}
    } catch (accessErr: any) {
      console.warn('⚠️ [FFmpeg] Binario directo no existe, buscando en otras ubicaciones...');
      console.warn('⚠️ [FFmpeg] Error:', accessErr.message);
      
      // Buscar en otras ubicaciones de forma síncrona (aproximación)
      const path = require('path');
      const { existsSync } = require('fs');
      
      // Buscar usando require.resolve para encontrar el módulo real
      let ffmpegModuleDir: string | null = null;
      try {
        // require.resolve devuelve el path al index.js del módulo
        const moduleIndexPath = require.resolve('ffmpeg-static');
        ffmpegModuleDir = path.dirname(moduleIndexPath);
        console.log('🔍 [FFmpeg] Módulo encontrado en:', ffmpegModuleDir);
      } catch (resolveErr) {
        console.warn('⚠️ [FFmpeg] No se pudo resolver ffmpeg-static con require.resolve');
      }
      
      const fallbackPaths = [
        // Ruta del binario en el directorio del módulo
        ffmpegModuleDir ? path.join(ffmpegModuleDir, 'ffmpeg') : null,
        // Buscar en subdirectorios comunes del módulo
        ffmpegModuleDir ? path.join(ffmpegModuleDir, 'bin', 'ffmpeg') : null,
        ffmpegModuleDir ? path.join(ffmpegModuleDir, '..', 'ffmpeg') : null,
        // Rutas estándar
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(process.cwd(), '.next', 'standalone', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        '/workspace/node_modules/ffmpeg-static/ffmpeg',
        '/workspace/.next/standalone/node_modules/ffmpeg-static/ffmpeg',
        // Rutas relativas desde diferentes ubicaciones
        path.join(__dirname, '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
        path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
      ].filter(Boolean);
      
      let found = false;
      for (const fallbackPath of fallbackPaths) {
        if (existsSync(fallbackPath)) {
          RESOLVED_FFMPEG = fallbackPath;
          console.log('✅ [FFmpeg] Encontrado en fallback path:', RESOLVED_FFMPEG);
          found = true;
          
          try {
            const { chmodSync } = require('fs');
            chmodSync(RESOLVED_FFMPEG, 0o755);
          } catch {}
          break;
        }
      }
      
      if (!found) {
        console.error('❌ [FFmpeg] No se encontró el binario en ninguna ubicación conocida');
        console.error('❌ [FFmpeg] Intentando usar comando del sistema...');
        
        // Intentar verificar si ffmpeg está disponible en el PATH del sistema
        try {
          const { execSync } = require('child_process');
          try {
            execSync('which ffmpeg', { stdio: 'pipe', timeout: 2000 });
            console.log('✅ [FFmpeg] ffmpeg encontrado en PATH del sistema');
            RESOLVED_FFMPEG = 'ffmpeg';
          } catch (whichErr) {
            // Intentar con 'where' en Windows o buscar directamente
            try {
              execSync('ffmpeg -version', { stdio: 'pipe', timeout: 2000 });
              console.log('✅ [FFmpeg] ffmpeg funciona directamente como comando del sistema');
              RESOLVED_FFMPEG = 'ffmpeg';
            } catch (execErr) {
              console.error('❌ [FFmpeg] ffmpeg no está disponible en el sistema');
              RESOLVED_FFMPEG = 'ffmpeg'; // Último recurso
            }
          }
        } catch (checkErr) {
          console.error('❌ [FFmpeg] Error verificando ffmpeg del sistema:', checkErr);
          RESOLVED_FFMPEG = 'ffmpeg'; // Último recurso
        }
      }
    }
  }
} catch (e: any) {
  console.warn('⚠️ [FFmpeg] No se pudo cargar ffmpeg-static:', e?.message || String(e));
  RESOLVED_FFMPEG = 'ffmpeg';
}

export const FFMPEG_PATH = RESOLVED_FFMPEG;

export type StandardizeOptions = {
  maxSeconds?: number;
  targetHeight?: number; // keep aspect ratio, width auto (-2)
  targetFps?: number;
  dropAudio?: boolean;
};

export async function standardizeVideoBuffer(
  inputBuffer: Buffer,
  opts: StandardizeOptions = {}
): Promise<{ outputBuffer: Buffer; contentType: string }> {
  const {
    maxSeconds = 30,
    targetHeight = 720,
    targetFps = 20,
    dropAudio = false,
  } = opts;

  // Si no hay binario disponible, intentar continuar con el buffer original

  // Si no hay ffmpeg disponible, devolver el buffer original (no bloquear)
  if (!RESOLVED_FFMPEG || typeof RESOLVED_FFMPEG !== 'string') {
    console.warn('[ffmpeg] Binario no resuelto, usando video original sin estandarizar.');
    return { outputBuffer: inputBuffer, contentType: 'video/mp4' };
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-std-'));
  const inPath = path.join(tmpDir, 'input');
  const outPath = path.join(tmpDir, 'output.mp4');

  try {
    await fs.writeFile(inPath, inputBuffer);

    const args: string[] = [
      '-y',
      '-i', inPath,
      '-t', String(maxSeconds),
      '-vf', `scale=-2:${targetHeight},fps=${targetFps}`,
      ...(dropAudio ? ['-an'] : ['-c:a', 'aac', '-b:a', '128k']),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outPath,
    ];

    try {
      await spawnAsync(RESOLVED_FFMPEG, args);
    } catch (e: any) {
      if (e && String(e.message || '').includes('ENOENT')) {
        console.warn('[ffmpeg] ENOENT – ffmpeg no disponible. Devolviendo video original.');
        return { outputBuffer: inputBuffer, contentType: 'video/mp4' };
      }
      throw e;
    }

    const outputBuffer = await fs.readFile(outPath);
    return { outputBuffer, contentType: 'video/mp4' };
  } finally {
    // best-effort cleanup
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function spawnAsync(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

export async function getVideoDurationSecondsFromBuffer(inputBuffer: Buffer): Promise<number> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-probe-'));
  const inPath = path.join(tmpDir, 'probe_input');
  try {
    await fs.writeFile(inPath, inputBuffer);
    return await getVideoDurationSeconds(inPath);
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

export async function getVideoDurationSeconds(inputPath: string): Promise<number> {
  const args = ['-i', inputPath];
  const stderr = await spawnCollectStderr(RESOLVED_FFMPEG, args);
  const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(stderr);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

function spawnCollectStderr(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || code === 1) resolve(stderr); // ffmpeg -i returns 1 often
      else reject(new Error(`ffmpeg probe exited with code ${code}`));
    });
  });
}

export async function extractKeyframesFromBuffer(
  inputBuffer: Buffer,
  numFrames: number
): Promise<Array<{ index: number; timestamp: number; imageBuffer: Buffer }>> {
  console.log(`🔍 [extractKeyframesFromBuffer] Iniciando extracción de ${numFrames} frames`);
  const duration = await getVideoDurationSecondsFromBuffer(inputBuffer);
  console.log(`⏱️ [extractKeyframesFromBuffer] Duración del video: ${duration}s`);
  const frames: Array<{ index: number; timestamp: number; imageBuffer: Buffer }> = [];
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-kf-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  console.log(`📁 [extractKeyframesFromBuffer] Escribiendo video en: ${inPath}`);
  await fs.writeFile(inPath, inputBuffer);
  try {
    const effectiveDuration = Math.max(0.5, Math.min(duration || 30, 30));
    const interval = effectiveDuration / (numFrames + 1);
    for (let i = 1; i <= numFrames; i++) {
      const ts = i * interval;
      const outPath = path.join(tmpDir, `kf_${i}.jpg`);
      const args = [
        '-y',
        '-ss', ts.toFixed(2),
        '-i', inPath,
        '-frames:v', '1',
        '-q:v', '2',
        '-vf', 'scale=-2:720',
        outPath,
      ];
      console.log(`🎬 [extractKeyframesFromBuffer] Extrayendo frame ${i}/${numFrames} en ${ts.toFixed(2)}s`);
      await spawnAsync(RESOLVED_FFMPEG, args);
      const buf = await fs.readFile(outPath);
      console.log(`✅ [extractKeyframesFromBuffer] Frame ${i} extraído exitosamente (${buf.length} bytes)`);
      frames.push({ index: i - 1, timestamp: ts, imageBuffer: buf });
    }
    return frames;
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// Nueva función para extraer keyframes para análisis de IA (16 frames)
export async function extractKeyframesForAI(
  inputBuffer: Buffer,
  numFrames: number = 16
): Promise<Array<{ index: number; timestamp: number; description: string; imageBuffer: Buffer }>> {
  const duration = await getVideoDurationSecondsFromBuffer(inputBuffer);
  const frames: Array<{ index: number; timestamp: number; description: string; imageBuffer: Buffer }> = [];
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-ai-kf-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  await fs.writeFile(inPath, inputBuffer);
  
  try {
    const effectiveDuration = Math.max(0.5, Math.min(duration || 30, 30));
    const interval = effectiveDuration / (numFrames + 1);
    
        console.log(`🤖 [AI Keyframes] Duración: ${effectiveDuration.toFixed(2)}s, Intervalo: ${interval.toFixed(2)}s`);
    
    for (let i = 1; i <= numFrames; i++) {
      const ts = i * interval;
      const outPath = path.join(tmpDir, `ai_kf_${i}.jpg`);
      
      // Generar descripción basada en el momento del tiro
      const shotProgress = (ts / effectiveDuration) * 100;
      let description = '';
      
      if (shotProgress < 20) {
        description = `Preparación inicial (${ts.toFixed(1)}s)`;
      } else if (shotProgress < 40) {
        description = `Carga del tiro (${ts.toFixed(1)}s)`;
      } else if (shotProgress < 60) {
        description = `Ascenso del balón (${ts.toFixed(1)}s)`;
      } else if (shotProgress < 80) {
        description = `Set point / Liberación (${ts.toFixed(1)}s)`;
      } else {
        description = `Follow-through / Aterrizaje (${ts.toFixed(1)}s)`;
      }
      
      const args = [
        '-y',
        '-ss', ts.toFixed(2),
        '-i', inPath,
        '-frames:v', '1',
        '-q:v', '2',
        '-vf', 'scale=-2:720',
        outPath,
      ];
      
      try {
        await spawnAsync(RESOLVED_FFMPEG, args);
        const buf = await fs.readFile(outPath);
        frames.push({ 
          index: i - 1, 
          timestamp: ts, 
          description,
          imageBuffer: buf 
        });
        console.log(`✅ [AI Keyframes] Frame ${i-1}: ${ts.toFixed(2)}s - ${description}`);
      } catch (error) {
        console.warn(`⚠️ [AI Keyframes] Error extrayendo frame ${i}:`, error);
      }
    }
    
        return frames;
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// Nueva función para extraer frames de múltiples tiros detectados
export async function extractFramesFromMultipleShots(
  inputBuffer: Buffer
): Promise<Array<{ 
  shotIndex: number; 
  startTime: number; 
  endTime: number; 
  frames: Array<{ index: number; timestamp: number; imageBuffer: Buffer }> 
}>> {
    const duration = await getVideoDurationSecondsFromBuffer(inputBuffer);
  console.log('[extractFramesFromMultipleShots] Duración del video:', duration);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-multi-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  await fs.writeFile(inPath, inputBuffer);
  
  try {
    // 1. Detectar segmentos de tiros usando análisis de movimiento MEJORADO
        const shotSegments = await segmentAttemptsByMotionFromBuffer(inputBuffer, {
      downscaleHeight: 480,
      fps: 30, // Máximo FPS para detección granular
      minSeparationSec: 0.5, // Separación mínima entre tiros
      peakStd: 0.8 // Umbral optimizado
    });
    
    console.log('[extractFramesFromMultipleShots] Segmentos detectados por movimiento:', shotSegments.length);
    
    console.log(`[extractFramesFromMultipleShots] Detectados ${shotSegments.length} segmentos de tiros`);
    shotSegments.forEach((seg, i) => {
      console.log(`  Tiro ${i + 1}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (${(seg.end - seg.start).toFixed(2)}s)`);
    });
    
    // 2. Extraer frames de cada segmento
    const shotsWithFrames = [];
    
    for (let i = 0; i < shotSegments.length; i++) {
      const segment = shotSegments[i];
      const shotDuration = segment.end - segment.start;
      
      // Extraer solo 1 frame por tiro (máxima velocidad)
      const framesPerShot = 1;
      
      const frames = [];
      for (let j = 1; j <= framesPerShot; j++) {
        const ts = segment.start + (j * shotDuration / (framesPerShot + 1));
        const outPath = path.join(tmpDir, `shot_${i}_frame_${j}.jpg`);
        
        const args = [
          '-y',
          '-ss', ts.toFixed(2),
          '-i', inPath,
          '-frames:v', '1',
          '-q:v', '2',
          '-vf', 'scale=-2:1080', // Mejor calidad para análisis
          outPath,
        ];
        
        try {
          await spawnAsync(RESOLVED_FFMPEG, args);
          const buf = await fs.readFile(outPath);
          frames.push({ 
            index: j - 1, 
            timestamp: ts, 
            imageBuffer: buf 
          });
        } catch (e) {
          console.warn(`[extractFramesFromMultipleShots] Error extrayendo frame ${j} del tiro ${i}:`, e);
        }
      }
      
      if (frames.length > 0) {
        shotsWithFrames.push({
          shotIndex: i,
          startTime: segment.start,
          endTime: segment.end,
          frames
        });
      }
    }
    
    // Si no se detectaron tiros, usar método de segmentos fijos
    if (shotsWithFrames.length === 0) {
      console.log('[extractFramesFromMultipleShots] No se detectaron tiros por movimiento, usando segmentos fijos');
      console.log('[extractFramesFromMultipleShots] Duración del video:', duration);
      
      // Dividir el video en segmentos más realistas (4-5 segundos por tiro)
      const segmentDuration = 4.0; // 4 segundos por segmento (más realista para videos largos)
      const numSegments = Math.max(2, Math.min(6, Math.floor(duration / segmentDuration))); // Máximo 6 tiros
      console.log(`[extractFramesFromMultipleShots] Dividiendo en ${numSegments} segmentos de ${segmentDuration}s`);
      
      const fixedSegments = [];
      for (let i = 0; i < numSegments; i++) {
        const start = i * segmentDuration;
        const end = Math.min((i + 1) * segmentDuration, duration);
        fixedSegments.push({ start, end });
      }
      
      // Extraer frames de cada segmento fijo
      for (let i = 0; i < fixedSegments.length; i++) {
        const segment = fixedSegments[i];
        const shotDuration = segment.end - segment.start;
        
        // Extraer solo 1 frame por segmento (máxima velocidad)
        const framesPerShot = 1;
        
        const frames = [];
        for (let j = 1; j <= framesPerShot; j++) {
          const ts = segment.start + (j * shotDuration / (framesPerShot + 1));
          const outPath = path.join(tmpDir, `fixed_shot_${i}_frame_${j}.jpg`);
          
          const args = [
            '-y',
            '-ss', ts.toFixed(2),
            '-i', inPath,
            '-frames:v', '1',
            '-q:v', '2',
            '-vf', 'scale=-2:1080',
            outPath,
          ];
          
          try {
            await spawnAsync(RESOLVED_FFMPEG, args);
            const buf = await fs.readFile(outPath);
            frames.push({ 
              index: j - 1, 
              timestamp: ts, 
              imageBuffer: buf 
            });
          } catch (e) {
            console.warn(`[extractFramesFromMultipleShots] Error extrayendo frame ${j} del segmento ${i}:`, e);
          }
        }
        
        if (frames.length > 0) {
          shotsWithFrames.push({
            shotIndex: i,
            startTime: segment.start,
            endTime: segment.end,
            frames
          });
        }
      }
      
      console.log(`[extractFramesFromMultipleShots] Generados ${shotsWithFrames.length} segmentos fijos`);
    }
    
    return shotsWithFrames;
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

export async function extractFramesBetweenDataUrlsFromBuffer(
  inputBuffer: Buffer,
  fromSec: number,
  toSec: number,
  numFrames: number
): Promise<Array<{ index: number; timestamp: number; dataUrl: string }>> {
  const start = Math.max(0, Math.min(fromSec, toSec));
  const end = Math.max(start + 0.05, Math.max(fromSec, toSec));
  const frames: Array<{ index: number; timestamp: number; dataUrl: string }> = [];
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-kfwin-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  await fs.writeFile(inPath, inputBuffer);
  try {
    const interval = (end - start) / Math.max(1, numFrames + 1);
    for (let i = 1; i <= numFrames; i++) {
      const ts = start + interval * i;
      const outPath = path.join(tmpDir, `seg_${i}.jpg`);
      const args = [
        '-y',
        '-ss', ts.toFixed(2),
        '-i', inPath,
        '-frames:v', '1',
        '-q:v', '3',
        '-vf', 'scale=-2:480',
        outPath,
      ];
      await spawnAsync(RESOLVED_FFMPEG, args);
      const buf = await fs.readFile(outPath);
      const b64 = buf.toString('base64');
      frames.push({ index: i - 1, timestamp: ts, dataUrl: `data:image/jpeg;base64,${b64}` });
    }
    return frames;
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// 🏀 SOLUCIÓN MEJORADA PARA DETECCIÓN DE MÚLTIPLES TIROS
export async function segmentAttemptsByMotionFromBuffer(
  inputBuffer: Buffer,
  options: { downscaleHeight?: number; fps?: number; minSeparationSec?: number; peakStd?: number } = {}
): Promise<Array<{ start: number; end: number }>> {
  const downscaleHeight = options.downscaleHeight ?? 240;
  const fps = options.fps ?? 30; // Más FPS para mejor detección
  const minSeparationSec = options.minSeparationSec ?? 0.5;
  const peakStd = options.peakStd ?? 0.8; // Umbral más bajo

  const duration = await getVideoDurationSecondsFromBuffer(inputBuffer);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-scene-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  await fs.writeFile(inPath, inputBuffer);
  
  try {
    console.log(`[segmentAttemptsByMotionFromBuffer] Analizando video de ${duration.toFixed(2)}s...`);
    
    // 1️⃣ DETECTAR PICOS DE MOVIMIENTO (más granular)
    const vf = `scale=-2:${downscaleHeight},fps=${fps},select='gt(scene,0.1)',showinfo`;
    const stderr = await spawnCollectStderr(RESOLVED_FFMPEG, ['-i', inPath, '-vf', vf, '-f', 'null', '-']);
    const lines = stderr.split(/\r?\n/);
    const samples: Array<{ t: number; s: number }> = [];
    
    for (const line of lines) {
      // Buscar timestamps y scores de escena
      const m = /pts_time:([0-9]+\.[0-9]+).*scene:([0-9]+\.[0-9]+)/.exec(line);
      if (m) {
        const t = parseFloat(m[1]);
        const s = parseFloat(m[2]);
        if (!Number.isNaN(t) && !Number.isNaN(s)) samples.push({ t, s });
      }
    }
    
    console.log(`[segmentAttemptsByMotionFromBuffer] Muestras de movimiento: ${samples.length}`);
    if (samples.length === 0) return [];

    // 2️⃣ FILTRAR POR DURACIÓN REALISTA DE TIROS
    const validShots = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const duration = samples[i + 1].t - samples[i].t;
      // Un tiro dura entre 1-4 segundos (no 30+ segundos)
      if (duration >= 1.0 && duration <= 4.0) {
        validShots.push({
          start: samples[i].t,
          end: samples[i + 1].t,
          duration: duration
        });
      }
    }
    
    console.log(`[segmentAttemptsByMotionFromBuffer] Tiros válidos por duración: ${validShots.length}`);

    // 3️⃣ SEGMENTACIÓN INTELIGENTE SI FFmpeg FALLA
    if (validShots.length < 2) {
            const expectedShots = Math.max(2, Math.floor(duration / 8)); // 1 tiro cada 8 segundos
      const segmentDuration = duration / expectedShots;
      const shots = [];
      
      for (let i = 0; i < expectedShots; i++) {
        shots.push({
          start: i * segmentDuration,
          end: Math.min((i + 1) * segmentDuration, duration),
          duration: segmentDuration,
          type: 'estimated'
        });
      }
      
      console.log(`[segmentAttemptsByMotionFromBuffer] Generados ${shots.length} segmentos estimados`);
      return shots;
    }

    // 4️⃣ VALIDACIÓN FINAL - Eliminar falsos positivos
    const finalShots = validShots.filter(shot => {
      if (shot.duration > 10) {
        console.warn(`⚠️ Tiro de ${shot.duration.toFixed(2)}s descartado (muy largo)`);
        return false;
      }
      return true;
    });

    console.log(`[segmentAttemptsByMotionFromBuffer] Tiros finales validados: ${finalShots.length}`);
    
    // 5️⃣ CONVERTIR A FORMATO ESPERADO
    const windows = finalShots.map(shot => ({
      start: shot.start,
      end: shot.end
    }));
    
    return windows;
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

