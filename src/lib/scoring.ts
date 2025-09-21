import type { ChecklistCategory, DetailedChecklistItem } from "./types";

// Pesos exactos por ítem del checklist de Tiro de Tres (default). Deben sumar 100.
export const ITEM_WEIGHTS_TRES: Record<string, number> = {
  // Fluidez (50%)
  tiro_un_solo_tiempo: 25,
  sincronia_piernas: 25,

  // Preparación (17%)
  alineacion_pies: 2,
  alineacion_cuerpo: 2,
  muneca_cargada: 4,
  flexion_rodillas: 4,
  hombros_relajados: 3,
  enfoque_visual: 2,

  // Ascenso (17%)
  mano_no_dominante_ascenso: 3,
  codos_cerca_cuerpo: 2,
  trayectoria_hasta_set_point: 3,
  subida_recta_balon: 3,
  set_point: 2,
  tiempo_lanzamiento: 4,

  // Liberación (10%)
  mano_no_dominante_liberacion: 2,
  extension_completa_brazo: 4,
  giro_pelota: 2,
  angulo_salida: 2,

  // Seguimiento / Post-liberación (9%)
  mantenimiento_equilibrio: 2,
  equilibrio_aterrizaje: 1,
  duracion_follow_through: 1,
  consistencia_repetitiva: 5,
};

export const CATEGORY_TO_ITEM_IDS: Record<string, string[]> = {
  "Fluidez (50%)": ["tiro_un_solo_tiempo", "sincronia_piernas"],
  "Preparación (17%)": [
    "alineacion_pies",
    "alineacion_cuerpo",
    "muneca_cargada",
    "flexion_rodillas",
    "hombros_relajados",
    "enfoque_visual",
  ],
  "Ascenso (17%)": [
    "mano_no_dominante_ascenso",
    "codos_cerca_cuerpo",
    "trayectoria_hasta_set_point",
    "subida_recta_balon",
    "set_point",
    "tiempo_lanzamiento",
  ],
  "Liberación (10%)": [
    "mano_no_dominante_liberacion",
    "extension_completa_brazo",
    "giro_pelota",
    "angulo_salida",
  ],
  "Seguimiento / Post-liberación (9%)": [
    "mantenimiento_equilibrio",
    "equilibrio_aterrizaje",
    "duracion_follow_through",
    "consistencia_repetitiva",
  ],
};

export function getItemWeight(itemId: string): number {
  const key = (itemId || "").trim().toLowerCase();
  return ITEM_WEIGHTS_TRES[key] ?? 0;
}

export function getCategoryNominalWeight(categoryName: string): number {
  const ids = CATEGORY_TO_ITEM_IDS[categoryName] || [];
  return ids.reduce((sum, id) => sum + getItemWeight(id), 0);
}

export function computeCategorySubtotal(category: ChecklistCategory): { achieved: number; max: number } {
  const max = getCategoryNominalWeight(category.category);
  if (max <= 0) return { achieved: 0, max: 0 };
  
  // Filtrar solo ítems evaluables (no N/A y no no_evaluable)
  const evaluableItems = category.items
    .filter((it) => !(it as any).na && it.status !== 'no_evaluable' && it.rating > 0);
  
  // Calcular pesos solo de ítems evaluables
  const evaluableWeights = evaluableItems
    .map((it) => getItemWeight(it.id))
    .filter((w) => w > 0);
  
  const denom = evaluableWeights.reduce((a, b) => a + b, 0);
  if (denom <= 0) return { achieved: 0, max };
  
  let numer = 0;
  for (const it of evaluableItems) {
    const w = getItemWeight(it.id);
    if (w <= 0) continue;
    const r = typeof it.rating === 'number' ? it.rating : 3;
    const percent = Math.max(0, Math.min(100, (r / 5) * 100));
    numer += w * percent;
  }
  
  // Calcular score basado solo en parámetros evaluables
  const achieved = (numer / denom) * max / 100 * 100;
  return { achieved: Number(achieved.toFixed(2)), max };
}

// Nueva función para calcular score global con transparencia
export function computeFinalScoreWithTransparency(categories: ChecklistCategory[]): {
  score: number;
  evaluableCount: number;
  nonEvaluableCount: number;
  evaluableWeight: number;
  totalWeight: number;
  confidence: 'alta' | 'media' | 'baja';
  nonEvaluableReasons: string[];
} {
  let totalScore = 0;
  let evaluableWeight = 0;
  let evaluableCount = 0;
  let nonEvaluableCount = 0;
  const nonEvaluableReasons: string[] = [];
  
  for (const category of categories) {
    for (const item of category.items) {
      const weight = getItemWeight(item.id);
      if (weight <= 0) continue;
      
      if ((item as any).na || item.status === 'no_evaluable' || item.rating === 0) {
        nonEvaluableCount++;
        const reason = item.status === 'no_evaluable' ? 
          `${item.id}: ${(item as any).razon || 'no especificado'}` :
          `${item.id}: marcado como N/A`;
        nonEvaluableReasons.push(reason);
      } else {
        evaluableCount++;
        evaluableWeight += weight;
        const percent = Math.max(0, Math.min(100, (item.rating / 5) * 100));
        totalScore += weight * percent;
      }
    }
  }
  
  const totalWeight = evaluableWeight + (nonEvaluableCount * 0); // Solo contar peso de evaluables
  const finalScore = evaluableWeight > 0 ? (totalScore / evaluableWeight) * 100 : 0;
  
  // Determinar confianza basada en porcentaje de parámetros evaluables
  const evaluabilityRatio = evaluableCount / (evaluableCount + nonEvaluableCount);
  let confidence: 'alta' | 'media' | 'baja';
  if (evaluabilityRatio >= 0.8) confidence = 'alta';
  else if (evaluabilityRatio >= 0.5) confidence = 'media';
  else confidence = 'baja';
  
  return {
    score: Number(finalScore.toFixed(2)),
    evaluableCount,
    nonEvaluableCount,
    evaluableWeight,
    totalWeight,
    confidence,
    nonEvaluableReasons
  };
}



