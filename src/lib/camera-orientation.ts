/**
 * Detector de orientación de cámara (frontal vs lateral)
 * Usa pose estimation para determinar automáticamente la vista
 */

import { FramePose, Keypoint } from './pose-detection';

export type CameraOrientation = 'frontal' | 'lateral' | 'indeterminado';

export interface CameraOrientationResult {
  orientation: CameraOrientation;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  reasoning: string;
  metrics: {
    shoulderVisibility: number;
    hipVisibility: number;
    shoulderVisDiffAvg: number;
    earVisDiffAvg: number;
    wristVerticalityAvg: number;
    shoulderVisSignals: number;
    earVisSignals: number;
    wristSignals: number;
    lateralStrength: number;
    frontalStrength: number;
  };
}

export interface DetectCameraOrientationOptions {
  /** Permitir override manual desde UI ("forzar lateral" / "forzar frontal") */
  hint?: Exclude<CameraOrientation, 'indeterminado'>;
  /** Tiempo inicial del gesto principal (t0) en ms para centrar la ventana de análisis */
  t0Ms?: number;
}

const MIN_SCORE = 0.25;
const EPS = 1e-6;

function getKeypoint(frame: FramePose, name: Keypoint['name']): Keypoint | null {
  const kp = frame.keypoints.find(k => k.name === name);
  return kp && kp.score >= MIN_SCORE ? kp : null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Detecta orientación de cámara basado en pose estimation
 * 
 * Lógica:
 * - Vista frontal: hombros y caderas simétricos (misma altura, posición similar)
 * - Vista lateral: hombros/caderas asimétricos (uno más adelante/atrás, diferentes alturas)
 */
export function detectCameraOrientation(
  frames: FramePose[],
  options?: DetectCameraOrientationOptions
): CameraOrientationResult {
  if (!frames || frames.length === 0) {
    return {
      orientation: 'indeterminado',
      confidence: 'low',
      confidenceScore: 0,
      reasoning: 'No hay frames de pose disponibles',
      metrics: {
        shoulderVisibility: 0,
        hipVisibility: 0,
        shoulderVisDiffAvg: 0,
        earVisDiffAvg: 0,
        wristVerticalityAvg: 0,
        shoulderVisSignals: 0,
        earVisSignals: 0,
        wristSignals: 0,
        lateralStrength: 0,
        frontalStrength: 0,
      },
    };
  }
  const sortedFrames = [...frames].sort((a, b) => a.tMs - b.tMs);
  const t0 = options?.t0Ms ?? sortedFrames[Math.floor(sortedFrames.length / 2)].tMs;
  const halfWindow = 15;
  const t0Index = sortedFrames.findIndex(f => f.tMs >= t0);
  const startIdx = t0Index >= 0 ? Math.max(0, t0Index - halfWindow) : 0;
  const endIdx = t0Index >= 0 ? Math.min(sortedFrames.length, t0Index + halfWindow) : Math.min(sortedFrames.length, startIdx + 2 * halfWindow);
  const windowFrames = sortedFrames.slice(startIdx, endIdx);

  let shoulderVisibleCount = 0;
  let hipVisibleCount = 0;

  const shoulderVisDiff: number[] = [];
  const earVisDiff: number[] = [];
  const wristVerticalRatios: number[] = [];

  for (let i = 0; i < windowFrames.length; i++) {
    const frame = windowFrames[i];
    const prev = i > 0 ? windowFrames[i - 1] : null;

    const leftShoulder = getKeypoint(frame, 'left_shoulder');
    const rightShoulder = getKeypoint(frame, 'right_shoulder');
    const leftHip = getKeypoint(frame, 'left_hip');
    const rightHip = getKeypoint(frame, 'right_hip');
    const leftEar = getKeypoint(frame, 'left_ear');
    const rightEar = getKeypoint(frame, 'right_ear');
    const leftWrist = getKeypoint(frame, 'left_wrist');
    const rightWrist = getKeypoint(frame, 'right_wrist');

    const shouldersVisible = !!leftShoulder && !!rightShoulder;
    const hipsVisible = !!leftHip && !!rightHip;

    if (shouldersVisible) {
      shoulderVisibleCount++;
      const diff = Math.abs((rightShoulder?.score ?? 0) - (leftShoulder?.score ?? 0));
      shoulderVisDiff.push(diff);
    }

    if (hipsVisible) {
      hipVisibleCount++;
    }

    if (leftEar && rightEar) {
      earVisDiff.push(Math.abs(rightEar.score - leftEar.score));
    }

    // Movimiento de muñeca predominante (comparar delta Y vs delta X)
    const wrist = rightWrist && (!leftWrist || rightWrist.score >= leftWrist.score) ? rightWrist : leftWrist;
    if (wrist && prev) {
      const prevLeftWrist = getKeypoint(prev, 'left_wrist');
      const prevRightWrist = getKeypoint(prev, 'right_wrist');
      const prevWrist = wrist?.name === 'right_wrist' ? prevRightWrist : prevLeftWrist;
      if (prevWrist) {
        const dx = wrist.x - prevWrist.x;
        const dy = wrist.y - prevWrist.y;
        const ratio = Math.abs(dy) / Math.max(Math.abs(dx), EPS);
        if (Number.isFinite(ratio)) {
          wristVerticalRatios.push(ratio);
        }
      }
    }
  }

  const shoulderVisDiffAvg = average(shoulderVisDiff);
  const earVisDiffAvg = average(earVisDiff);
  const wristVerticalityAvg = average(wristVerticalRatios);

  const contributions: Array<{ orientation: 'lateral' | 'frontal'; weight: number }> = [];

  if (shoulderVisDiff.length > 0) {
    if (shoulderVisDiffAvg >= 0.12) {
      contributions.push({ orientation: 'lateral', weight: clamp((shoulderVisDiffAvg - 0.1) / 0.4, 0, 1) });
    } else if (shoulderVisDiffAvg <= 0.06) {
      contributions.push({ orientation: 'frontal', weight: clamp((0.1 - shoulderVisDiffAvg) / 0.1, 0, 1) });
    }
  }

  if (earVisDiff.length > 0) {
    if (earVisDiffAvg >= 0.2) {
      contributions.push({ orientation: 'lateral', weight: clamp((earVisDiffAvg - 0.15) / 0.5, 0, 1) });
    } else if (earVisDiffAvg <= 0.08) {
      contributions.push({ orientation: 'frontal', weight: clamp((0.12 - earVisDiffAvg) / 0.12, 0, 1) });
    }
  }

  if (wristVerticalRatios.length > 0) {
    if (wristVerticalityAvg >= 1.2) {
      contributions.push({ orientation: 'lateral', weight: clamp((wristVerticalityAvg - 1.0) / 1.5, 0, 1) });
    } else if (wristVerticalityAvg <= 0.7) {
      contributions.push({ orientation: 'frontal', weight: clamp((0.9 - wristVerticalityAvg) / 0.9, 0, 1) });
    }
  }

  const lateralStrength = contributions
    .filter(c => c.orientation === 'lateral')
    .reduce((sum, c) => sum + c.weight, 0);
  const frontalStrength = contributions
    .filter(c => c.orientation === 'frontal')
    .reduce((sum, c) => sum + c.weight, 0);
  const totalStrength = lateralStrength + frontalStrength;

  const lacksVariation = shoulderVisDiffAvg < 0.02 && earVisDiffAvg < 0.02 && wristVerticalRatios.length === 0;

  const shoulderVisibility = clamp(shoulderVisibleCount / Math.max(windowFrames.length, 1), 0, 1);
  const hipVisibility = clamp(hipVisibleCount / Math.max(windowFrames.length, 1), 0, 1);

  let orientation: CameraOrientation = 'indeterminado';
  let confidenceScore = totalStrength > 0 ? clamp(totalStrength / contributions.length, 0, 1) : 0;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let reasoning = 'Orientación no determinada (insuficientes señales confiables).';

  if (options?.hint) {
    orientation = options.hint;
    confidence = 'high';
    confidenceScore = 1;
    reasoning = `Orientación forzada manualmente a vista ${options.hint}.`;
  } else if (shoulderVisibility < 0.2) {
    orientation = 'indeterminado';
    confidence = 'low';
    confidenceScore = 0;
    reasoning = 'Visibilidad insuficiente de hombros para determinar orientación.';
  } else if (lacksVariation) {
    orientation = 'indeterminado';
    confidence = 'low';
    confidenceScore = 0;
    reasoning = 'Señales insuficientes: no se detecta variación entre hombros, orejas ni muñeca.';
  } else if (totalStrength === 0) {
    orientation = 'indeterminado';
    confidence = 'low';
    reasoning = 'No se obtuvieron señales suficientes para inferir la orientación.';
  } else if (lateralStrength > frontalStrength) {
    orientation = 'lateral';
    confidence = confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.6 ? 'medium' : 'low';
    reasoning = `Vista lateral detectada (fuerza ${lateralStrength.toFixed(2)} vs ${frontalStrength.toFixed(2)}).`;
  } else if (frontalStrength > lateralStrength) {
    orientation = 'frontal';
    confidence = confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.6 ? 'medium' : 'low';
    reasoning = `Vista frontal detectada (fuerza ${frontalStrength.toFixed(2)} vs ${lateralStrength.toFixed(2)}).`;
  }

  return {
    orientation,
    confidence,
    confidenceScore,
    reasoning,
    metrics: {
      shoulderVisibility,
      hipVisibility,
      shoulderVisDiffAvg,
      earVisDiffAvg,
      wristVerticalityAvg,
      shoulderVisSignals: shoulderVisDiff.length,
      earVisSignals: earVisDiff.length,
      wristSignals: wristVerticalRatios.length,
      lateralStrength,
      frontalStrength,
    },
  };
}

/**
 * Determina qué análisis es posible según la orientación
 */
export function getAnalysisCapabilities(orientation: CameraOrientation): {
  canAnalyzeSequence: boolean;
  canAnalyzeSetPoint: boolean;
  canAnalyzeRelease: boolean;
  canAnalyzeFluidity: boolean;
  recommendation: string;
} {
  switch (orientation) {
    case 'frontal':
      return {
        canAnalyzeSequence: false, // Dificultad para detectar cadera/tronco/brazo
        canAnalyzeSetPoint: true,   // Elevación visible
        canAnalyzeRelease: true,    // Liberación visible
        canAnalyzeFluidity: true,   // Movimiento general visible
        recommendation: 'Vista frontal detectada. Para análisis completo de cadena cinética (cadera-tronco-brazo), recomendamos subir un video de perfil.',
      };
    case 'lateral':
      return {
        canAnalyzeSequence: true,   // Cadena completa visible
        canAnalyzeSetPoint: true,
        canAnalyzeRelease: true,
        canAnalyzeFluidity: true,
        recommendation: 'Vista lateral detectada. Análisis completo de cadena cinética disponible.',
      };
    default:
      return {
        canAnalyzeSequence: false,
        canAnalyzeSetPoint: true,   // Intentar siempre
        canAnalyzeRelease: true,
        canAnalyzeFluidity: true,
        recommendation: 'Orientación no determinada. El análisis puede ser parcial.',
      };
  }
}

