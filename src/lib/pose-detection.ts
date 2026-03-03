export type Keypoint = {
  name: string;
  x: number;
  y: number;
  score?: number;
};

export type FramePose = {
  tMs: number;
  keypoints: Keypoint[];
  frameIndex?: number;
};

export async function extractPosesFromFolder(_framesDir: string, _fps: number): Promise<{ frames: FramePose[] }> {
  // Placeholder: implementación real de pose-detection puede inyectarse luego.
  return { frames: [] };
}

export function calculateBiomechanicalAngles(
  frames: FramePose[]
): Array<{ tMs: number; elbowR?: number; kneeR?: number; hip?: number; wrist?: number; shoulder?: number }> {
  return frames.map((frame) => ({ tMs: frame.tMs }));
}
