import type { ChecklistCategory, DetailedChecklistItem } from "./types";
import { adminDb } from "./firebase-admin";

// Pesos exactos por ítem del checklist de Tiro de Tres (default). Deben sumar 100.
export const ITEM_WEIGHTS_TRES: Record<string, number> = {
  // Fluidez (30%)
  tiro_un_solo_tiempo: 14.25,
  sincronia_piernas: 14.25,

  // Preparación (24%)
  alineacion_pies: 3.8,
  alineacion_cuerpo: 3.8,
  muneca_cargada: 3.8,
  flexion_rodillas: 3.8,
  hombros_relajados: 3.8,
  enfoque_visual: 3.8,

  // Ascenso (24%)
  mano_no_dominante_ascenso: 3.8,
  codos_cerca_cuerpo: 3.8,
  trayectoria_hasta_set_point: 3.8,
  subida_recta_balon: 3.8,
  set_point: 3.8,
  tiempo_lanzamiento: 3.8,
  angulo_codo_fijo_ascenso: 5,

  // Liberación (14%)
  mano_no_dominante_liberacion: 3.325,
  extension_completa_brazo: 3.325,
  giro_pelota: 3.325,
  angulo_salida: 3.325,

  // Seguimiento / Post-liberación (8%)
  equilibrio_general: 2.85, // Unificado: mantenimiento_equilibrio (2) + equilibrio_aterrizaje (1)
  duracion_follow_through: 2.375,
  consistencia_general: 2.375, // Unificado: consistencia_repetitiva
};

// Pesos exactos por ítem del checklist de Tiro Libre. Deben sumar 100.
export const ITEM_WEIGHTS_LIBRE: Record<string, number> = {
  // Preparación (28%)
  rutina_pre_tiro: 8.4,
  alineacion_pies_cuerpo: 7.0,
  muneca_cargada_libre: 5.6,
  flexion_rodillas_libre: 4.2,
  posicion_inicial_balon: 2.8,

  // Ascenso (23%)
  set_point_altura_edad: 9.2,
  codos_cerca_cuerpo_libre: 6.9,
  trayectoria_vertical_libre: 4.6,
  mano_guia_libre: 2.3,

  // Fluidez (12%)
  tiro_un_solo_tiempo_libre: 7.2,
  sincronia_piernas_libre: 4.8,

  // Liberación (22%)
  extension_completa_liberacion: 8.8,
  angulo_salida_libre: 7.7,
  flexion_muneca_final: 3.3,
  rotacion_balon: 2.2,

  // Seguimiento (15%)
  // Equilibrio y Estabilidad (9.75% del total)
  sin_salto_reglamentario: 3.9,
  pies_dentro_zona: 2.93,
  balance_vertical: 2.93,
  follow_through_completo_libre: 5.25,
};

export const CATEGORY_TO_ITEM_IDS: Record<string, string[]> = {
  // Tiro de Tres (3 puntos)
  "Fluidez (30%)": ["tiro_un_solo_tiempo", "sincronia_piernas"],
  "Preparación (24%)": [
    "alineacion_pies",
    "alineacion_cuerpo",
    "muneca_cargada",
    "flexion_rodillas",
    "hombros_relajados",
    "enfoque_visual",
  ],
  "Ascenso (24%)": [
    "mano_no_dominante_ascenso",
    "codos_cerca_cuerpo",
    "trayectoria_hasta_set_point",
    "subida_recta_balon",
    "set_point",
    "tiempo_lanzamiento",
    "angulo_codo_fijo_ascenso",
  ],
  "Liberación (14%)": [
    "mano_no_dominante_liberacion",
    "extension_completa_brazo",
    "giro_pelota",
    "angulo_salida",
  ],
  "Seguimiento / Post-liberación (8%)": [
    "equilibrio_general",
    "duracion_follow_through",
    "consistencia_general",
  ],
  
  // Tiro Libre
  "Preparación (28%)": [
    "rutina_pre_tiro",
    "alineacion_pies_cuerpo",
    "muneca_cargada_libre",
    "flexion_rodillas_libre",
    "posicion_inicial_balon",
  ],
  "Ascenso (23%)": [
    "set_point_altura_edad",
    "codos_cerca_cuerpo_libre",
    "trayectoria_vertical_libre",
    "mano_guia_libre",
  ],
  "Fluidez (12%)": [
    "tiro_un_solo_tiempo_libre",
    "sincronia_piernas_libre",
  ],
  "Liberación (22%)": [
    "extension_completa_liberacion",
    "angulo_salida_libre",
    "flexion_muneca_final",
    "rotacion_balon",
  ],
  "Seguimiento (15%)": [
    "sin_salto_reglamentario",
    "pies_dentro_zona",
    "balance_vertical",
    "follow_through_completo_libre",
  ],
};

// Obtener pesos por defecto según tipo de tiro
export function getDefaultWeights(shotType: string): Record<string, number> {
  switch (shotType.toLowerCase()) {
    case 'libre':
    case 'freethrow':
    case 'tiro libre':
      return ITEM_WEIGHTS_LIBRE;
    case 'tres':
    case 'three':
    case '3 puntos':
    case '3-point':
    default:
      return ITEM_WEIGHTS_TRES;
  }
}

// Cache de pesos cargados desde Firestore
let cachedWeights: Record<string, Record<string, number>> = {};

// Cargar pesos desde Firestore
export async function loadWeightsFromFirestore(shotType: string = 'tres'): Promise<Record<string, number>> {
  try {
    const docId = `scoringWeights_${shotType}`;
    
    // Verificar cache
    if (cachedWeights[shotType]) {
      return cachedWeights[shotType];
    }

    if (!adminDb) {
      console.warn('⚠️ AdminDb no disponible, usando pesos por defecto');
      return getDefaultWeights(shotType);
    }

    const docRef = adminDb.collection('config').doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const defaultWeights = getDefaultWeights(shotType);
      cachedWeights[shotType] = defaultWeights;
      return defaultWeights;
    }

    const data = docSnap.data();
    const weights = data?.weights || getDefaultWeights(shotType);
    
    cachedWeights[shotType] = weights;
    
    return weights;
  } catch (error) {
    console.error('❌ Error cargando pesos desde Firestore:', error);
    return getDefaultWeights(shotType);
  }
}

// Limpiar cache (útil cuando se actualizan los pesos)
export function clearWeightsCache() {
  cachedWeights = {};
}

export function getItemWeight(itemId: string, customWeights?: Record<string, number>): number {
  const key = (itemId || "").trim().toLowerCase();
  const weights = customWeights || ITEM_WEIGHTS_TRES;
  return weights[key] ?? 0;
}

export function getCategoryNominalWeight(categoryName: string, customWeights?: Record<string, number>): number {
  const ids = CATEGORY_TO_ITEM_IDS[categoryName] || [];
  return ids.reduce((sum, id) => sum + getItemWeight(id, customWeights), 0);
}

export function computeCategorySubtotal(category: ChecklistCategory, customWeights?: Record<string, number>): { achieved: number; max: number } {
  const max = getCategoryNominalWeight(category.category, customWeights);
  if (max <= 0) return { achieved: 0, max: 0 };
  
  // Filtrar solo ítems evaluables (no N/A y no no_evaluable)
  const evaluableItems = category.items
    .filter((it) => !(it as any).na && it.status !== 'no_evaluable' && typeof it.rating === 'number' && it.rating > 0);
  
  // Calcular pesos solo de ítems evaluables
  const evaluableWeights = evaluableItems
    .map((it) => getItemWeight(it.id, customWeights))
    .filter((w) => w > 0);
  
  const denom = evaluableWeights.reduce((a, b) => a + b, 0);
  if (denom <= 0) return { achieved: 0, max };
  
  let numer = 0;
  for (const it of evaluableItems) {
    const w = getItemWeight(it.id, customWeights);
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
export function computeFinalScoreWithTransparency(categories: ChecklistCategory[], customWeights?: Record<string, number>): {
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
      const weight = getItemWeight(item.id, customWeights);
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
        if (typeof item.rating === 'number') {
          const percent = Math.max(0, Math.min(100, (item.rating / 5) * 100));
          totalScore += weight * percent;
        }
      }
    }
  }
  
  const totalWeight = evaluableWeight + (nonEvaluableCount * 0); // Solo contar peso de evaluables
  // totalScore ya está en escala 0..100 ponderada por peso
  const finalScore = evaluableWeight > 0 ? (totalScore / evaluableWeight) : 0;
  
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

export type ScoreMetadata = {
  weightedScore: number;
  evaluableCount: number;
  nonEvaluableCount: number;
  evaluableWeight: number;
  totalWeight: number;
  confidence: 'alta' | 'media' | 'baja';
  nonEvaluableReasons: string[];
  shotTypeKey: string;
  calculatedAt: string;
};

export function normalizeShotTypeKey(shotType?: string): string {
  const st = String(shotType || '').toLowerCase();
  if (!st) return 'tres';
  if (st.includes('libre') || st.includes('free') || st.includes('ft')) return 'libre';
  if (st.includes('media') || st.includes('jump')) return 'media';
  if (st.includes('tres') || st.includes('3')) return 'tres';
  return st;
}

export function buildScoreMetadata(
  categories: ChecklistCategory[],
  shotType?: string,
  weights?: Record<string, number>
): ScoreMetadata {
  const shotTypeKey = normalizeShotTypeKey(shotType);
  const resolvedWeights = weights && Object.keys(weights).length > 0 ? weights : getDefaultWeights(shotTypeKey);
  const summary = computeFinalScoreWithTransparency(categories, resolvedWeights);

  return {
    weightedScore: summary.score,
    evaluableCount: summary.evaluableCount,
    nonEvaluableCount: summary.nonEvaluableCount,
    evaluableWeight: summary.evaluableWeight,
    totalWeight: summary.totalWeight,
    confidence: summary.confidence,
    nonEvaluableReasons: summary.nonEvaluableReasons,
    shotTypeKey,
    calculatedAt: new Date().toISOString(),
  };
}

