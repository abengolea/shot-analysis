/**
 * Generador de feedback rule-based (100% determinista)
 * Fallback cuando el LLM falla o devuelve datos vacíos
 */

import { BiomechDeterministicOutput } from './biomechanical-analysis';

export interface RuleBasedFeedback {
  feedback: {
    errors: string[];
    recommendations: string[];
    strengths: string[];
    coachMessages: string[];
  };
  labels: string[];
}

/**
 * Genera feedback determinista basado en reglas basadas en los datos biomecánicos
 * Asegura que siempre haya al menos una recomendación por segmento no detectado
 */
export function generateRuleBasedFeedback(
  biomech: BiomechDeterministicOutput
): RuleBasedFeedback {
  const errors: string[] = [];
  const recommendations: string[] = [];
  const strengths: string[] = [];
  const coachMessages: string[] = [];
  const labels: string[] = [];

  // 1. ANÁLISIS DE SECUENCIA
  const sequence = biomech.sequence;
  const t0Ms = sequence.find(s => s.segment === 'piernas')?.onsetMs || 0;
  
  // Contar segmentos detectados vs no detectados
  const detectedSegments = sequence.filter(s => s.status !== 'no_detectado' && s.onsetMs !== null && s.onsetMs !== undefined);
  const noDetectedSegments = sequence.filter(s => s.status === 'no_detectado' || s.onsetMs === null || s.onsetMs === undefined);
  const noDetectedCount = noDetectedSegments.length;
  const detectedCount = detectedSegments.length;
  
  // Si hay 3 o más segmentos no detectados, el análisis es PARCIAL
  const isPartialAnalysis = noDetectedCount >= 3;
  
  if (isPartialAnalysis) {
    recommendations.push(`Análisis limitado: Solo se detectaron ${detectedCount} de ${sequence.length} segmentos. El análisis es parcial y puede no reflejar la transferencia completa.`);
    coachMessages.push(`Análisis parcial: No se detectaron suficientes segmentos para evaluar la cadena cinética completa.`);
    labels.push('analisis_parcial');
  }
  
  // Verificar orden de activación (solo de segmentos detectados)
  const segmentOrder = ['piernas', 'cadera', 'tronco', 'brazo', 'muñeca'];
  const detectedOrder = detectedSegments
    .filter(s => segmentOrder.includes(s.segment))
    .sort((a, b) => (a.onsetMs || 0) - (b.onsetMs || 0))
    .map(s => s.segment);

  // Verificar si brazos se anticipan (solo si están detectados)
  const brazoSegment = detectedSegments.find(s => s.segment === 'brazo');
  const caderaSegment = detectedSegments.find(s => s.segment === 'cadera');
  const troncoSegment = detectedSegments.find(s => s.segment === 'tronco');

  if (brazoSegment && caderaSegment && brazoSegment.onsetMs && caderaSegment.onsetMs && brazoSegment.onsetMs < caderaSegment.onsetMs) {
    errors.push('Tus brazos se adelantan antes de que se active la cadera. Primero genera impulso desde las piernas y cadera.');
    coachMessages.push('Inicia el movimiento desde las piernas antes de elevar los brazos. La potencia debe venir desde abajo.');
    labels.push('brazos_anticipados');
  }

  if (brazoSegment && troncoSegment && brazoSegment.onsetMs && troncoSegment.onsetMs && brazoSegment.onsetMs < troncoSegment.onsetMs) {
    if (!labels.includes('brazos_anticipados')) {
      errors.push('Los brazos se activan antes del tronco. Debes transferir energía desde el centro del cuerpo primero.');
      labels.push('brazos_anticipados');
    }
  }

  // Verificar segmentos no detectados y agregar recomendaciones específicas
  const caderaNoDetected = sequence.find(s => s.segment === 'cadera' && (s.status === 'no_detectado' || s.onsetMs === null || s.onsetMs === undefined));
  const troncoNoDetected = sequence.find(s => s.segment === 'tronco' && (s.status === 'no_detectado' || s.onsetMs === null || s.onsetMs === undefined));
  const brazoNoDetected = sequence.find(s => s.segment === 'brazo' && (s.status === 'no_detectado' || s.onsetMs === null || s.onsetMs === undefined));
  const munecaNoDetected = sequence.find(s => s.segment === 'muñeca' && (s.status === 'no_detectado' || s.onsetMs === null || s.onsetMs === undefined));

  if (caderaNoDetected) {
    errors.push('No se detectó activación clara de cadera. El análisis es limitado para este segmento.');
    recommendations.push('No se detectó activación clara de cadera. Enfatizá la transferencia desde la cadera inmediatamente después de las piernas para generar más potencia.');
  }

  if (troncoNoDetected) {
    recommendations.push('No se detectó activación clara del tronco. El tronco debe activarse después de la cadera para transferir energía al brazo.');
  }

  if (brazoNoDetected) {
    recommendations.push('No se detectó activación clara del brazo. El brazo debe activarse después del tronco, no antes de la cadera.');
  }

  if (munecaNoDetected) {
    recommendations.push('No se detectó activación clara de muñeca. La muñeca debe activarse al final de la secuencia para impartir velocidad final al balón.');
  }

  // Verificar orden correcto (solo si hay suficientes segmentos detectados)
  const isCorrectOrder = detectedOrder.join(',') === segmentOrder.slice(0, detectedOrder.length).join(',');
  if (isCorrectOrder && detectedOrder.length >= 3 && !isPartialAnalysis) {
    strengths.push('Secuencia de activación proximal → distal correcta. La transferencia energética sigue el patrón biomecánicamente óptimo.');
  } else if (isCorrectOrder && detectedOrder.length >= 3 && isPartialAnalysis) {
    // Si hay orden correcto pero análisis parcial, mencionar que es correcto en lo detectado
    strengths.push(`Secuencia correcta en los ${detectedOrder.length} segmentos detectados.`);
  }

  // 2. ANÁLISIS DE TIMING
  const releaseDelay = biomech.timing.releaseVsLegsMs || 0;
  
  if (releaseDelay > 700) {
    errors.push('Liberación tardía. Soltaste el balón después de completar la extensión, perdiendo potencia y fluidez.');
    recommendations.push('Soltá el balón antes, acompañando la extensión final. El release debe ocurrir entre 500-700ms después del inicio de extensión de piernas.');
    coachMessages.push('Soltá el balón antes, acompañando la extensión final, no después de completarla.');
    labels.push('liberacion_tardia');
  } else if (releaseDelay >= 500 && releaseDelay <= 700) {
    strengths.push('Timing de liberación óptimo. El release ocurre en el momento biomecánicamente ideal.');
  } else if (releaseDelay < 400) {
    errors.push('Liberación demasiado anticipada. El balón se suelta antes de que se complete la transferencia de energía.');
    recommendations.push('Espera un poco más antes de soltar el balón para maximizar la transferencia de energía desde las piernas.');
    labels.push('liberacion_anticipada');
  }

  // 3. ANÁLISIS DE SET-POINT
  const setPointScore = biomech.metrics.setPointScore;
  if (setPointScore < 60) {
    errors.push(`Set-point incorrecto (score: ${setPointScore}/100). La posición de carga no es óptima para la transferencia energética.`);
    recommendations.push('Elevá el punto de carga (set-point) para optimizar la trayectoria y la transferencia de energía.');
    coachMessages.push('Elevá el punto de carga para optimizar la trayectoria y la transferencia.');
    labels.push('set_point_incorrecto');
  } else if (setPointScore >= 80) {
    strengths.push('Set-point óptimo. La posición de carga permite una transferencia eficiente de energía.');
  }

  // 4. ANÁLISIS DE FLUIDEZ (solo si hay suficientes datos)
  const fluidityScore = biomech.metrics.fluidityScore;
  
  // Si hay análisis parcial, las métricas pueden ser poco confiables
  if (isPartialAnalysis && detectedCount <= 2) {
    recommendations.push('Las métricas de fluidez pueden ser poco confiables debido a la detección limitada de segmentos.');
  }

  if (fluidityScore < 60 && !isPartialAnalysis) {
    errors.push(`Movimiento brusco detectado (fluidez: ${fluidityScore}/100). Hay quiebres en la cadena cinética que reducen la eficiencia.`);
    recommendations.push('Trabaja en la suavidad del movimiento. El tiro debe ser un gesto continuo sin pausas ni quiebres.');
    coachMessages.push('El movimiento debe ser más fluido. Evita pausas en el set-point y mantén la continuidad del gesto.');
    labels.push('movimiento_brusco');
  } else if (fluidityScore >= 80 && !isPartialAnalysis) {
    strengths.push('Movimiento fluido y continuo. La cadena cinética funciona sin quiebres.');
  } else if (fluidityScore >= 80 && isPartialAnalysis) {
    strengths.push(`Movimiento fluido en los segmentos detectados (fluidez: ${fluidityScore}/100).`);
  }

  // 5. ANÁLISIS DE PÉRDIDAS DE ENERGÍA (solo si hay suficientes datos)
  const energyLeak = biomech.metrics.energyLeakPct;
  
  if (energyLeak > 35 && !isPartialAnalysis) {
    errors.push(`Pérdidas significativas de energía detectadas (${energyLeak.toFixed(1)}%). Hay fugas en la cadena cinética.`);
    recommendations.push('Minimiza las pérdidas de energía mejorando la sincronización entre segmentos y reduciendo movimientos compensatorios.');
    coachMessages.push('Hay fugas de energía en tu movimiento. Trabaja en la sincronización de todos los segmentos.');
    labels.push('fugas_energia');
  } else if (energyLeak < 20 && !isPartialAnalysis) {
    strengths.push('Transferencia energética eficiente. Las pérdidas de energía son mínimas.');
  } else if (energyLeak < 20 && isPartialAnalysis) {
    strengths.push(`Transferencia eficiente en los segmentos detectados (pérdidas: ${energyLeak.toFixed(1)}%).`);
  }

  // 6. ANÁLISIS DE RETRASOS EN SECUENCIA
  const sequenceDelay = biomech.metrics.sequenceDelayMs;
  if (sequenceDelay > 150) {
    errors.push(`Retrasos significativos en la secuencia (${sequenceDelay}ms). Los segmentos no se activan de forma coordinada.`);
    recommendations.push('Mejora la coordinación entre segmentos. La activación debe ser más rápida y sincronizada.');
    labels.push('retraso_secuencia');
  }

  // 7. ANÁLISIS DE EFICIENCIA GENERAL (ajustar según análisis parcial)
  const efficiency = biomech.efficiencyIndex;
  
  if (isPartialAnalysis) {
    // Si es análisis parcial, no decir "excelente" basado solo en índice
    if (efficiency >= 80) {
      strengths.push(`Índice de eficiencia alto (${efficiency}/100) en los segmentos detectados, pero el análisis es parcial.`);
    } else if (efficiency >= 60) {
      recommendations.push(`Eficiencia aceptable (${efficiency}/100) en los segmentos detectados, pero el análisis es limitado.`);
    } else {
      recommendations.push(`Eficiencia baja (${efficiency}/100). Trabaja en mejorar la secuencia de activación de los segmentos detectados.`);
    }
  } else {
    // Análisis completo
    if (efficiency >= 80) {
      strengths.push(`Excelente transferencia energética (${efficiency}/100). La cadena cinética funciona de manera óptima.`);
    } else if (efficiency >= 60) {
      recommendations.push(`Eficiencia aceptable (${efficiency}/100) pero hay margen de mejora. Enfócate en la sincronización y fluidez.`);
    } else {
      errors.push(`Eficiencia baja (${efficiency}/100). Hay problemas significativos en la transferencia energética que requieren corrección.`);
      recommendations.push('Trabaja en los fundamentos: orden de activación, timing y fluidez. Estos son esenciales para una transferencia eficiente.');
    }
  }

  // 8. RECOMENDACIONES PARA SEGMENTOS NO DETECTADOS
  const segmentMessages: Record<string, string> = {
    'cadera': 'No se detectó activación clara de cadera. Enfatizá la transferencia desde la cadera inmediatamente después de las piernas para generar más potencia.',
    'tronco': 'No se detectó activación clara del tronco. El tronco debe activarse después de la cadera para transferir energía al brazo.',
    'brazo': 'No se detectó activación clara del brazo. El brazo debe activarse después del tronco, no antes de la cadera.',
    'muñeca': 'No se detectó activación clara de muñeca. La muñeca debe activarse al final de la secuencia para impartir velocidad final al balón.',
    'dedos': 'No se detectó activación clara de dedos. Los dedos son el último segmento en activarse y proporcionan el toque final.',
  };
  
  for (const seg of sequence) {
    if (seg.status === 'no_detectado' && segmentMessages[seg.segment]) {
      recommendations.push(segmentMessages[seg.segment]);
    }
  }
  
  // 9. GARANTIZAR MÍNIMOS
  // Si no hay errores, agregar recomendaciones genéricas basadas en métricas
  if (errors.length === 0 && recommendations.length === 0) {
    if (efficiency < 90) {
      recommendations.push('Hay pequeños ajustes que pueden mejorar aún más tu técnica. Mantén el enfoque en la continuidad del movimiento.');
    }
  }

  // Si no hay fortalezas, identificar al menos una
  if (strengths.length === 0) {
    if (sequence.length >= 3) {
      strengths.push('Buena activación de múltiples segmentos. Continúa trabajando en la coordinación.');
    } else {
      strengths.push('El análisis muestra áreas de mejora claras. Con trabajo enfocado puedes mejorar significativamente.');
    }
  }

  // Garantizar al menos un coachMessage
  if (coachMessages.length === 0) {
    if (errors.length > 0) {
      coachMessages.push(errors[0]);
    } else if (recommendations.length > 0) {
      coachMessages.push(recommendations[0]);
    } else {
      coachMessages.push('Continúa trabajando en la técnica. El análisis muestra áreas específicas de mejora.');
    }
  }

  // Eliminar duplicados
  const uniqueErrors = Array.from(new Set(errors));
  const uniqueRecommendations = Array.from(new Set(recommendations));
  const uniqueStrengths = Array.from(new Set(strengths));
  const uniqueCoachMessages = Array.from(new Set(coachMessages));
  const uniqueLabels = Array.from(new Set(labels));

  return {
    feedback: {
      errors: uniqueErrors,
      recommendations: uniqueRecommendations,
      strengths: uniqueStrengths,
      coachMessages: uniqueCoachMessages,
    },
    labels: uniqueLabels,
  };
}

