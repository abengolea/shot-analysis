import type { BiomechDeterministicOutput } from './biomechanical-analysis';

type FeedbackPayload = {
  errors: string[];
  recommendations: string[];
  strengths: string[];
  coachMessages: string[];
};

export function generateRuleBasedFeedback(
  biomech: BiomechDeterministicOutput
): { feedback: FeedbackPayload; labels: string[] } {
  const labels: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];
  const strengths: string[] = [];

  if (biomech.metrics.energyLeakPct >= 35) {
    errors.push('Se detectan pérdidas de energía durante la transferencia.');
    labels.push('fugas_energia');
  }
  if (biomech.metrics.fluidityScore < 60) {
    errors.push('El movimiento se ve entrecortado o poco fluido.');
    labels.push('movimiento_brusco');
  }
  if (biomech.metrics.setPointScore < 60) {
    recommendations.push('Trabajá el set-point: eleva el balón y estabiliza antes de la extensión final.');
    labels.push('set_point_incorrecto');
  }
  if (biomech.timing.releaseVsLegsMs && biomech.timing.releaseVsLegsMs > 700) {
    recommendations.push('Soltá el balón un poco antes para evitar una liberación tardía.');
    labels.push('liberacion_tardia');
  }

  if (errors.length + recommendations.length + strengths.length === 0) {
    recommendations.push('Mantené una transferencia continua desde piernas a muñeca y cuidá el timing de liberación.');
  }

  const coachMessages = [...errors, ...recommendations, ...strengths];
  return { feedback: { errors, recommendations, strengths, coachMessages }, labels: Array.from(new Set(labels)) };
}
