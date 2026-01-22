import { GoogleAuth } from 'google-auth-library';
import type { FramePose, Keypoint } from './pose-detection';

const POSE_SERVICE_URL = process.env.POSE_SERVICE_URL || '';

type ShotDetection = {
  shots_count: number;
  shots: Array<{
    track_id: number;
    idx: number;
    start_ms: number;
    load_ms: number | null;
    release_ms: number;
    apex_ms: number | null;
    landing_ms: number | null;
    end_ms: number;
    estimated: boolean;
    conf: number;
    notes: string[];
  }>;
  diagnostics: {
    fps_assumed: number | null;
    frames_total: number | null;
    policy: {
      min_shot_ms: number;
      max_shot_ms: number;
      refractory_gap_ms: number;
      merge_gap_ms: number;
    };
    rejected_segments: number;
  };
};

const MIN_GAP_MS = 450;
const MIN_AMPLITUDE = 0.03;

const getKeypoint = (frame: FramePose, name: string): Keypoint | undefined =>
  frame.keypoints.find((kp) => kp.name === name);

const getWristY = (frame: FramePose): number | null => {
  const right = getKeypoint(frame, 'right_wrist');
  if (right && (right.score ?? 0) >= 0.4) return right.y;
  const left = getKeypoint(frame, 'left_wrist');
  if (left && (left.score ?? 0) >= 0.4) return left.y;
  return null;
};

const smoothSeries = (values: number[]): number[] => {
  if (values.length <= 2) return values;
  return values.map((v, i) => {
    const prev = values[i - 1] ?? v;
    const next = values[i + 1] ?? v;
    return (prev + v + next) / 3;
  });
};

const findReleases = (frames: FramePose[]): Array<{ tMs: number; conf: number }> => {
  const series: Array<{ tMs: number; y: number }> = [];
  for (const frame of frames) {
    const y = getWristY(frame);
    if (y == null) continue;
    series.push({ tMs: frame.tMs, y });
  }
  if (series.length < 5) return [];
  const ys = smoothSeries(series.map((p) => p.y));
  const releases: Array<{ tMs: number; conf: number }> = [];
  for (let i = 1; i < ys.length - 1; i++) {
    if (!(ys[i] < ys[i - 1] && ys[i] < ys[i + 1])) continue;
    const prevMax = Math.max(...ys.slice(Math.max(0, i - 3), i));
    const nextMax = Math.max(...ys.slice(i + 1, Math.min(ys.length, i + 4)));
    const amplitude = Math.min(prevMax, nextMax) - ys[i];
    if (amplitude < MIN_AMPLITUDE) continue;
    const tMs = series[i].tMs;
    const conf = Math.min(1, amplitude / 0.12);
    releases.push({ tMs, conf });
  }
  const filtered: Array<{ tMs: number; conf: number }> = [];
  for (const rel of releases) {
    const last = filtered[filtered.length - 1];
    if (!last || rel.tMs - last.tMs >= MIN_GAP_MS) {
      filtered.push(rel);
    }
  }
  return filtered;
};

const buildShotFromRelease = (releaseMs: number, conf: number, idx: number) => {
  const start_ms = Math.max(0, Math.round(releaseMs - 600));
  const end_ms = Math.round(releaseMs + 400);
  return {
    track_id: 1,
    idx,
    start_ms,
    load_ms: Math.max(0, Math.round(releaseMs - 300)),
    release_ms: Math.round(releaseMs),
    apex_ms: null,
    landing_ms: null,
    end_ms,
    estimated: true,
    conf: Number(conf.toFixed(2)),
    notes: ['Pico de muñeca detectado (pose)'],
  };
};

export async function detectShotsFromPoseService(
  videoUrl: string,
  targetFrames = 48
): Promise<ShotDetection | null> {
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
    if (!data || !Array.isArray(data.frames)) return null;
    const frames: FramePose[] = data.frames.map((frame: any) => ({
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
    const releases = findReleases(frames);
    if (releases.length === 0) return null;
    const shots = releases.map((rel, i) => buildShotFromRelease(rel.tMs, rel.conf, i + 1));
    return {
      shots_count: shots.length,
      shots,
      diagnostics: {
        fps_assumed: null,
        frames_total: frames.length,
        policy: {
          min_shot_ms: 300,
          max_shot_ms: 8000,
          refractory_gap_ms: MIN_GAP_MS,
          merge_gap_ms: 200,
        },
        rejected_segments: 0,
      },
    };
  } catch {
    return null;
  }
}
