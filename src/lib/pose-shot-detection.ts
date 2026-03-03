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

const MIN_GAP_MS = 300;
const MIN_AMPLITUDE = 0.02;
const MIN_SCORE = 0.25;
const MIN_SHOULDER_GAP = 0.02;

const getKeypoint = (frame: FramePose, name: string): Keypoint | undefined =>
  frame.keypoints.find((kp) => kp.name === name);

const getArmSample = (frame: FramePose): { wristY: number; shoulderY: number; score: number } | null => {
  const rightWrist = getKeypoint(frame, 'right_wrist');
  const rightElbow = getKeypoint(frame, 'right_elbow');
  const rightShoulder = getKeypoint(frame, 'right_shoulder');
  const leftWrist = getKeypoint(frame, 'left_wrist');
  const leftElbow = getKeypoint(frame, 'left_elbow');
  const leftShoulder = getKeypoint(frame, 'left_shoulder');

  const rightScore = (rightWrist?.score ?? 0) + (rightElbow?.score ?? 0) + (rightShoulder?.score ?? 0);
  const leftScore = (leftWrist?.score ?? 0) + (leftElbow?.score ?? 0) + (leftShoulder?.score ?? 0);

  const rightValid =
    rightWrist && rightElbow && rightShoulder &&
    (rightWrist.score ?? 0) >= MIN_SCORE &&
    (rightElbow.score ?? 0) >= MIN_SCORE &&
    (rightShoulder.score ?? 0) >= MIN_SCORE;
  const leftValid =
    leftWrist && leftElbow && leftShoulder &&
    (leftWrist.score ?? 0) >= MIN_SCORE &&
    (leftElbow.score ?? 0) >= MIN_SCORE &&
    (leftShoulder.score ?? 0) >= MIN_SCORE;

  if (!rightValid && !leftValid) return null;

  if (rightValid && (!leftValid || rightScore >= leftScore)) {
    return {
      wristY: rightWrist!.y,
      shoulderY: rightShoulder!.y,
      score: rightScore / 3,
    };
  }

  return {
    wristY: leftWrist!.y,
    shoulderY: leftShoulder!.y,
    score: leftScore / 3,
  };
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
  const series: Array<{ tMs: number; wristY: number; shoulderY: number; score: number }> = [];
  for (const frame of frames) {
    const sample = getArmSample(frame);
    if (!sample) continue;
    series.push({ tMs: frame.tMs, wristY: sample.wristY, shoulderY: sample.shoulderY, score: sample.score });
  }
  if (series.length < 5) return [];
  const ys = smoothSeries(series.map((p) => p.wristY));
  const shoulderYs = smoothSeries(series.map((p) => p.shoulderY));
  const releases: Array<{ tMs: number; conf: number }> = [];
  for (let i = 1; i < ys.length - 1; i++) {
    if (!(ys[i] < ys[i - 1] && ys[i] < ys[i + 1])) continue;
    const shoulderGap = shoulderYs[i] - ys[i];
    if (shoulderGap < MIN_SHOULDER_GAP) continue;
    const prevMax = Math.max(...ys.slice(Math.max(0, i - 3), i));
    const nextMax = Math.max(...ys.slice(i + 1, Math.min(ys.length, i + 4)));
    const amplitude = Math.min(prevMax, nextMax) - ys[i];
    if (amplitude < MIN_AMPLITUDE) continue;
    const tMs = series[i].tMs;
    const conf = Math.min(1, (amplitude / 0.12) + (shoulderGap / 0.08));
    releases.push({ tMs, conf });
  }
  if (releases.length === 0) {
    let minIndex = -1;
    let minValue = Infinity;
    for (let i = 0; i < ys.length; i++) {
      if (ys[i] < minValue) {
        minValue = ys[i];
        minIndex = i;
      }
    }
    if (minIndex >= 0) {
      const shoulderGap = shoulderYs[minIndex] - ys[minIndex];
      if (shoulderGap >= MIN_SHOULDER_GAP) {
        releases.push({ tMs: series[minIndex].tMs, conf: 0.35 });
      }
    }
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
