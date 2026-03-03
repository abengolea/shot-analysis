export type PoseKeypoint = {
  name: string;
  x: number;
  y: number;
  score?: number;
};

export type PoseFrame = {
  tMs: number;
  keypoints: PoseKeypoint[];
};

export type EnergyTransferSegment = "piernas" | "cadera" | "tronco" | "brazo" | "muneca";

export type EnergyTransferStatus = "correcto" | "mejorable" | "incorrecto" | "no_detectado";

export type EnergyTransferAnalysis = {
  efficiencyIndex: number;
  fluidityScore: number;
  energyLeakPct: number;
  t0Ms?: number;
  setPointMs?: number;
  releaseMs?: number;
  releaseVsLegsMs?: number;
  sequence: Array<{
    segment: EnergyTransferSegment;
    onsetMs?: number;
    status: EnergyTransferStatus;
    delayMs?: number;
  }>;
  dominantSide: "left" | "right";
  coveragePct: number;
  insights: {
    strengths: string[];
    improvements: string[];
    ideal: string[];
  };
  warnings: string[];
};

const MIN_SCORE = 0.3;
const MIN_ABS_VEL = 0.15;
const ONSET_CONSECUTIVE = 2;
const IDEAL_MAX_DELAY_MS = 200;
const WARN_DELAY_MS = 250;

const SEGMENT_LABELS: Record<EnergyTransferSegment, string> = {
  piernas: "Piernas",
  cadera: "Cadera",
  tronco: "Tronco",
  brazo: "Brazo",
  muneca: "Muñeca",
};

const SEGMENT_ORDER: EnergyTransferSegment[] = [
  "piernas",
  "cadera",
  "tronco",
  "brazo",
  "muneca",
];

type Point = { tMs: number; x: number; y: number } | null;

function pickSide(frames: PoseFrame[]): "left" | "right" {
  let leftScore = 0;
  let rightScore = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (const frame of frames) {
    const left = frame.keypoints.find((kp) => kp.name === "left_wrist");
    const right = frame.keypoints.find((kp) => kp.name === "right_wrist");
    if (left && (left.score ?? 0) >= MIN_SCORE) {
      leftScore += left.score ?? 1;
      leftCount += 1;
    }
    if (right && (right.score ?? 0) >= MIN_SCORE) {
      rightScore += right.score ?? 1;
      rightCount += 1;
    }
  }

  const leftAvg = leftCount > 0 ? leftScore / leftCount : 0;
  const rightAvg = rightCount > 0 ? rightScore / rightCount : 0;
  return rightAvg >= leftAvg ? "right" : "left";
}

function extractPoint(frame: PoseFrame, name: string): Point {
  const kp = frame.keypoints.find((item) => item.name === name);
  if (!kp || (kp.score ?? 0) < MIN_SCORE) return null;
  return { tMs: frame.tMs, x: kp.x, y: kp.y };
}

function buildSeries(frames: PoseFrame[], name: string): Point[] {
  return frames.map((frame) => extractPoint(frame, name));
}

function computeVelocities(series: Point[]): Array<number | null> {
  const velocities: Array<number | null> = [];
  let lastPoint: Point = null;

  for (const point of series) {
    if (!point || !lastPoint) {
      velocities.push(null);
      if (point) lastPoint = point;
      continue;
    }
    const dt = (point.tMs - lastPoint.tMs) / 1000;
    if (dt <= 0) {
      velocities.push(null);
      lastPoint = point;
      continue;
    }
    const dx = point.x - lastPoint.x;
    const dy = point.y - lastPoint.y;
    velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
    lastPoint = point;
  }

  return velocities;
}

function detectOnset(frames: PoseFrame[], velocities: Array<number | null>): number | undefined {
  const validVels = velocities.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (validVels.length === 0) return undefined;
  const maxVel = Math.max(...validVels);
  const threshold = Math.max(MIN_ABS_VEL, maxVel * 0.35);
  if (maxVel < MIN_ABS_VEL) return undefined;

  let consecutive = 0;
  for (let i = 0; i < velocities.length; i += 1) {
    const vel = velocities[i];
    if (typeof vel === "number" && vel >= threshold) {
      consecutive += 1;
      if (consecutive >= ONSET_CONSECUTIVE) {
        const frame = frames[i];
        return frame?.tMs;
      }
    } else {
      consecutive = 0;
    }
  }
  return undefined;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeFluidity(velocities: Array<number | null>): number {
  const values = velocities.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length < 3) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean < 0.05) return 0;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  const cv = std / mean;
  return clampScore(100 - cv * 40);
}

function computeCoverage(frames: PoseFrame[], pointNames: string[]): number {
  if (frames.length === 0) return 0;
  let covered = 0;
  for (const frame of frames) {
    const count = pointNames.reduce((acc, name) => {
      const kp = frame.keypoints.find((item) => item.name === name);
      return acc + (kp && (kp.score ?? 0) >= MIN_SCORE ? 1 : 0);
    }, 0);
    if (count >= Math.min(4, pointNames.length)) covered += 1;
  }
  return Math.round((covered / frames.length) * 100);
}

export function analyzeEnergyTransfer(frames: PoseFrame[]): EnergyTransferAnalysis | null {
  if (!frames || frames.length < 4) return null;

  const dominantSide = pickSide(frames);
  const sidePrefix = dominantSide === "right" ? "right" : "left";
  const pointNames = [
    `${sidePrefix}_knee`,
    `${sidePrefix}_hip`,
    `${sidePrefix}_shoulder`,
    `${sidePrefix}_elbow`,
    `${sidePrefix}_wrist`,
  ];

  const series = {
    piernas: buildSeries(frames, `${sidePrefix}_knee`),
    cadera: buildSeries(frames, `${sidePrefix}_hip`),
    tronco: buildSeries(frames, `${sidePrefix}_shoulder`),
    brazo: buildSeries(frames, `${sidePrefix}_elbow`),
    muneca: buildSeries(frames, `${sidePrefix}_wrist`),
  } as const;

  const velocities = {
    piernas: computeVelocities(series.piernas),
    cadera: computeVelocities(series.cadera),
    tronco: computeVelocities(series.tronco),
    brazo: computeVelocities(series.brazo),
    muneca: computeVelocities(series.muneca),
  } as const;

  const onsets: Record<EnergyTransferSegment, number | undefined> = {
    piernas: detectOnset(frames, velocities.piernas),
    cadera: detectOnset(frames, velocities.cadera),
    tronco: detectOnset(frames, velocities.tronco),
    brazo: detectOnset(frames, velocities.brazo),
    muneca: detectOnset(frames, velocities.muneca),
  };

  const t0 = onsets.piernas ?? frames[0]?.tMs ?? 0;
  const sequence = SEGMENT_ORDER.map((segment) => {
    const onsetMs = onsets[segment];
    return {
      segment,
      onsetMs,
      status: onsetMs ? ("correcto" as EnergyTransferStatus) : "no_detectado",
      delayMs: undefined as number | undefined,
    };
  });

  let previousOnset: number | undefined = onsets.piernas ?? undefined;
  for (const item of sequence) {
    if (!item.onsetMs) {
      item.status = "no_detectado";
      continue;
    }
    if (previousOnset !== undefined) {
      const delay = item.onsetMs - previousOnset;
      item.delayMs = delay > 0 ? Math.round(delay) : undefined;
      if (item.onsetMs < previousOnset - 40) {
        item.status = "incorrecto";
      } else if (delay > WARN_DELAY_MS) {
        item.status = "mejorable";
      } else {
        item.status = "correcto";
      }
      previousOnset = item.onsetMs;
    } else {
      item.status = "mejorable";
      previousOnset = item.onsetMs;
    }
  }

  const kneeFluidity = computeFluidity(velocities.piernas);
  const shoulderFluidity = computeFluidity(velocities.tronco);
  const fluidityScore = clampScore((kneeFluidity * 0.6 + shoulderFluidity * 0.4));

  const transitionDelays = sequence
    .map((seg) => seg.delayMs)
    .filter((delay): delay is number => typeof delay === "number" && delay > 0);
  const leaks = transitionDelays.filter((delay) => delay > WARN_DELAY_MS).length;
  const energyLeakPct = transitionDelays.length > 0
    ? Math.round((leaks / transitionDelays.length) * 100)
    : 100;

  const wristSeries = series.muneca;
  let setPointMs: number | undefined;
  let releaseMs: number | undefined;

  if (wristSeries.length > 0) {
    const candidates = wristSeries
      .map((point) => (point && point.tMs >= t0 && point.tMs <= t0 + 1200 ? point : null))
      .filter((point): point is NonNullable<Point> => Boolean(point));
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.y - b.y);
      setPointMs = candidates[0]?.tMs;
    }
    const startMs = setPointMs ?? t0;
    let bestVel = -Infinity;
    let bestMs: number | undefined;
    velocities.muneca.forEach((vel, idx) => {
      if (typeof vel !== "number") return;
      const frame = frames[idx];
      if (!frame || frame.tMs < startMs) return;
      if (vel > bestVel) {
        bestVel = vel;
        bestMs = frame.tMs;
      }
    });
    releaseMs = bestMs;
  }

  const releaseVsLegsMs =
    typeof releaseMs === "number" && Number.isFinite(releaseMs)
      ? Math.round(releaseMs - t0)
      : undefined;

  let efficiencyIndex = 100;
  sequence.forEach((seg) => {
    if (seg.status === "incorrecto") efficiencyIndex -= 12;
    if (seg.status === "mejorable") efficiencyIndex -= 6;
    if (seg.status === "no_detectado") efficiencyIndex -= 10;
  });
  if (fluidityScore < 60) efficiencyIndex -= 8;
  if (energyLeakPct > 35) efficiencyIndex -= 8;
  if (releaseVsLegsMs && releaseVsLegsMs >= 500 && releaseVsLegsMs <= 700) efficiencyIndex += 4;
  if (releaseVsLegsMs && releaseVsLegsMs > 800) efficiencyIndex -= 6;
  efficiencyIndex = clampScore(efficiencyIndex);

  const strengths: string[] = [];
  const improvements: string[] = [];

  const hipOnset = onsets.cadera;
  const trunkOnset = onsets.tronco;
  const elbowOnset = onsets.brazo;
  const wristOnset = onsets.muneca;

  if (
    onsets.piernas &&
    hipOnset &&
    trunkOnset &&
    hipOnset > onsets.piernas &&
    trunkOnset > hipOnset &&
    (sequence.find((s) => s.segment === "cadera")?.delayMs ?? 0) <= IDEAL_MAX_DELAY_MS
  ) {
    strengths.push("Buena secuencia piernas → cadera → tronco sin saltos grandes.");
  }
  if (releaseVsLegsMs && releaseVsLegsMs >= 500 && releaseVsLegsMs <= 700) {
    strengths.push("Timing de liberación cercano al rango ideal (0.5–0.7s).");
  }
  if (fluidityScore >= 70) {
    strengths.push("Movimiento continuo sin pausas marcadas.");
  }

  if (elbowOnset && hipOnset && elbowOnset < hipOnset - 40) {
    improvements.push("Los brazos se adelantan: buscá activar cadera antes del brazo.");
  }
  if (trunkOnset && hipOnset && trunkOnset - hipOnset > WARN_DELAY_MS) {
    improvements.push("Hay una pausa entre cadera y tronco; intenta una transición más continua.");
  }
  if (energyLeakPct > 35) {
    improvements.push("Se detectan pérdidas de energía entre segmentos.");
  }
  if (releaseVsLegsMs && releaseVsLegsMs > 700) {
    improvements.push("Liberación tardía: soltá el balón un poco antes.");
  }
  if (releaseVsLegsMs && releaseVsLegsMs < 450) {
    improvements.push("Liberación temprana: espera a completar la extensión.");
  }

  if (strengths.length === 0) strengths.push("Se observa intención de secuencia proximal-distal.");
  if (improvements.length === 0) improvements.push("Mantener la continuidad entre piernas y brazos.");

  const ideal = [
    "Impulso desde piernas y cadera antes de elevar brazos.",
    "Set point cerca de 0.4s y liberación cerca de 0.6s desde el inicio.",
    "Cadena continua piernas → cadera → tronco → codo → muñeca, sin pausas visibles.",
  ];

  const coveragePct = computeCoverage(frames, pointNames);
  const warnings: string[] = [];
  if (coveragePct < 45) {
    warnings.push("Datos de pose incompletos; análisis aproximado.");
  }
  if (!wristOnset) {
    warnings.push("Muñeca no detectada con suficiente claridad para timing de liberación.");
  }

  return {
    efficiencyIndex,
    fluidityScore,
    energyLeakPct,
    t0Ms: t0,
    setPointMs,
    releaseMs,
    releaseVsLegsMs,
    sequence,
    dominantSide,
    coveragePct,
    insights: { strengths, improvements, ideal },
    warnings,
  };
}

export function formatMs(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `${(value / 1000).toFixed(2)}s`;
}

export function getSegmentLabel(segment: EnergyTransferSegment): string {
  return SEGMENT_LABELS[segment];
}
