// Utilidades para cálculos de medición biomecánica

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

/**
 * Calcula la distancia entre dos puntos
 */
export function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calcula el ángulo entre tres puntos (B es el vértice)
 * Retorna el ángulo en grados
 */
export function calculateAngle(A: Point, B: Point, C: Point): number {
  const v1: Vector = { x: A.x - B.x, y: A.y - B.y };
  const v2: Vector = { x: C.x - B.x, y: C.y - B.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const m2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  const cos = Math.min(1, Math.max(-1, dot / (m1 * m2 || 1)));
  return Math.acos(cos) * 180 / Math.PI;
}

/**
 * Calcula el ángulo de inclinación de una línea
 * Retorna el ángulo en grados (-180 a 180)
 */
export function calculateLineAngle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
}

/**
 * Calcula el punto medio entre dos puntos
 */
export function calculateMidpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

/**
 * Calcula el área de un triángulo formado por tres puntos
 */
export function calculateTriangleArea(A: Point, B: Point, C: Point): number {
  return Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2;
}

/**
 * Calcula el perímetro de un polígono
 */
export function calculatePolygonPerimeter(points: Point[]): number {
  if (points.length < 3) return 0;
  
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    perimeter += calculateDistance(current, next);
  }
  
  return perimeter;
}

/**
 * Calcula el área de un polígono usando la fórmula del área de Gauss
 */
export function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += (current.x * next.y - next.x * current.y);
  }
  
  return Math.abs(area) / 2;
}

/**
 * Calcula la velocidad entre dos puntos en el tiempo
 * Retorna la velocidad en píxeles por segundo
 */
export function calculateVelocity(p1: Point, p2: Point, time1: number, time2: number): number {
  const distance = calculateDistance(p1, p2);
  const timeDiff = time2 - time1;
  
  if (timeDiff === 0) return 0;
  return distance / timeDiff;
}

/**
 * Calcula la aceleración entre tres puntos en el tiempo
 * Retorna la aceleración en píxeles por segundo cuadrado
 */
export function calculateAcceleration(
  p1: Point, 
  p2: Point, 
  p3: Point, 
  time1: number, 
  time2: number, 
  time3: number
): number {
  const v1 = calculateVelocity(p1, p2, time1, time2);
  const v2 = calculateVelocity(p2, p3, time2, time3);
  const timeDiff = time3 - time1;
  
  if (timeDiff === 0) return 0;
  return (v2 - v1) / timeDiff;
}

/**
 * Calcula el centro de masa de un conjunto de puntos
 */
export function calculateCenterOfMass(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  
  return {
    x: sumX / points.length,
    y: sumY / points.length
  };
}

/**
 * Calcula la desviación estándar de las distancias desde el centro de masa
 */
export function calculateStandardDeviation(points: Point[]): number {
  if (points.length < 2) return 0;
  
  const center = calculateCenterOfMass(points);
  const distances = points.map(p => calculateDistance(p, center));
  
  const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const squaredDiffs = distances.map(d => Math.pow(d - mean, 2));
  const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / distances.length;
  
  return Math.sqrt(variance);
}

/**
 * Calcula el factor de escala para convertir píxeles a unidades reales
 * @param pixelDistance Distancia en píxeles
 * @param realDistance Distancia real conocida
 * @param realUnit Unidad real (ej: 'cm', 'm', 'inch')
 */
export function calculateScaleFactor(
  pixelDistance: number, 
  realDistance: number, 
  realUnit: string = 'cm'
): number {
  if (realDistance === 0) return 0;
  return pixelDistance / realDistance;
}

/**
 * Convierte una distancia de píxeles a unidades reales
 */
export function convertPixelsToReal(
  pixelDistance: number, 
  scaleFactor: number, 
  unit: string = 'cm'
): number {
  return pixelDistance / scaleFactor;
}

/**
 * Convierte una distancia real a píxeles
 */
export function convertRealToPixels(
  realDistance: number, 
  scaleFactor: number
): number {
  return realDistance * scaleFactor;
}

/**
 * Calcula métricas biomecánicas básicas
 */
export interface BiomechanicalMetrics {
  shoulderElbowWristAngle: number;
  hipKneeAnkleAngle: number;
  shoulderHipAlignment: number;
  elbowKneeAlignment: number;
  overallPosture: 'good' | 'fair' | 'poor';
  score: number;
}

export function calculateBiomechanicalMetrics(keypoints: { [key: string]: Point }): BiomechanicalMetrics {
  const metrics: BiomechanicalMetrics = {
    shoulderElbowWristAngle: 0,
    hipKneeAnkleAngle: 0,
    shoulderHipAlignment: 0,
    elbowKneeAlignment: 0,
    overallPosture: 'fair',
    score: 0
  };

  try {
    // Ángulo hombro-codo-muñeca (brazo derecho)
    if (keypoints.right_shoulder && keypoints.right_elbow && keypoints.right_wrist) {
      metrics.shoulderElbowWristAngle = calculateAngle(
        keypoints.right_shoulder,
        keypoints.right_elbow,
        keypoints.right_wrist
      );
    }

    // Ángulo cadera-rodilla-tobillo (pierna derecha)
    if (keypoints.right_hip && keypoints.right_knee && keypoints.right_ankle) {
      metrics.hipKneeAnkleAngle = calculateAngle(
        keypoints.right_hip,
        keypoints.right_knee,
        keypoints.right_ankle
      );
    }

    // Alineación hombro-cadera
    if (keypoints.left_shoulder && keypoints.right_shoulder && keypoints.left_hip && keypoints.right_hip) {
      const shoulderSlope = calculateLineAngle(keypoints.left_shoulder, keypoints.right_shoulder);
      const hipSlope = calculateLineAngle(keypoints.left_hip, keypoints.right_hip);
      metrics.shoulderHipAlignment = Math.abs(shoulderSlope - hipSlope);
    }

    // Alineación codo-rodilla
    if (keypoints.right_elbow && keypoints.right_knee) {
      metrics.elbowKneeAlignment = Math.abs(keypoints.right_elbow.x - keypoints.right_knee.x);
    }

    // Evaluar postura general
    let score = 0;
    
    // Ángulo hombro-codo-muñeca ideal: 80-120°
    if (metrics.shoulderElbowWristAngle > 80 && metrics.shoulderElbowWristAngle < 120) score++;
    
    // Ángulo cadera-rodilla-tobillo ideal: 160-180°
    if (metrics.hipKneeAnkleAngle > 160 && metrics.hipKneeAnkleAngle < 180) score++;
    
    // Alineación hombro-cadera ideal: < 10°
    if (metrics.shoulderHipAlignment < 10) score++;
    
    // Alineación codo-rodilla ideal: < 20px
    if (metrics.elbowKneeAlignment < 20) score++;

    metrics.score = score;
    
    if (score >= 3) metrics.overallPosture = 'good';
    else if (score >= 1) metrics.overallPosture = 'fair';
    else metrics.overallPosture = 'poor';

  } catch (err) {
    console.error('Error calculating biomechanical metrics:', err);
  }

  return metrics;
}

/**
 * Calcula la suavidad del movimiento entre puntos consecutivos
 * Retorna un valor entre 0 (muy suave) y 1 (muy brusco)
 */
export function calculateMovementSmoothness(points: Point[], times: number[]): number {
  if (points.length < 3 || times.length < 3) return 0;
  
  let totalAcceleration = 0;
  let count = 0;
  
  for (let i = 1; i < points.length - 1; i++) {
    const acc = calculateAcceleration(
      points[i - 1], points[i], points[i + 1],
      times[i - 1], times[i], times[i + 1]
    );
    totalAcceleration += Math.abs(acc);
    count++;
  }
  
  if (count === 0) return 0;
  
  // Normalizar entre 0 y 1
  const avgAcceleration = totalAcceleration / count;
  return Math.min(avgAcceleration / 1000, 1); // Ajustar factor según necesidad
}

/**
 * Calcula la eficiencia del movimiento (distancia directa vs distancia real)
 * Retorna un valor entre 0 (muy ineficiente) y 1 (muy eficiente)
 */
export function calculateMovementEfficiency(points: Point[]): number {
  if (points.length < 2) return 1;
  
  const directDistance = calculateDistance(points[0], points[points.length - 1]);
  const totalDistance = calculatePolygonPerimeter(points);
  
  if (totalDistance === 0) return 1;
  
  return directDistance / totalDistance;
}

/**
 * Formatea un valor numérico con unidades
 */
export function formatMeasurement(value: number, unit: string, decimals: number = 1): string {
  return `${value.toFixed(decimals)}${unit}`;
}

/**
 * Formatea un ángulo en grados
 */
export function formatAngle(angle: number, decimals: number = 1): string {
  return `${angle.toFixed(decimals)}°`;
}

/**
 * Formatea una distancia con unidades de calibración
 */
export function formatDistance(
  pixelDistance: number, 
  scaleFactor: number, 
  pixelUnit: string = 'px',
  realUnit: string = 'cm',
  decimals: number = 1
): string {
  if (scaleFactor > 0) {
    const realDistance = convertPixelsToReal(pixelDistance, scaleFactor, realUnit);
    return `${pixelDistance.toFixed(decimals)}${pixelUnit} (${realDistance.toFixed(decimals)}${realUnit})`;
  }
  return `${pixelDistance.toFixed(decimals)}${pixelUnit}`;
}
