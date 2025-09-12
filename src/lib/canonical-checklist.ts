import type { ChecklistCategory, DetailedChecklistItem } from "./types";

type CanonicalItemDef = { id: string; name: string; description: string };
type CanonicalCategoryDef = { category: string; items: CanonicalItemDef[] };

export const CANONICAL_CATEGORIES: CanonicalCategoryDef[] = [
  {
    category: "Preparación",
    items: [
      {
        id: "alineacion_pies",
        name: "Alineación de los pies",
        description:
          "Pies hacia el aro (o leve apertura natural), apoyo equilibrado; evitar cruzarse o giros excesivos.",
      },
      {
        id: "alineacion_cuerpo",
        name: "Alineación del cuerpo",
        description:
          "Hombros, caderas y pies alineados al aro; eje corporal recto y estable, sin torsiones.",
      },
      {
        id: "muneca_cargada",
        name: "Muñeca cargada",
        description:
          "Muñeca de la mano de tiro flexionada hacia atrás, lista para liberar y generar backspin.",
      },
      {
        id: "flexion_rodillas",
        name: "Flexión de rodillas",
        description:
          "Flexión controlada, idealmente 45°–70°; evitar rigidez o sobre-flexión (>90°).",
      },
      {
        id: "hombros_relajados",
        name: "Hombros relajados",
        description:
          "Sin tensión excesiva, alineados y estables, permitiendo movimiento fluido del brazo de tiro.",
      },
      {
        id: "enfoque_visual",
        name: "Enfoque visual",
        description:
          "Mirada fija en aro o punto objetivo antes y durante el tiro; evitar mirar la pelota.",
      },
    ],
  },
  {
    category: "Ascenso",
    items: [
      {
        id: "mano_no_dominante_ascenso",
        name: "Posición de la mano no dominante (ascenso)",
        description:
          "La mano de apoyo acompaña sin empujar; debe soltar antes de la liberación.",
      },
      {
        id: "codos_cerca_cuerpo",
        name: "Codos cerca del cuerpo",
        description:
          "Codos alineados y cercanos al eje corporal; evitar apertura excesiva.",
      },
      {
        id: "subida_recta_balon",
        name: "Subida recta del balón",
        description:
          "Ascenso vertical y cercano al eje corporal; evitar trayectorias inclinadas o desde el costado.",
      },
      {
        id: "trayectoria_hasta_set_point",
        name: "Trayectoria del balón hasta el set point",
        description:
          "El balón sube recto y cercano al eje hacia el set point; evitar trayectorias circulares.",
      },
      {
        id: "set_point",
        name: "Set point",
        description:
          "Altura adecuada según edad; estable y reproducible; no debe romper la continuidad (un solo tiempo).",
      },
      {
        id: "tiempo_lanzamiento",
        name: "Tiempo de lanzamiento",
        description:
          "Medir rapidez y continuidad del gesto entre recepción y liberación, manteniendo control y técnica.",
      },
    ],
  },
  {
    category: "Fluidez",
    items: [
      {
        id: "tiro_un_solo_tiempo",
        name: "Tiro en un solo tiempo",
        description:
          "El balón no debe detenerse al llegar al set point; el gesto debe ser continuo desde la preparación hasta la liberación.",
      },
      {
        id: "sincronia_piernas",
        name: "Transferencia energética – sincronía con piernas",
        description:
          "El balón llega al set point coordinado con la extensión de las piernas, alcanzando ~70–80% de extensión en ese instante.",
      },
    ],
  },
  {
    category: "Liberación",
    items: [
      {
        id: "mano_no_dominante_liberacion",
        name: "Mano no dominante en la liberación",
        description:
          "Debe soltarse antes que la mano de tiro empuje; no aporta fuerza ni desvía, solo guía.",
      },
      {
        id: "extension_completa_brazo",
        name: "Extensión completa del brazo (follow-through)",
        description:
          "Brazo de tiro totalmente extendido hacia el aro, codo bloqueado y muñeca relajada; sostener.",
      },
      {
        id: "giro_pelota",
        name: "Giro de la pelota (backspin)",
        description:
          "Giro uniforme hacia atrás, rotación centrada y consistente; producto del roce final de los dedos.",
      },
      {
        id: "angulo_salida",
        name: "Ángulo de salida",
        description:
          "Recomendado ~45°–52° según altura y características del jugador.",
      },
    ],
  },
  {
    category: "Seguimiento / Post-liberación",
    items: [
      {
        id: "mantenimiento_equilibrio",
        name: "Mantenimiento del equilibrio",
        description:
          "Tronco y postura estables; evitar desvíos laterales o hacia atrás tras la liberación.",
      },
      {
        id: "equilibrio_aterrizaje",
        name: "Equilibrio en el aterrizaje",
        description:
          "Caer con ambos pies alineados, sin cruzarse ni desestabilizarse.",
      },
      {
        id: "duracion_follow_through",
        name: "Duración del follow-through",
        description:
          "Mantener brazo y muñeca extendidos hasta final del recorrido; no bajarlos antes.",
      },
      {
        id: "consistencia_repetitiva",
        name: "Consistencia repetitiva",
        description:
          "Repetir el mismo gesto técnico en todas las fases y tiros, sin variaciones que afecten precisión.",
      },
    ],
  },
];

export function buildCanonicalChecklist(): ChecklistCategory[] {
  return CANONICAL_CATEGORIES.map((cat) => ({
    category: cat.category,
    items: cat.items.map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      rating: 3,
      comment: "",
      na: true,
    })) as DetailedChecklistItem[],
  }));
}


