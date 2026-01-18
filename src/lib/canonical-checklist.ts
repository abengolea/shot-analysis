import type { ChecklistCategory, DetailedChecklistItem } from "@/lib/types";

type ChecklistItemDefinition = Pick<
  DetailedChecklistItem,
  "id" | "name" | "description" | "status" | "rating" | "na" | "comment"
>;

const baseItem = (item: Omit<ChecklistItemDefinition, "status" | "rating" | "na" | "comment">): ChecklistItemDefinition => ({
  ...item,
  status: "no_evaluable",
  rating: 0,
  na: true,
  comment: "",
});

export const CANONICAL_CATEGORIES: ChecklistCategory[] = [
  {
    category: "Fluidez (30%)",
    items: [
      baseItem({
        id: "tiro_un_solo_tiempo",
        name: "Tiro en un solo tiempo",
        description: "El gesto es continuo y sin pausas durante la mecánica.",
      }),
      baseItem({
        id: "sincronia_piernas",
        name: "Sincronía con piernas",
        description: "Subida del balón coordinada con la extensión de piernas.",
      }),
    ],
  },
  {
    category: "Preparación (24%)",
    items: [
      baseItem({
        id: "alineacion_pies",
        name: "Alineación de pies",
        description: "Los pies apuntan hacia el aro y dan estabilidad.",
      }),
      baseItem({
        id: "alineacion_cuerpo",
        name: "Alineación corporal",
        description: "Cadera, hombros y torso alineados hacia el objetivo.",
      }),
      baseItem({
        id: "muneca_cargada",
        name: "Muñeca cargada",
        description: "Muñeca en flexión dorsal para preparar el release.",
      }),
      baseItem({
        id: "flexion_rodillas",
        name: "Flexión de rodillas",
        description: "Flexión adecuada para generar potencia controlada.",
      }),
      baseItem({
        id: "hombros_relajados",
        name: "Hombros relajados",
        description: "Tensión mínima para un movimiento fluido.",
      }),
      baseItem({
        id: "enfoque_visual",
        name: "Enfoque visual",
        description: "Mirada estable en el aro durante la preparación.",
      }),
    ],
  },
  {
    category: "Ascenso (24%)",
    items: [
      baseItem({
        id: "mano_no_dominante_ascenso",
        name: "Mano no dominante (ascenso)",
        description: "La mano guía estabiliza sin empujar el balón.",
      }),
      baseItem({
        id: "codos_cerca_cuerpo",
        name: "Codos cerca del cuerpo",
        description: "Codo alineado para una trayectoria recta.",
      }),
      baseItem({
        id: "angulo_codo_fijo_ascenso",
        name: "Ángulo de codo estable en ascenso",
        description: "El ángulo del codo se mantiene fijo desde la toma del balón hasta el set point.",
      }),
      baseItem({
        id: "trayectoria_hasta_set_point",
        name: "Trayectoria hasta set point",
        description: "El balón sube en línea hacia el punto de carga.",
      }),
      baseItem({
        id: "subida_recta_balon",
        name: "Subida recta del balón",
        description: "Ascenso vertical sin desviaciones laterales.",
      }),
      baseItem({
        id: "set_point",
        name: "Set point",
        description: "Punto de carga consistente y eficiente.",
      }),
      baseItem({
        id: "tiempo_lanzamiento",
        name: "Tiempo de lanzamiento",
        description: "Release sincronizado con la extensión final.",
      }),
    ],
  },
  {
    category: "Liberación (14%)",
    items: [
      baseItem({
        id: "mano_no_dominante_liberacion",
        name: "Mano no dominante (liberación)",
        description: "La mano guía no interfiere en el release.",
      }),
      baseItem({
        id: "extension_completa_brazo",
        name: "Extensión completa del brazo",
        description: "Extensión total del brazo en la liberación.",
      }),
      baseItem({
        id: "giro_pelota",
        name: "Giro de la pelota",
        description: "Backspin controlado para mayor estabilidad.",
      }),
      baseItem({
        id: "angulo_salida",
        name: "Ángulo de salida",
        description: "Ángulo óptimo para maximizar la precisión.",
      }),
    ],
  },
  {
    category: "Seguimiento / Post-liberación (8%)",
    items: [
      baseItem({
        id: "equilibrio_general",
        name: "Equilibrio general",
        description: "Control del balance durante y después del tiro.",
      }),
      baseItem({
        id: "duracion_follow_through",
        name: "Duración del follow-through",
        description: "Sostiene la extensión tras la liberación.",
      }),
      baseItem({
        id: "consistencia_general",
        name: "Consistencia general",
        description: "Repite una mecánica estable en cada tiro.",
      }),
    ],
  },
];

export const CANONICAL_CATEGORIES_LIBRE: ChecklistCategory[] = [
  {
    category: "Preparación (28%)",
    items: [
      baseItem({
        id: "rutina_pre_tiro",
        name: "Rutina pre-tiro",
        description: "Rutina estable antes de iniciar el tiro.",
      }),
      baseItem({
        id: "alineacion_pies_cuerpo",
        name: "Alineación pies/cuerpo",
        description: "Cuerpo alineado para un tiro recto.",
      }),
      baseItem({
        id: "muneca_cargada_libre",
        name: "Muñeca cargada",
        description: "Muñeca en flexión dorsal al tomar el balón.",
      }),
      baseItem({
        id: "flexion_rodillas_libre",
        name: "Flexión de rodillas",
        description: "Flexión controlada para generar potencia.",
      }),
      baseItem({
        id: "posicion_inicial_balon",
        name: "Posición inicial del balón",
        description: "Ubicación correcta del balón al iniciar.",
      }),
    ],
  },
  {
    category: "Ascenso (23%)",
    items: [
      baseItem({
        id: "set_point_altura_edad",
        name: "Set point altura según edad",
        description: "Altura del set point acorde a la edad y fuerza.",
      }),
      baseItem({
        id: "codos_cerca_cuerpo_libre",
        name: "Codos cerca del cuerpo",
        description: "Codo alineado para evitar desviaciones.",
      }),
      baseItem({
        id: "trayectoria_vertical_libre",
        name: "Trayectoria vertical",
        description: "Ascenso recto y vertical del balón.",
      }),
      baseItem({
        id: "mano_guia_libre",
        name: "Mano guía",
        description: "La mano no dominante solo guía y estabiliza.",
      }),
    ],
  },
  {
    category: "Fluidez (12%)",
    items: [
      baseItem({
        id: "tiro_un_solo_tiempo_libre",
        name: "Tiro en un solo tiempo",
        description: "Gesto continuo sin pausas intermedias.",
      }),
      baseItem({
        id: "sincronia_piernas_libre",
        name: "Sincronía con piernas",
        description: "Extensión de piernas coordinada con el balón.",
      }),
    ],
  },
  {
    category: "Liberación (22%)",
    items: [
      baseItem({
        id: "extension_completa_liberacion",
        name: "Extensión completa",
        description: "Extensión total del cuerpo y brazo al soltar.",
      }),
      baseItem({
        id: "angulo_salida_libre",
        name: "Ángulo de salida",
        description: "Ángulo óptimo para el tiro libre.",
      }),
      baseItem({
        id: "flexion_muneca_final",
        name: "Flexión de muñeca final",
        description: "Gooseneck visible tras la liberación.",
      }),
      baseItem({
        id: "rotacion_balon",
        name: "Rotación del balón",
        description: "Backspin estable y continuo.",
      }),
    ],
  },
  {
    category: "Seguimiento (15%)",
    items: [
      baseItem({
        id: "sin_salto_reglamentario",
        name: "Sin salto reglamentario",
        description: "No despegar antes del toque del aro.",
      }),
      baseItem({
        id: "pies_dentro_zona",
        name: "Pies dentro de la zona",
        description: "No invadir la línea antes del toque.",
      }),
      baseItem({
        id: "balance_vertical",
        name: "Balance vertical",
        description: "Sin desplazamientos laterales durante el tiro.",
      }),
      baseItem({
        id: "follow_through_completo_libre",
        name: "Follow-through completo",
        description: "Brazo extendido tras la liberación.",
      }),
    ],
  },
];
