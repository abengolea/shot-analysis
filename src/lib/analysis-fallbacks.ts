import type { AnalyzeBasketballShotOutput } from '@/ai/flows/analyze-basketball-shot';

const summarizeChecklist = (detailedChecklist: Array<{ items: Array<{ na?: boolean }> }>) => {
  let evaluados = 0;
  let noEvaluables = 0;
  detailedChecklist.forEach((category) => {
    category.items.forEach((item) => {
      if (item?.na) noEvaluables += 1;
      else evaluados += 1;
    });
  });
  return {
    parametros_evaluados: evaluados,
    parametros_no_evaluables: noEvaluables,
    lista_no_evaluables: [],
  };
};

export function buildNoShotsAnalysis(): AnalyzeBasketballShotOutput {
  const baseReason = 'No se detectaron tiros completos en el video.';
  const userFacingMessage = 'NO DETECTAMOS TIROS COMPLETOS EN EL VIDEO.';
  const makeItem = (id: string, name: string, description: string) => ({
    id,
    name,
    description: description || 'No provisto por IA',
    status: 'no_evaluable' as const,
    rating: 0,
    timestamp: 'N/A',
    evidencia: 'No provisto por IA',
    na: true,
    razon: baseReason,
    comment: baseReason,
  });

  const detailedChecklist = [
    {
      category: 'Preparacion',
      items: [
        makeItem('alineacion_pies', 'Alineacion de los pies', 'Posicion respecto al aro'),
        makeItem('alineacion_cuerpo', 'Alineacion del cuerpo', 'Hombros, caderas y pies alineados'),
        makeItem('muneca_cargada', 'Muneca cargada', 'Flexion hacia atras para backspin'),
        makeItem('flexion_rodillas', 'Flexion de rodillas', 'Profundidad controlada'),
        makeItem('hombros_relajados', 'Hombros relajados', 'Sin tension excesiva'),
        makeItem('enfoque_visual', 'Enfoque visual', 'Mirada fija en el aro'),
      ],
    },
    {
      category: 'Ascenso',
      items: [
        makeItem('mano_no_dominante_ascenso', 'Mano no dominante (ascenso)', 'Acompana sin empujar'),
        makeItem('codos_cerca_cuerpo', 'Codos cerca del cuerpo', 'Alineados y cercanos al eje'),
        makeItem('angulo_codo_fijo_ascenso', 'Angulo de codo estable', 'Mantiene angulo fijo hasta el set point'),
        makeItem('subida_recta_balon', 'Subida recta del balon', 'Ascenso vertical y cercano'),
        makeItem('trayectoria_hasta_set_point', 'Trayectoria hasta set point', 'Recto y cercano al eje'),
        makeItem('set_point', 'Set point', 'Altura adecuada y estable'),
        makeItem('tiempo_lanzamiento', 'Tiempo de lanzamiento', 'Rapidez y continuidad del gesto'),
      ],
    },
    {
      category: 'Fluidez',
      items: [
        makeItem('tiro_un_solo_tiempo', 'Tiro en un solo tiempo', 'Transicion fluida sin pausas'),
        makeItem('sincronia_piernas', 'Transferencia energetica', 'Coordinacion piernas y brazos'),
      ],
    },
    {
      category: 'Liberacion',
      items: [
        makeItem('mano_no_dominante_liberacion', 'Mano no dominante (liberacion)', 'Se separa sin empujar'),
        makeItem('extension_completa_brazo', 'Extension completa del brazo', 'Follow-through completo'),
        makeItem('giro_pelota', 'Giro de la pelota', 'Backspin visible'),
        makeItem('angulo_salida', 'Angulo de salida', 'Trayectoria adecuada'),
      ],
    },
    {
      category: 'Seguimiento',
      items: [
        makeItem('equilibrio_post_liberacion', 'Equilibrio post-liberacion', 'Balance estable tras el tiro'),
        makeItem('duracion_follow_through', 'Duracion del follow-through', 'Mantiene la posicion'),
        makeItem('consistencia_general', 'Consistencia general', 'Repite mecanica estable'),
      ],
    },
  ];

  const resumen = summarizeChecklist(detailedChecklist);

  return {
    verificacion_inicial: {
      duracion_video: 'No verificable',
      mano_tiro: 'No verificable',
      salta: false,
      canasta_visible: false,
      angulo_camara: 'No verificable',
      elementos_entorno: [],
      tiros_detectados: 0,
    },
    analysisSummary: userFacingMessage,
    strengths: [],
    weaknesses: [],
    recommendations: [],
    selectedKeyframes: [],
    keyframeAnalysis: 'No se detectaron tiros completos; se omite análisis técnico.',
    detailedChecklist,
    resumen_evaluacion: {
      parametros_evaluados: resumen.parametros_evaluados,
      parametros_no_evaluables: resumen.parametros_no_evaluables,
      lista_no_evaluables: resumen.lista_no_evaluables,
      score_global: 0,
      nota: baseReason,
      confianza_analisis: 'baja',
    },
    advertencia: baseReason,
    caracteristicas_unicas: [],
  };
}

export function buildUnverifiedShotAnalysis(reason?: string, confidence?: number): AnalyzeBasketballShotOutput {
  const baseReason =
    reason && reason.trim().length > 0
      ? `Se detectó intención de tiro, pero no hay evidencia de pose suficiente para análisis técnico. ${reason}`
      : 'Se detectó intención de tiro, pero no hay evidencia de pose suficiente para análisis técnico.';
  const userFacingMessage = 'Se detectó intención de tiro, pero no hay evidencia suficiente para análisis técnico.';
  const base = buildNoShotsAnalysis();
  return {
    ...base,
    analysisSummary: userFacingMessage,
    advertencia: baseReason,
    caracteristicas_unicas: [],
    verificacion_inicial: {
      ...base.verificacion_inicial,
      tiros_detectados: 0,
      deteccion_ia: {
        angulo_detectado: 'sin_tiros',
        estrategia_usada: 'llm_fallback',
        tiros_individuales: [],
        total_tiros: 0,
        confianza: typeof confidence === 'number' ? confidence : undefined,
      },
    },
  };
}
