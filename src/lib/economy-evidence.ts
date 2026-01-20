import { existsSync, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { extractSmartKeyframesFromBuffer, type SmartKeyframe } from './smart-keyframes';
import { getVideoDurationSecondsFromBuffer } from './ffmpeg';
import type { FramePose } from './pose-detection';
import { GoogleAuth } from 'google-auth-library';

export type EconomyEvidence = {
  availableKeyframes: Array<{ index: number; timestamp: number; description: string }>;
  poseFrames?: FramePose[];
};

type EconomyEvidenceOptions = {
  targetFrames?: number;
  includePose?: boolean;
};

const POSE_SCRIPT_PATH = path.join(process.cwd(), 'ml', 'extract_keypoints.py');
const POSE_SERVICE_URL = process.env.POSE_SERVICE_URL || '';

export async function buildEconomyEvidenceFromVideoUrl(
  videoUrl: string,
  options: EconomyEvidenceOptions = {}
): Promise<EconomyEvidence> {
  const targetFrames = clampTargetFrames(options.targetFrames);
  if (!videoUrl) return { availableKeyframes: [] };

  const videoBuffer = await fetchVideoBuffer(videoUrl);
  if (!videoBuffer || videoBuffer.length === 0) return { availableKeyframes: [] };

  const smartKeyframes = await extractSmartKeyframesFromBuffer(videoBuffer, targetFrames);
  const availableKeyframes = smartKeyframes.map((kf, idx) => ({
    index: idx,
    timestamp: Number.isFinite(kf.timestamp) ? kf.timestamp : 0,
    description: kf.phase ? `${kf.description} (${kf.phase})` : kf.description,
  }));

  let poseFrames: FramePose[] | undefined = undefined;
  if (options.includePose) {
    poseFrames =
      (await fetchPoseFramesFromService(videoUrl, targetFrames)) ??
      (await extractPoseFramesEconomy(videoBuffer, smartKeyframes, targetFrames));
  }

  return {
    availableKeyframes,
    poseFrames: poseFrames && poseFrames.length > 0 ? poseFrames : undefined,
  };
}

function clampTargetFrames(targetFrames?: number): number {
  const fallback = 8;
  if (!targetFrames || !Number.isFinite(targetFrames)) return fallback;
  return Math.max(6, Math.min(10, Math.round(targetFrames)));
}

async function fetchVideoBuffer(videoUrl: string): Promise<Buffer | null> {
  try {
    const resp = await fetch(videoUrl);
    if (!resp.ok) {
      console.warn('[economy-evidence] Video fetch error:', resp.status);
      return null;
    }
    const ab = await resp.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.warn('[economy-evidence] Video fetch exception:', e);
    return null;
  }
}

async function fetchPoseFramesFromService(
  videoUrl: string,
  targetFrames: number
): Promise<FramePose[] | null> {
  if (!POSE_SERVICE_URL) return null;
  try {
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(POSE_SERVICE_URL);
    const res = await client.request({
      url: POSE_SERVICE_URL,
      method: 'POST',
      data: { videoUrl, targetFrames },
      timeout: 120_000,
    } as any);

    const data = res?.data as { frames?: Array<any> } | undefined;
    if (!data || !Array.isArray(data.frames)) {
      console.warn('[economy-evidence] Pose service respuesta inválida.');
      return null;
    }
    const poseFrames = data.frames.map((frame: any) => ({
      tMs: Math.round(Number(frame.tMs || 0)),
      keypoints: Array.isArray(frame.keypoints)
        ? frame.keypoints.map((kp: any) => ({
            name: String(kp.name),
            x: Number(kp.x || 0),
            y: Number(kp.y || 0),
            score: Number.isFinite(kp.score) ? kp.score : 0,
          }))
        : [],
    }));
    return poseFrames;
  } catch (e) {
    console.warn('[economy-evidence] Pose service falló:', e);
    return null;
  }
}

async function extractPoseFramesEconomy(
  videoBuffer: Buffer,
  smartKeyframes: SmartKeyframe[],
  targetFrames: number
): Promise<FramePose[]> {
  if (!existsSync(POSE_SCRIPT_PATH)) {
    console.warn('[economy-evidence] Pose script no existe:', POSE_SCRIPT_PATH);
    return [];
  }

  const python = await resolvePythonBinary();
  if (!python) {
    console.warn('[economy-evidence] Python no disponible. Pose omitida.');
    return [];
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pose-econ-'));
  const videoPath = path.join(tmpDir, 'input.mp4');
  const outputPath = path.join(tmpDir, 'pose.json');
  try {
    await fs.writeFile(videoPath, videoBuffer);
    const duration = await getVideoDurationSecondsFromBuffer(videoBuffer);
    const estimatedFps = 30;
    const estimatedTotalFrames = Math.max(1, Math.round(duration * estimatedFps));
    const stride = Math.max(1, Math.floor(estimatedTotalFrames / targetFrames));

    await runPython(python, [
      POSE_SCRIPT_PATH,
      '--video_path',
      videoPath,
      '--output_path',
      outputPath,
      '--stride',
      String(stride),
      '--model_complexity',
      '0',
      '--min_detection_confidence',
      '0.4',
      '--min_tracking_confidence',
      '0.4',
    ]);

    const raw = await fs.readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw) as { frames?: Array<any> };
    const frames = Array.isArray(parsed.frames) ? parsed.frames : [];
    const poseFrames = frames.map((frame: any) => ({
      tMs: Math.round(Number(frame.time_sec || 0) * 1000),
      keypoints: Array.isArray(frame.keypoints)
        ? frame.keypoints.map((kp: any) => ({
            name: String(kp.name),
            x: Number(kp.x || 0),
            y: Number(kp.y || 0),
            score: Number.isFinite(kp.v) ? kp.v : 0,
          }))
        : [],
    }));

    return selectPoseFrames(poseFrames, smartKeyframes, targetFrames);
  } catch (e) {
    console.warn('[economy-evidence] Pose extraction falló:', e);
    return [];
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

function selectPoseFrames(
  poseFrames: FramePose[],
  smartKeyframes: SmartKeyframe[],
  targetFrames: number
): FramePose[] {
  if (poseFrames.length === 0) return [];
  if (!smartKeyframes || smartKeyframes.length === 0) {
    return downsamplePoseFrames(poseFrames, targetFrames);
  }

  const targets = smartKeyframes.map((kf) => Math.round(kf.timestamp * 1000));
  const selected: FramePose[] = [];
  const used = new Set<number>();

  for (const tMs of targets) {
    let bestIndex = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < poseFrames.length; i++) {
      if (used.has(i)) continue;
      const diff = Math.abs(poseFrames[i].tMs - tMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      selected.push(poseFrames[bestIndex]);
    }
    if (selected.length >= targetFrames) break;
  }

  if (selected.length < targetFrames) {
    const remaining = poseFrames.filter((_, idx) => !used.has(idx));
    selected.push(...downsamplePoseFrames(remaining, targetFrames - selected.length));
  }

  return selected;
}

function downsamplePoseFrames(frames: FramePose[], targetFrames: number): FramePose[] {
  if (frames.length <= targetFrames) return frames;
  const step = frames.length / targetFrames;
  const sampled: FramePose[] = [];
  for (let i = 0; i < targetFrames; i++) {
    const idx = Math.min(frames.length - 1, Math.round(i * step));
    sampled.push(frames[idx]);
  }
  return sampled;
}

async function resolvePythonBinary(): Promise<string | null> {
  const candidates = ['python', 'python3'];
  for (const bin of candidates) {
    const ok = await canRun(bin, ['--version']);
    if (ok) return bin;
  }
  return null;
}

function canRun(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

function runPython(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`python exited with code ${code}`));
    });
  });
}
