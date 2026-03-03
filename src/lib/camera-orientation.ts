import type { FramePose } from './pose-detection';

export type CameraOrientation = 'lateral' | 'frontal' | 'unknown';

export type CameraOrientationResult = {
  orientation: CameraOrientation;
  confidence: 'low' | 'medium' | 'high';
  confidenceScore: number;
  reasoning: string;
  metrics: Record<string, number>;
};

export function detectCameraOrientation(
  frames: FramePose[],
  opts?: { hint?: 'lateral' | 'frontal' }
): CameraOrientationResult {
  if (opts?.hint) {
    return {
      orientation: opts.hint,
      confidence: 'high',
      confidenceScore: 0.9,
      reasoning: 'hint',
      metrics: { frameCount: frames.length },
    };
  }
  return {
    orientation: 'unknown',
    confidence: 'low',
    confidenceScore: 0.2,
    reasoning: 'insufficient_data',
    metrics: { frameCount: frames.length },
  };
}

export function getAnalysisCapabilities(orientation: CameraOrientation) {
  const canAnalyze = orientation !== 'unknown';
  return {
    canAnalyzeSequence: canAnalyze,
    canAnalyzeSetPoint: canAnalyze,
    canAnalyzeRelease: canAnalyze,
  };
}
