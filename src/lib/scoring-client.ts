// Versión cliente de scoring.ts - sin dependencias del servidor

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

export function getItemWeight(itemId: string, customWeights?: Record<string, number>): number {
  const key = (itemId || "").trim().toLowerCase();
  const weights = customWeights || ITEM_WEIGHTS_TRES;
  return weights[key] ?? 0;
}

