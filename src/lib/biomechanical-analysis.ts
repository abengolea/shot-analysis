/**
 * Módulo de análisis biomecánico determinista
 * Calcula métricas objetivas sin depender del LLM para números
 */

import { z } from 'zod';
import { FramePose } from './pose-detection';

// ============================================================================
// SCHEMAS DETERMINISTAS (unidades claras, referencias temporales fijas)
// ============================================================================

// Unidades: tiempo en ms desde t0; ángulos en grados; velocidades en °/s
export const JointAnglesSchema = z.object({
  tMs: z.number().int().nonnegative(),
  hipDeg: z.number().min(-180).max(180).optional(),
  kneeDeg: z.number().min(-180).max(180).optional(),
  ankleDeg: z.number().min(-180).max(180).optional(),
  shoulderDeg: z.number().min(-180).max(180).optional(),
  elbowDeg: z.number().min(-180).max(180).optional(),
  wristDeg: z.number().min(-180).max(180).optional(),
});

export const SegmentVelSchema = z.object({
  tMs: z.number().int().nonnegative(),
  hipVel: z.number().optional(),      // °/s
  kneeVel: z.number().optional(),
  shoulderVel: z.number().optional(),
  elbowVel: z.number().optional(),
  wristVel: z.number().optional(),
});

export const PhaseMarkersSchema = z.object({
  t0_start: z.number().int(),             // onset de extensión de rodilla
  t_setPoint: z.number().int().optional(),// pico de elevación de balón
  t_release: z.number().int().optional(), // instante de liberación
});

export const BiomechDeterministicInput = z.object({
  videoUrl: z.string().url(),
  fps: z.number().positive(),
  jointAngles: z.array(JointAnglesSchema).min(5),
  segmentVels: z.array(SegmentVelSchema).min(5),
  phases: PhaseMarkersSchema,
  normalization: z.object({
    shoulderHipDistPx: z.number().positive(), // media por clip
    cameraHint: z.enum(['lateral','frontal','otro']).optional(),
  }),
});

// Salida determinista 100% numérica
export const BiomechDeterministicOutput = z.object({
  efficiencyIndex: z.number().min(0).max(100),
  sequence: z.array(z.object({
    segment: z.enum(['piernas','cadera','tronco','brazo','muñeca','dedos']),
    onsetMs: z.number().int().nullable().optional(),
    peakVelMs: z.number().int().optional(),
    order: z.number().int().nullable().optional(),
    status: z.enum(['correcto','mejorable','incorrecto','no_detectado']),
    delayMs: z.number().int().optional(),
  })).min(6), // Siempre debe tener 6 segmentos
  timing: z.object({
    setPointMs: z.number().int().optional(),
    releaseMs: z.number().int().optional(),
    releaseVsLegsMs: z.number().int().optional(), // release - t0
  }),
  metrics: z.object({
    fluidityScore: z.number().min(0).max(100),
    energyLeakPct: z.number().min(0).max(100),
    setPointScore: z.number().min(0).max(100),
    sequenceDelayMs: z.number().int(),
  }),
});

export type JointAngles = z.infer<typeof JointAnglesSchema>;
export type SegmentVel = z.infer<typeof SegmentVelSchema>;
export type PhaseMarkers = z.infer<typeof PhaseMarkersSchema>;
export type BiomechDeterministicInput = z.infer<typeof BiomechDeterministicInput>;
export type BiomechDeterministicOutput = z.infer<typeof BiomechDeterministicOutput>;

// ============================================================================
// FUNCIONES DE PROCESAMIENTO DETERMINISTA
// ============================================================================

/**
 * Convierte ángulos calculados a formato normalizado
 */
export function normalizeAngles(angles: Array<{tMs: number, elbowR?: number, kneeR?: number, hip?: number, wrist?: number, shoulder?: number}>): JointAngles[] {
  return angles.map(a => ({
    tMs: Math.round(a.tMs),
    elbowDeg: a.elbowR !== undefined ? a.elbowR : undefined,
    kneeDeg: a.kneeR !== undefined ? a.kneeR : undefined,
    hipDeg: a.hip !== undefined ? a.hip : undefined,
    wristDeg: a.wrist !== undefined ? a.wrist : undefined,
    shoulderDeg: a.shoulder !== undefined ? a.shoulder : undefined,
  }));
}

/**
 * Calcula velocidades angulares derivando ángulos
 * Usa diferencia finita con suavizado temporal
 */
export function calculateSegmentVelocities(
  angles: JointAngles[],
  fps: number
): SegmentVel[] {
  if (angles.length < 3) return [];
  
  const dt = 1000 / fps; // ms entre frames
  
  const rawVelocities = angles.map((angle, i) => {
    const prev = i > 0 ? angles[i - 1] : angle;
    const next = i < angles.length - 1 ? angles[i + 1] : angle;
    
    const hipVel = angle.hipDeg !== undefined && prev.hipDeg !== undefined && next.hipDeg !== undefined
      ? ((next.hipDeg - prev.hipDeg) / (2 * dt)) * 1000 // convertir a °/s
      : undefined;
    
    const kneeVel = angle.kneeDeg !== undefined && prev.kneeDeg !== undefined && next.kneeDeg !== undefined
      ? ((next.kneeDeg - prev.kneeDeg) / (2 * dt)) * 1000
      : undefined;
    
    const shoulderVel = angle.shoulderDeg !== undefined && prev.shoulderDeg !== undefined && next.shoulderDeg !== undefined
      ? ((next.shoulderDeg - prev.shoulderDeg) / (2 * dt)) * 1000
      : undefined;
    
    const elbowVel = angle.elbowDeg !== undefined && prev.elbowDeg !== undefined && next.elbowDeg !== undefined
      ? ((next.elbowDeg - prev.elbowDeg) / (2 * dt)) * 1000
      : undefined;
    
    const wristVel = angle.wristDeg !== undefined && prev.wristDeg !== undefined && next.wristDeg !== undefined
      ? ((next.wristDeg - prev.wristDeg) / (2 * dt)) * 1000
      : undefined;
    
    return {
      tMs: angle.tMs,
      hipVel,
      kneeVel,
      shoulderVel,
      elbowVel,
      wristVel,
    };
  });

  return smoothVelocitySeries(rawVelocities);
}

function smoothVelocitySeries(series: SegmentVel[]): SegmentVel[] {
  const keys: Array<keyof SegmentVel> = ['hipVel', 'kneeVel', 'shoulderVel', 'elbowVel', 'wristVel'];
  const smoothed = series.map(entry => ({ ...entry }));

  for (const key of keys) {
    const values = series.map(entry => (typeof entry[key] === 'number' ? (entry[key] as number) : null));
    const smoothedValues = applySavitzkyGolay(values);
    smoothedValues.forEach((value, idx) => {
      if (value !== null) {
        smoothed[idx][key] = value;
      }
    });
  }

  return smoothed;
}

function applySavitzkyGolay(values: Array<number | null>, windowSize = 7): Array<number | null> {
  if (values.length < windowSize) {
    return values.slice();
  }

  const halfWindow = Math.floor(windowSize / 2);
  // Coeficientes para ventana 7, polinomio 2 (Savitzky-Golay)
  const coefficients = [-2, 3, 6, 7, 6, 3, -2].map(c => c / 21);

  const result: Array<number | null> = values.map((value, idx) => {
    if (value === null) return null;

    let acc = 0;
    let weight = 0;

    for (let k = -halfWindow; k <= halfWindow; k++) {
      const neighborIndex = idx + k;
      if (neighborIndex < 0 || neighborIndex >= values.length) continue;
      const neighborValue = values[neighborIndex];
      if (neighborValue === null) continue;
      const coeff = coefficients[k + halfWindow];
      acc += coeff * neighborValue;
      weight += coeff;
    }

    if (weight === 0) {
      return value;
    }

    return acc / weight;
  });

  return result;
}

/**
 * Detecta t0: inicio de extensión de rodilla
 * Busca primer frame donde kneeVel pasa de negativa/≈0 a positiva por encima de umbral
 */
export function detectT0(
  velocities: SegmentVel[],
  threshold: number = 50, // °/s
  hysteresisFrames: number = 3
): number {
  let consecutivePositive = 0;
  
  for (let i = 1; i < velocities.length; i++) {
    const vel = velocities[i].kneeVel || 0;
    const prevVel = velocities[i - 1].kneeVel || 0;
    
    // Detectar cambio de negativo/cero a positivo
    if (prevVel <= threshold && vel > threshold) {
      consecutivePositive++;
      if (consecutivePositive >= hysteresisFrames) {
        return velocities[i].tMs;
      }
    } else if (vel <= threshold) {
      consecutivePositive = 0;
    }
  }
  
  // Fallback: primer frame con kneeVel > threshold
  for (const v of velocities) {
    if (v.kneeVel && v.kneeVel > threshold) {
      return v.tMs;
    }
  }
  
  return velocities[0]?.tMs || 0;
}

/**
 * Detecta onset de activación de un segmento con umbrales adaptativos
 * Usa umbral relativo (20% del pico) + umbral absoluto de guardarraíl
 * Requiere sostenimiento de 3 frames
 */
export function detectOnset(
  velocities: SegmentVel[],
  t0: number,
  segmentKey: 'hipVel' | 'kneeVel' | 'shoulderVel' | 'elbowVel' | 'wristVel',
  thresholdPercent: number = 20, // % del pico máximo (relativo 0.20)
  minFrames: number = 3, // Sostenimiento mínimo de 3 frames
  absoluteThreshold?: number // Umbral absoluto de guardarraíl (°/s)
): { onsetMs: number; peakVelMs?: number; peakVel: number; confidence: 'high' | 'medium' | 'low' } | null {
  const relevantVels = velocities
    .filter(v => v.tMs >= t0 && v.tMs <= t0 + 1500) // Ventana de 1.5s después de t0
    .map(v => ({ tMs: v.tMs, vel: v[segmentKey] || 0 }))
    .filter(v => v.vel !== undefined && v.vel !== null); // Incluir negativos también
  
  if (relevantVels.length === 0) {
    console.warn(`⚠️ [detectOnset] No hay velocidades para ${segmentKey} en ventana t0+1500ms`);
    return null;
  }
  
  // Usar valores absolutos para detectar movimiento (puede ser positivo o negativo)
  const relevantVelsAbs = relevantVels.map(v => ({ tMs: v.tMs, vel: Math.abs(v.vel) }));
  
  // Umbrales absolutos según segmento (ajustados según plan del usuario)
  const defaultAbsoluteThresholds: Record<string, number> = {
    'hipVel': 20,    // °/s para cadera (guardrail)
    'shoulderVel': 20, // °/s para tronco/hombro (guardrail)
    'elbowVel': 30,   // °/s para brazo (guardrail)
    'wristVel': 30,   // °/s para muñeca
    'kneeVel': 15,    // °/s para rodilla
  };
  
  const absThreshold = absoluteThreshold || defaultAbsoluteThresholds[segmentKey] || 20;
  
  // Calcular pico y umbrales (usar valores absolutos)
  const peakVel = Math.max(...relevantVelsAbs.map(v => v.vel));
  const relativeThreshold = (peakVel * thresholdPercent) / 100;
  
  // Logging detallado
  if (peakVel < absThreshold) {
    console.warn(`⚠️ [detectOnset] ${segmentKey}: peakVel=${peakVel.toFixed(1)}°/s < absThreshold=${absThreshold}°/s`);
  }
  
  const finalThreshold = Math.max(relativeThreshold, absThreshold);
  
  // Detectar onset con sostenimiento (usar valores absolutos)
  let consecutiveAbove = 0;
  let onsetMs: number | null = null;
  let peakVelMs: number | null = null;
  
  for (const v of relevantVelsAbs) {
    if (v.vel >= finalThreshold) {
      consecutiveAbove++;
      if (onsetMs === null && consecutiveAbove >= minFrames) {
        // Usar el primer frame del sostenimiento como onset
        onsetMs = v.tMs;
      }
      if (v.vel === peakVel) {
        peakVelMs = v.tMs;
      }
    } else {
      consecutiveAbove = 0;
    }
  }
  
  if (onsetMs === null) {
    // Si no se detectó con threshold normal, intentar con threshold más bajo (15%)
    const lowerThreshold = Math.max((peakVel * 15) / 100, absThreshold * 0.75);
    consecutiveAbove = 0;
    
    console.log(`🔄 [detectOnset] ${segmentKey}: Reintentando con threshold más bajo: ${lowerThreshold.toFixed(1)}°/s (peakVel=${peakVel.toFixed(1)}°/s)`);
    
    for (const v of relevantVelsAbs) {
      if (v.vel >= lowerThreshold) {
        consecutiveAbove++;
        if (onsetMs === null && consecutiveAbove >= minFrames) {
          onsetMs = v.tMs;
          if (v.vel === peakVel) {
            peakVelMs = v.tMs;
          }
        }
      } else {
        consecutiveAbove = 0;
      }
    }
  }
  
  if (onsetMs === null) return null;
  
  // Calcular confianza
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (peakVel >= absThreshold * 2 && onsetMs <= t0 + 800) {
    confidence = 'high';
  } else if (peakVel < absThreshold * 1.2 || onsetMs > t0 + 1200) {
    confidence = 'low';
  }
  
  return { 
    onsetMs, 
    peakVelMs: peakVelMs || undefined, 
    peakVel,
    confidence
  };
}

/**
 * Detecta set-point usando múltiples proxies (sin balón)
 * Retorna siempre una estimación con confianza, nunca null
 */
export function detectSetPoint(
  angles: JointAngles[],
  velocities: SegmentVel[],
  t0: number,
  frames?: FramePose[]
): { setPointMs: number; confidence: 'high' | 'medium' | 'low'; method: string } {
  const relevant = angles.filter(a => a.tMs >= t0 && a.tMs <= t0 + 1000);
  
  if (relevant.length === 0) {
    // Fallback: estimar basado en timing esperado (400ms después de t0)
    return {
      setPointMs: t0 + 400,
      confidence: 'low',
      method: 'timing-estimado'
    };
  }
  
  // PROXY 1: Máximo de elevación de hombro (ángulo hombro vertical)
  let maxShoulderElev = -Infinity;
  let setPointShoulder: number | null = null;
  
  for (const angle of relevant) {
    const shoulderElev = angle.shoulderDeg || 0;
    if (shoulderElev > maxShoulderElev) {
      maxShoulderElev = shoulderElev;
      setPointShoulder = angle.tMs;
    }
  }
  
  // PROXY 2: Combinación hombro + codo (codo cerca de 90-120°)
  let maxCombined = -Infinity;
  let setPointCombined: number | null = null;
  
  for (const angle of relevant) {
    const elbow = angle.elbowDeg || 0;
    const shoulder = angle.shoulderDeg || 0;
    // Preferir codo en rango 90-120° (extensión parcial, típica del set-point)
    const elbowScore = (elbow >= 90 && elbow <= 120) ? 1.5 : 1.0;
    const combined = shoulder + (elbow * 0.5 * elbowScore);
    if (combined > maxCombined) {
      maxCombined = combined;
      setPointCombined = angle.tMs;
    }
  }
  
  // PROXY 3: Máximo de elevación de muñeca relativa a cadera (si hay frames)
  let setPointWrist: number | null = null;
  let maxWristElev = -Infinity;
  
  if (frames && frames.length > 0) {
    const relevantFrames = frames.filter(f => {
      const tMs = f.tMs;
      return tMs >= t0 && tMs <= t0 + 1000;
    });
    
    for (const frame of relevantFrames) {
      const wrist = frame.keypoints.find(kp => kp.name === 'right_wrist');
      const hip = frame.keypoints.find(kp => kp.name === 'right_hip');
      const shoulder = frame.keypoints.find(kp => kp.name === 'right_shoulder');
      
      if (wrist && hip && shoulder && 
          (wrist.score ?? 0) > 0.3 && (hip.score ?? 0) > 0.3 && (shoulder.score ?? 0) > 0.3) {
        // Elevación normalizada: distancia muñeca-cadera en Y / distancia hombro-cadera
        const shoulderHipDist = Math.sqrt(
          Math.pow(shoulder.x - hip.x, 2) + Math.pow(shoulder.y - hip.y, 2)
        );
        const wristHipDistY = Math.abs(wrist.y - hip.y);
        const normalizedElev = shoulderHipDist > 0 ? wristHipDistY / shoulderHipDist : 0;
        
        if (normalizedElev > maxWristElev) {
          maxWristElev = normalizedElev;
          setPointWrist = frame.tMs;
        }
      }
    }
  }
  
  // PROXY 4: Mínima distancia mano-cabeza (si hay frames)
  let setPointHandHead: number | null = null;
  let minHandHeadDist = Infinity;
  
  if (frames && frames.length > 0) {
    const relevantFrames = frames.filter(f => {
      const tMs = f.tMs;
      return tMs >= t0 && tMs <= t0 + 1000;
    });
    
    for (const frame of relevantFrames) {
      const wrist = frame.keypoints.find(kp => kp.name === 'right_wrist');
      const nose = frame.keypoints.find(kp => kp.name === 'nose');
      
      if (wrist && nose && (wrist.score ?? 0) > 0.3 && (nose.score ?? 0) > 0.3) {
        const dist = Math.sqrt(
          Math.pow(wrist.x - nose.x, 2) + Math.pow(wrist.y - nose.y, 2)
        );
        if (dist < minHandHeadDist) {
          minHandHeadDist = dist;
          setPointHandHead = frame.tMs;
        }
      }
    }
  }
  
  // Calcular coherencia para cada proxy (velocidad de brazo alta antes del pico)
  const candidates: Array<{ tMs: number; score: number; method: string }> = [];
  
  if (setPointShoulder) {
    const velBefore = velocities.find(v => 
      v.tMs >= setPointShoulder! - 100 && v.tMs < setPointShoulder!
    );
    const coherence = velBefore && (velBefore.elbowVel || 0) > 40 ? 1.2 : 1.0;
    candidates.push({
      tMs: setPointShoulder,
      score: maxShoulderElev * coherence,
      method: 'proxy-hombro'
    });
  }
  
  if (setPointCombined) {
    const velBefore = velocities.find(v => 
      v.tMs >= setPointCombined! - 100 && v.tMs < setPointCombined!
    );
    const coherence = velBefore && (velBefore.elbowVel || 0) > 40 ? 1.3 : 1.0;
    candidates.push({
      tMs: setPointCombined,
      score: maxCombined * coherence,
      method: 'proxy-hombro-codo'
    });
  }
  
  if (setPointWrist) {
    candidates.push({
      tMs: setPointWrist,
      score: maxWristElev * 100, // Escalar para comparar
      method: 'proxy-muñeca-cadera'
    });
  }
  
  if (setPointHandHead) {
    candidates.push({
      tMs: setPointHandHead,
      score: (1 / minHandHeadDist) * 100, // Inverso de distancia (más cerca = mejor)
      method: 'proxy-mano-cabeza'
    });
  }
  
  // Elegir mejor candidato
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    
    // Calcular confianza
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (candidates.length >= 2 && Math.abs(candidates[0].tMs - candidates[1].tMs) < 120) {
      // Múltiples proxies coinciden → alta confianza
      confidence = 'high';
    } else if (best.tMs < t0 + 300 || best.tMs > t0 + 700) {
      // Fuera del rango esperado (400ms ± 100ms)
      confidence = 'low';
    }
    
    return {
      setPointMs: best.tMs,
      confidence,
      method: best.method
    };
  }
  
  // Fallback final: timing estimado
  return {
    setPointMs: t0 + 400,
    confidence: 'low',
    method: 'timing-estimado'
  };
}

/**
 * Detecta release usando múltiples proxies
 * Retorna siempre una estimación con confianza, nunca null
 */
export function detectRelease(
  velocities: SegmentVel[],
  setPoint: number | null,
  t0: number,
  frames?: FramePose[]
): { releaseMs: number; confidence: 'high' | 'medium' | 'low'; method: string } {
  const startMs = setPoint || t0 + 400;
  const relevant = velocities.filter(v => v.tMs >= startMs && v.tMs <= startMs + 500);
  
  if (relevant.length === 0) {
    // Fallback: estimar basado en timing esperado (650ms después de t0)
    return {
      releaseMs: t0 + 650,
      confidence: 'low',
      method: 'timing-estimado'
    };
  }
  
  // PROXY 1: Pico de velocidad de muñeca después del set-point
  let maxWristVel = -Infinity;
  let releaseWrist: number | null = null;
  
  for (const v of relevant) {
    const vel = v.wristVel || 0;
    if (vel > maxWristVel) {
      maxWristVel = vel;
      releaseWrist = v.tMs;
    }
  }
  
  // PROXY 2: Pico de velocidad de codo seguido de pico de muñeca dentro de 120ms
  let releaseElbowWrist: number | null = null;
  let maxElbowVel = -Infinity;
  let elbowPeakMs: number | null = null;
  
  for (const v of relevant) {
    const elbowVel = v.elbowVel || 0;
    if (elbowVel > maxElbowVel) {
      maxElbowVel = elbowVel;
      elbowPeakMs = v.tMs;
    }
  }
  
  if (elbowPeakMs && releaseWrist) {
    const timeDiff = Math.abs(releaseWrist - elbowPeakMs);
    if (timeDiff <= 120) {
      // Usar el pico de muñeca si está cerca del pico de codo
      releaseElbowWrist = releaseWrist;
    }
  }
  
  // PROXY 3: Aumento de distancia mano-cabeza (si hay frames)
  let releaseHandHead: number | null = null;
  const maxHandHeadDist = -Infinity;
  
  if (frames && frames.length > 0) {
    const relevantFrames = frames.filter(f => {
      const tMs = f.tMs;
      return tMs >= startMs && tMs <= startMs + 500;
    });
    
    // Buscar distancia mínima (set-point) y luego aumento
    let minDist = Infinity;
    let minDistMs = startMs;
    
    for (const frame of relevantFrames) {
      const wrist = frame.keypoints.find(kp => kp.name === 'right_wrist');
      const nose = frame.keypoints.find(kp => kp.name === 'nose');
      
      if (wrist && nose && (wrist.score ?? 0) > 0.3 && (nose.score ?? 0) > 0.3) {
        const dist = Math.sqrt(
          Math.pow(wrist.x - nose.x, 2) + Math.pow(wrist.y - nose.y, 2)
        );
        if (dist < minDist) {
          minDist = dist;
          minDistMs = frame.tMs;
        }
      }
    }
    
    // Buscar primer frame donde la distancia aumenta significativamente después del mínimo
    for (const frame of relevantFrames) {
      if (frame.tMs <= minDistMs) continue;
      
      const wrist = frame.keypoints.find(kp => kp.name === 'right_wrist');
      const nose = frame.keypoints.find(kp => kp.name === 'nose');
      
      if (wrist && nose && (wrist.score ?? 0) > 0.3 && (nose.score ?? 0) > 0.3) {
        const dist = Math.sqrt(
          Math.pow(wrist.x - nose.x, 2) + Math.pow(wrist.y - nose.y, 2)
        );
        if (dist > minDist * 1.15) { // 15% más lejos que el mínimo
          releaseHandHead = frame.tMs;
          break;
        }
      }
    }
  }
  
  // Elegir mejor candidato
  const candidates: Array<{ tMs: number; score: number; method: string }> = [];
  
  if (releaseWrist && maxWristVel > 50) {
    candidates.push({
      tMs: releaseWrist,
      score: maxWristVel,
      method: 'proxy-pico-muñeca'
    });
  }
  
  if (releaseElbowWrist) {
    candidates.push({
      tMs: releaseElbowWrist,
      score: maxElbowVel + maxWristVel,
      method: 'proxy-codo-muñeca'
    });
  }
  
  if (releaseHandHead) {
    candidates.push({
      tMs: releaseHandHead,
      score: 100, // Score fijo para proxy de distancia
      method: 'proxy-distancia-mano-cabeza'
    });
  }
  
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    
    // Calcular confianza
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    const releaseDelay = best.tMs - t0;
    if (releaseDelay >= 500 && releaseDelay <= 700) {
      // Rango óptimo
      if (candidates.length >= 2 && Math.abs(candidates[0].tMs - candidates[1].tMs) < 100) {
        confidence = 'high';
      } else {
        confidence = 'medium';
      }
    } else if (releaseDelay < 400 || releaseDelay > 800) {
      confidence = 'low';
    }
    
    return {
      releaseMs: best.tMs,
      confidence,
      method: best.method
    };
  }
  
  // Fallback: timing estimado basado en t0
  return {
    releaseMs: t0 + 650,
    confidence: 'low',
    method: 'timing-estimado'
  };
}

/**
 * Calcula secuencia de activación completa con reintentos adaptativos
 */
export function calculateActivationSequence(
  velocities: SegmentVel[],
  t0: number,
  debugLog?: (msg: string, data?: any) => void
): BiomechDeterministicOutput['sequence'] {
  const segments: Array<{
    key: 'hipVel' | 'shoulderVel' | 'elbowVel' | 'wristVel';
    name: 'cadera' | 'tronco' | 'brazo' | 'muñeca';
    order: number;
    thresholdPercent: number; // Threshold específico por segmento
  }> = [
    { key: 'hipVel', name: 'cadera', order: 2, thresholdPercent: 20 },
    { key: 'shoulderVel', name: 'tronco', order: 3, thresholdPercent: 20 },
    { key: 'elbowVel', name: 'brazo', order: 4, thresholdPercent: 20 },
    { key: 'wristVel', name: 'muñeca', order: 5, thresholdPercent: 20 },
  ];
  
  const onsets: Array<{
    segment: 'piernas' | 'cadera' | 'tronco' | 'brazo' | 'muñeca' | 'dedos';
    onsetMs: number;
    peakVelMs?: number;
    order: number;
    confidence: 'high' | 'medium' | 'low';
    peakVel: number;
  }> = [
    { segment: 'piernas', onsetMs: t0, order: 1, confidence: 'high', peakVel: 0 }
  ];
  
  // Calcular picos máximos para logging (usar valores absolutos)
  const maxVels: Record<string, number> = {};
  for (const seg of segments) {
    const relevantVels = velocities
      .filter(v => v.tMs >= t0 && v.tMs <= t0 + 1500)
      .map(v => {
        const vel = v[seg.key];
        return vel !== undefined && vel !== null ? Math.abs(vel) : 0;
      })
      .filter(v => v > 0);
    maxVels[seg.key] = relevantVels.length > 0 ? Math.max(...relevantVels) : 0;
  }
  
  if (debugLog) {
    debugLog('Picos máximos de velocidad (absolutos):', maxVels);
    debugLog('Umbrales absolutos aplicados:', {
      hipVel: 20,
      shoulderVel: 20,
      elbowVel: 30,
      wristVel: 30,
    });
  }
  
  // Detectar onsets con threshold normal
  for (const seg of segments) {
    const onset = detectOnset(velocities, t0, seg.key, seg.thresholdPercent, 3);
    if (onset) {
      onsets.push({
        segment: seg.name,
        onsetMs: onset.onsetMs,
        peakVelMs: onset.peakVelMs,
        order: seg.order,
        confidence: onset.confidence,
        peakVel: onset.peakVel,
      });
      
      if (debugLog) {
        debugLog(`Onset detectado: ${seg.name}`, {
          tMs: onset.onsetMs,
          peakVel: onset.peakVel,
          confidence: onset.confidence,
        });
      }
    } else {
      // Reintentar con threshold más bajo (15%)
      const retryOnset = detectOnset(velocities, t0, seg.key, 15, 3);
      if (retryOnset) {
        onsets.push({
          segment: seg.name,
          onsetMs: retryOnset.onsetMs,
          peakVelMs: retryOnset.peakVelMs,
          order: seg.order,
          confidence: 'low', // Confianza baja por threshold reducido
          peakVel: retryOnset.peakVel,
        });
        
        if (debugLog) {
          debugLog(`Onset detectado (reintento): ${seg.name}`, {
            tMs: retryOnset.onsetMs,
            peakVel: retryOnset.peakVel,
            confidence: 'low',
          });
        }
      } else {
        if (debugLog) {
          debugLog(`⚠️ No se detectó onset para ${seg.name}`, {
            maxVel: maxVels[seg.key],
            threshold: (maxVels[seg.key] * 15) / 100,
          });
        }
      }
    }
  }
  
  // Ordenar por onset
  onsets.sort((a, b) => a.onsetMs - b.onsetMs);
  
  // Calcular delays y status
  const detected = onsets.map((onset, idx) => {
    const prevOnset = idx > 0 ? onsets[idx - 1].onsetMs : t0;
    const delay = onset.onsetMs - prevOnset;
    
    // Umbrales para feedback (ajustados: tolerancia de 80ms para orden)
    let status: 'correcto' | 'mejorable' | 'incorrecto' = 'correcto';
    
    if (onset.segment === 'brazo') {
      // Brazos anticipados: brazo más de 80ms antes que cadera o 150ms antes que tronco
      const caderaOnset = onsets.find(o => o.segment === 'cadera')?.onsetMs || Infinity;
      const troncoOnset = onsets.find(o => o.segment === 'tronco')?.onsetMs || Infinity;
      if (onset.onsetMs < caderaOnset - 80 || onset.onsetMs < troncoOnset - 150) {
        status = 'incorrecto';
      } else if (onset.confidence === 'low') {
        status = 'mejorable';
      }
    } else if (onset.segment === 'cadera') {
      // Falta de cadera: delay > 120ms después de piernas
      if (delay > 120) {
        status = 'mejorable';
      }
      if (onset.confidence === 'low') {
        status = 'mejorable';
      }
    } else if (onset.segment === 'tronco') {
      if (onset.confidence === 'low') {
        status = 'mejorable';
      }
    } else if (onset.segment === 'muñeca') {
      if (onset.confidence === 'low') {
        status = 'mejorable';
      }
    }
    
    // Si el orden se rompe por ≤80ms, marcar como "mejorable" en vez de "incorrecto"
    if (onset.order !== idx + 1 && delay <= 80) {
      if (status === 'incorrecto') {
        status = 'mejorable';
      }
    }
    
    return {
      segment: onset.segment,
      onsetMs: onset.onsetMs,
      peakVelMs: onset.peakVelMs,
      order: onset.order,
      status,
      delayMs: delay > 0 ? delay : undefined,
    };
  });
  
  // BACKFILL: Completar segmentos faltantes con "no_detectado"
  const EXPECTED_SEGMENTS = ['piernas', 'cadera', 'tronco', 'brazo', 'muñeca', 'dedos'] as const;
  const EXPECTED_ORDERS: Record<string, number> = {
    'piernas': 1,
    'cadera': 2,
    'tronco': 3,
    'brazo': 4,
    'muñeca': 5,
    'dedos': 6,
  };
  
  const bySegment = Object.fromEntries(detected.map(s => [s.segment, s]));
  
  const completed = EXPECTED_SEGMENTS.map(seg => {
    const existing = bySegment[seg];
    if (existing) {
      return existing;
    }
    
    // Crear entrada para segmento no detectado
    return {
      segment: seg,
      onsetMs: null,
      peakVelMs: undefined,
      order: EXPECTED_ORDERS[seg],
      status: 'no_detectado' as const,
      delayMs: undefined,
    };
  });
  
  if (debugLog) {
    const missing = completed.filter(s => s.status === 'no_detectado');
    if (missing.length > 0) {
      debugLog(`⚠️ Segmentos no detectados (backfill):`, missing.map(s => s.segment));
    }
  }
  
  return completed;
}

/**
 * Calcula fluidez: 1 - (suma de saltos de aceleración normalizados)
 */
export function calculateFluidity(velocities: SegmentVel[]): number {
  if (velocities.length < 3) return 0;
  
  let totalJumps = 0;
  let maxJump = 0;
  
  for (let i = 1; i < velocities.length - 1; i++) {
    const prev = velocities[i - 1];
    const curr = velocities[i];
    const next = velocities[i + 1];
    
    // Aceleración aproximada (segunda derivada)
    const accel = Math.abs(
      (next.kneeVel || 0) - 2 * (curr.kneeVel || 0) + (prev.kneeVel || 0)
    );
    
    totalJumps += accel;
    maxJump = Math.max(maxJump, accel);
  }
  
  // Normalizar
  const normalized = maxJump > 0 ? totalJumps / (maxJump * velocities.length) : 0;
  return Math.max(0, Math.min(100, (1 - normalized) * 100));
}

/**
 * Detecta pérdidas de energía: caídas de velocidad antes del siguiente onset
 */
export function calculateEnergyLeak(
  velocities: SegmentVel[],
  sequence: BiomechDeterministicOutput['sequence']
): number {
  let totalLeak = 0;
  let leakCount = 0;
  
  for (let i = 0; i < sequence.length - 1; i++) {
    const current = sequence[i];
    const next = sequence[i + 1];
    if (current.onsetMs == null || next.onsetMs == null) {
      continue;
    }

    const currentOnsetMs = current.onsetMs;
    const nextOnsetMs = next.onsetMs;
    
    // Buscar velocidad máxima del segmento actual
    const segmentVels = velocities
      .filter(v => v.tMs >= currentOnsetMs && v.tMs < nextOnsetMs)
      .map(v => {
        if (current.segment === 'piernas') return v.kneeVel || 0;
        if (current.segment === 'cadera') return v.hipVel || 0;
        if (current.segment === 'tronco') return v.shoulderVel || 0;
        if (current.segment === 'brazo') return v.elbowVel || 0;
        if (current.segment === 'muñeca') return v.wristVel || 0;
        return 0;
      });
    
    if (segmentVels.length > 0) {
      const maxVel = Math.max(...segmentVels);
      const minVel = Math.min(...segmentVels);
      const drop = maxVel > 0 ? ((maxVel - minVel) / maxVel) * 100 : 0;
      
      if (drop > 35) { // Umbral de fuga
        totalLeak += drop;
        leakCount++;
      }
    }
  }
  
  return leakCount > 0 ? totalLeak / leakCount : 0;
}

/**
 * Calcula distancia hombro-cadera para normalización
 */
export function calculateShoulderHipDistance(frames: FramePose[]): number {
  let totalDist = 0;
  let count = 0;
  
  for (const frame of frames) {
    const shoulder = frame.keypoints.find(kp => kp.name === 'right_shoulder');
    const hip = frame.keypoints.find(kp => kp.name === 'right_hip');
    
    if (shoulder && hip && (shoulder.score ?? 0) > 0.3 && (hip.score ?? 0) > 0.3) {
      const dx = shoulder.x - hip.x;
      const dy = shoulder.y - hip.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      totalDist += dist;
      count++;
    }
  }
  
  return count > 0 ? totalDist / count : 1.0; // Fallback a 1.0 si no hay datos
}

/**
 * Función principal: calcula análisis biomecánico determinista completo
 * Ahora siempre retorna estimaciones (nunca null/undefined para set-point y release)
 */
export function calculateDeterministicBiomech(
  angles: Array<{tMs: number, elbowR?: number, kneeR?: number, hip?: number, wrist?: number}>,
  frames: FramePose[],
  fps: number = 8,
  debugLog?: (msg: string, data?: any) => void
): BiomechDeterministicOutput {
  // Normalizar ángulos
  const normalizedAngles = normalizeAngles(angles);
  
  // Calcular velocidades
  const velocities = calculateSegmentVelocities(normalizedAngles, fps);

  if (debugLog) {
    const collect = (series: Array<{ [key: string]: number | undefined }>, key: string) =>
      series
        .map(item => item[key])
        .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

    const summarize = (values: number[]) => values.length === 0 ? null : {
      min: Math.min(...values),
      max: Math.max(...values),
      span: Math.max(...values) - Math.min(...values),
    };

    const summarizeAbs = (values: number[]) => values.length === 0 ? null : {
      maxAbs: Math.max(...values.map(v => Math.abs(v))),
      signedMax: Math.max(...values),
      signedMin: Math.min(...values),
    };

    debugLog('Rangos de ángulos por segmento (deg)', {
      hip: summarize(collect(normalizedAngles, 'hipDeg')),
      knee: summarize(collect(normalizedAngles, 'kneeDeg')),
      shoulder: summarize(collect(normalizedAngles, 'shoulderDeg')),
      elbow: summarize(collect(normalizedAngles, 'elbowDeg')),
      wrist: summarize(collect(normalizedAngles, 'wristDeg')),
    });

    debugLog('Picos de velocidad por segmento (°/s)', {
      hipVel: summarizeAbs(collect(velocities, 'hipVel')),
      kneeVel: summarizeAbs(collect(velocities, 'kneeVel')),
      shoulderVel: summarizeAbs(collect(velocities, 'shoulderVel')),
      elbowVel: summarizeAbs(collect(velocities, 'elbowVel')),
      wristVel: summarizeAbs(collect(velocities, 'wristVel')),
    });
  }
  
  // Detectar t0
  const t0 = detectT0(velocities);
  
  if (debugLog) {
    debugLog('t0 detectado', { t0 });
  }
  
  // Detectar set-point y release (ahora siempre retornan estimaciones)
  const setPointResult = detectSetPoint(normalizedAngles, velocities, t0, frames);
  const releaseResult = detectRelease(velocities, setPointResult.setPointMs, t0, frames);
  
  if (debugLog) {
    debugLog('Set-point detectado', {
      tMs: setPointResult.setPointMs,
      confidence: setPointResult.confidence,
      method: setPointResult.method,
    });
    debugLog('Release detectado', {
      tMs: releaseResult.releaseMs,
      confidence: releaseResult.confidence,
      method: releaseResult.method,
    });
  }
  
  // Calcular secuencia de activación con logging
  const sequence = calculateActivationSequence(velocities, t0, debugLog);
  
  // Calcular métricas
  const fluidityScore = calculateFluidity(velocities);
  const energyLeakPct = calculateEnergyLeak(velocities, sequence);
  
  // Calcular retraso en secuencia
  const sequenceDelayMs = sequence
    .filter(s => s.delayMs !== undefined && s.delayMs > 0)
    .reduce((sum, s) => sum + (s.delayMs || 0), 0);
  
  // Set-point score (ajustado por confianza)
  let setPointScore = Math.max(0, Math.min(100, 100 - Math.abs(setPointResult.setPointMs - t0 - 400) / 10));
  if (setPointResult.confidence === 'low') {
    setPointScore = Math.max(50, setPointScore - 20); // Penalizar confianza baja
  } else if (setPointResult.confidence === 'high') {
    setPointScore = Math.min(100, setPointScore + 10); // Bonificar confianza alta
  }
  
  // Eficiencia general (promedio ponderado)
  const efficiencyIndex = Math.round(
    (fluidityScore * 0.4) + 
    ((100 - energyLeakPct) * 0.3) + 
    (setPointScore * 0.2) + 
    ((100 - Math.min(sequenceDelayMs / 10, 100)) * 0.1)
  );
  
  return {
    efficiencyIndex: Math.max(0, Math.min(100, efficiencyIndex)),
    sequence,
    timing: {
      setPointMs: setPointResult.setPointMs, // Siempre tiene valor
      releaseMs: releaseResult.releaseMs, // Siempre tiene valor
      releaseVsLegsMs: releaseResult.releaseMs - t0, // Siempre calculable
    },
    metrics: {
      fluidityScore: Math.round(fluidityScore),
      energyLeakPct: Math.round(energyLeakPct),
      setPointScore: Math.round(setPointScore),
      sequenceDelayMs,
    },
  };
}

