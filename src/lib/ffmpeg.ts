import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

function getFfmpegPath(): string | null {
  try {
    const modName = 'ffmpeg-static';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(modName);
    const p = (mod?.path || mod) as string | undefined;
    return p || null;
  } catch {
    return null;
  }
}

// Usar FFmpeg del sistema primero, luego ffmpeg-static como fallback
const RESOLVED_FFMPEG = 'ffmpeg'; // Usar FFmpeg del sistema instalado

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
  const duration = await getVideoDurationSecondsFromBuffer(inputBuffer);
  const frames: Array<{ index: number; timestamp: number; imageBuffer: Buffer }> = [];
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-kf-'));
  const inPath = path.join(tmpDir, 'input.mp4');
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
      await spawnAsync(RESOLVED_FFMPEG, args);
      const buf = await fs.readFile(outPath);
      frames.push({ index: i - 1, timestamp: ts, imageBuffer: buf });
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
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-multi-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  await fs.writeFile(inPath, inputBuffer);
  
  try {
    // 1. Detectar segmentos de tiros usando análisis de movimiento
    const shotSegments = await segmentAttemptsByMotionFromBuffer(inputBuffer, {
      downscaleHeight: 480,
      fps: 10,
      minSeparationSec: 1.5,
      peakStd: 1.8
    });
    
    console.log(`[extractFramesFromMultipleShots] Detectados ${shotSegments.length} segmentos de tiros`);
    
    // 2. Extraer frames de cada segmento
    const shotsWithFrames = [];
    
    for (let i = 0; i < shotSegments.length; i++) {
      const segment = shotSegments[i];
      const shotDuration = segment.end - segment.start;
      
      // Extraer 8-12 frames por tiro (dependiendo de la duración)
      const framesPerShot = Math.min(12, Math.max(8, Math.round(shotDuration * 4)));
      
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
    
    // Si no se detectaron tiros, usar el método tradicional
    if (shotsWithFrames.length === 0) {
      console.log('[extractFramesFromMultipleShots] No se detectaron tiros, usando método tradicional');
      const allFrames = await extractKeyframesFromBuffer(inputBuffer, 16);
      return [{
        shotIndex: 0,
        startTime: 0,
        endTime: duration || 30,
        frames: allFrames
      }];
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

export async function segmentAttemptsByMotionFromBuffer(
  inputBuffer: Buffer,
  options: { downscaleHeight?: number; fps?: number; minSeparationSec?: number; peakStd?: number } = {}
): Promise<Array<{ start: number; end: number }>> {
  const downscaleHeight = options.downscaleHeight ?? 240;
  const fps = options.fps ?? 5;
  const minSeparationSec = options.minSeparationSec ?? 1.2;
  const peakStd = options.peakStd ?? 2.0;

  const duration = await getVideoDurationSecondsFromBuffer(inputBuffer);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-scene-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  await fs.writeFile(inPath, inputBuffer);
  try {
    // Use showinfo to get per-frame timestamps and scene score
    const vf = `scale=-2:${downscaleHeight},fps=${fps},showinfo`;
    const stderr = await spawnCollectStderr(RESOLVED_FFMPEG, ['-i', inPath, '-vf', vf, '-f', 'null', '-']);
    const lines = stderr.split(/\r?\n/);
    const samples: Array<{ t: number; s: number }> = [];
    for (const line of lines) {
      // Example: showinfo frame:... pts_time:1.234 ... scene:0.123456
      const m = /pts_time:([0-9]+\.[0-9]+).*scene:([0-9]+\.[0-9]+)/.exec(line);
      if (m) {
        const t = parseFloat(m[1]);
        const s = parseFloat(m[2]);
        if (!Number.isNaN(t) && !Number.isNaN(s)) samples.push({ t, s });
      }
    }
    if (samples.length === 0) return [];

    // Smooth scores (moving average)
    const window = Math.max(1, Math.floor(fps * 0.4));
    const smoothed: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      let sum = 0, cnt = 0;
      for (let k = Math.max(0, i - window); k <= Math.min(samples.length - 1, i + window); k++) {
        sum += samples[k].s; cnt++;
      }
      smoothed.push(sum / Math.max(1, cnt));
    }

    // Baseline and peaks
    const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
    const variance = smoothed.reduce((a, b) => a + (b - mean) * (b - mean), 0) / smoothed.length;
    const std = Math.sqrt(Math.max(variance, 1e-8));
    const threshold = mean + peakStd * std;

    const peaks: number[] = [];
    let lastPeakT = -Infinity;
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] > threshold && smoothed[i] > smoothed[i - 1] && smoothed[i] >= smoothed[i + 1]) {
        const t = samples[i].t;
        if (t - lastPeakT >= minSeparationSec) {
          peaks.push(t);
          lastPeakT = t;
        }
      }
    }

    // Build windows around peaks
    const windows: Array<{ start: number; end: number }> = [];
    for (const t of peaks) {
      const start = Math.max(0, t - 0.6);
      const end = Math.min(duration || t + 1.0, t + 1.0);
      if (windows.length === 0) windows.push({ start, end });
      else {
        const prev = windows[windows.length - 1];
        if (start <= prev.end - 0.2) {
          // merge overlapping windows
          prev.end = Math.max(prev.end, end);
        } else {
          windows.push({ start, end });
        }
      }
    }
    return windows;
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

