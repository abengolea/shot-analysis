'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing basketball shots from video uploads.
 *
 * The flow takes a video URL and shot metadata as input, performs AI analysis on keyframes,
 * and provides personalized recommendations for improvement.
 *
 * @exports analyzeBasketballShot - The main function to trigger the analysis flow.
 * @exports AnalyzeBasketballShotInput - The input type for the analyzeBasketballShot function.
 * @exports AnalyzeBasketballShotOutput - The output type for the analyzeBasketballShot function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeBasketballShotInputSchema = z.object({
  videoUrl: z.string().describe('URL of the basketball shot video.'),
  ageCategory: z.enum([
    'Sub-10',
    'Sub-13',
    'Sub-15',
    'Sub-18',
    'Amateur adulto',
    'Profesional',
  ]).describe('Age category of the player.'),
  playerLevel: z.string().describe('Skill level of the player.'),
  shotType: z.string().describe('Type of shot (e.g., free throw, three-pointer).'),
  availableKeyframes: z.array(z.object({
    index: z.number().describe('Index of the keyframe (0-15)'),
    timestamp: z.number().describe('Timestamp in seconds'),
    description: z.string().describe('Brief description of what happens at this moment')
  })).describe('Available keyframes extracted from the video for the AI to select from'),
  // Optional prompt configuration to guide the analysis prompt (admin-tuned)
  promptConfig: z.object({
    intro: z.string().optional(),
    fluidezHelp: z.string().optional(),
    setPointHelp: z.string().optional(),
    resources: z.array(z.string()).optional(),
    categoryGuides: z.record(z.object({
      guide: z.string().optional(),
      resources: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
});
export type AnalyzeBasketballShotInput = z.infer<typeof AnalyzeBasketballShotInputSchema>;

// Prompt para detección de lanzamientos
const detectShotsPrompt = ai.definePrompt({
  name: 'detectShotsPrompt',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: z.object({
    shots_count: z.number(),
    shots: z.array(z.object({
      track_id: z.number(),
      idx: z.number(),
      start_ms: z.number(),
      load_ms: z.number().nullable(),
      release_ms: z.number(),
      apex_ms: z.number().nullable(),
      landing_ms: z.number().nullable(),
      end_ms: z.number(),
      estimated: z.boolean(),
      conf: z.number(),
      notes: z.array(z.string())
    })),
    diagnostics: z.object({
      fps_assumed: z.number().nullable(),
      frames_total: z.number().nullable(),
      policy: z.object({
        min_shot_ms: z.number(),
        max_shot_ms: z.number(),
        refractory_gap_ms: z.number(),
        merge_gap_ms: z.number()
      }),
      rejected_segments: z.number()
    })
  })},
  prompt: `Eres un analista de video de básquet. En este clip aparece UN SOLO JUGADOR realizando VARIOS TIROS consecutivos (shots). 
Tu tarea: segmentar TODOS los shots y devolver SOLO JSON válido (sin texto extra).

DEFINICIONES
- "Shot" (tiro): comienza con el inicio del movimiento específico de tiro con balón en control (fase de carga → extensión) y termina con el fin del follow-through y/o estabilización tras el aterrizaje, lo que ocurra último.
- Como es un solo jugador, NO hay tracking multi-jugador. Usa siempre "track_id": 1.
- Si el balón no se ve, estima el "release" con cinemática de muñeca y codo.

ENTRADA
- VIDEO/FRAMES: {DESCRIBE_CLIP_O_LISTA_DE_FRAMES}  // p.ej. "video 1080p, ~12 fps, 25 s"
- (OPCIONAL) FPS_APROX: {FPS_O_NULL}
- (OPCIONAL) POSE_JSON: {POSE_JSON_O_NULL}           // [{tMs, keypoints:[{name,x,y,score},...]}]
- (OPCIONAL) METRICS_JSON: {METRICS_JSON_O_NULL}     // si lo tienes: ángulos (codo/rodilla/cadera), comHeight, wristHeight, etc.
- (OPCIONAL) RIM_ROI: {RIM_BBOX_O_NULL}              // [x,y,w,h] normalizado 0..1 si conoces la ubicación del aro

POLÍTICA DE SEGMENTACIÓN (single-player)
- start_ms: primer cambio cinemático consistente con inicio de tiro (descenso de CoM y/o flexión de rodillas y elevación del balón/manos).
- load_ms: mínimo de CoM o máxima flexión de rodillas (si se puede).
- release_ms (prioridad):
  1) Fotograma donde el balón se separa de la mano (si es visible).
  2) Si no se ve: primera máxima extensión de codo + pico de velocidad vertical de muñeca en ascenso.
- apex_ms: máxima altura del balón; si no se ve, de la muñeca/CoM tras el release.
- landing_ms: contacto y estabilización tras el salto (si hay).
- end_ms: fin del follow-through o estabilización (lo último).

RESTRICCIONES PARA EVITAR FALSOS POSITIVOS
- Duración mínima por shot: >= 300 ms. Máxima: <= 8 s.
- "Refractory gap" entre tiros: start_ms del siguiente ≥ end_ms del anterior + 250 ms.
- Un shot NO puede solaparse con el siguiente.
- En secuencias rápidas (catch-and-shoots consecutivos), si la separación entre dos candidatos < 200 ms, fusiónalos en UN solo shot.
- Si hay drible intermedio, NO lo consideres shot por sí mismo.

SALIDA (JSON ESTRICTO)
{
  "shots_count": number,
  "shots": [
    {
      "track_id": 1,
      "idx": number,                  // 1..N según orden temporal
      "start_ms": number,
      "load_ms": number | null,
      "release_ms": number,
      "apex_ms": number | null,
      "landing_ms": number | null,
      "end_ms": number,
      "estimated": boolean,           // true si release/apex se infieren sin balón visible
      "conf": number,                 // 0..1
      "notes": string[]               // 1–3 señales observadas (breves)
    }
  ],
  "diagnostics": {
    "fps_assumed": number | null,
    "frames_total": number | null,
    "policy": {
      "min_shot_ms": 300,
      "max_shot_ms": 8000,
      "refractory_gap_ms": 250,
      "merge_gap_ms": 200
    },
    "rejected_segments": number
  }
}

REGLAS DE RESPUESTA
- Devuelve EXCLUSIVAMENTE el JSON anterior; sin texto fuera del objeto.
- Tiempos en milisegundos desde el comienzo del clip.
- Asegura: shots_count === shots.length, campos obligatorios no nulos, sin NaN, sin solapes.

Video: {{videoUrl}}`
});

// Ya no necesitamos este schema porque la IA no generará keyframes
// Los keyframes se extraerán con FFmpeg en el backend

// Detectar si es tiro libre o tres puntos
function detectTiroLibre(shotType: string | undefined): boolean {
  if (!shotType) return false;
  const tipo = shotType.toLowerCase();
  return tipo.includes('libre') || tipo.includes('free') || tipo.includes('ft');
}

// Checklist schemas
const EvidenceFrameSchema = z.object({
  frameId: z.string().describe('ID of the keyframe where this evidence was observed'),
  label: z.string().describe('Moment label (e.g., "set_point", "release", "follow_through")'),
  angle: z.string().optional().describe('Camera angle where this was observed'),
  note: z.string().optional().describe('Brief note about what is visible in this frame'),
});

const ChecklistItemSchema = z.object({
  id: z.string().describe('Stable id for the checklist item (slug-like).'),
  name: z.string().describe('Name of the checklist item'),
  description: z.string().describe('Short description of what is being evaluated'),
  // Updated status to include no_evaluable
  status: z.enum(['Correcto', 'Mejorable', 'Incorrecto', 'no_evaluable']).describe('Evaluation status including no_evaluable'),
  // Rating can be 0 for no_evaluable
  rating: z.number().int().min(0).max(5).describe('Rating 1-5, or 0 if no_evaluable'),
  // Optional timestamp when the parameter was observed
  timestamp: z.string().optional().describe('Exact timestamp where this parameter was observed (e.g., "1.35s")'),
  // Evidence of what was actually seen
  evidencia: z.string().optional().describe('Literal description of what was observed visually'),
  na: z.boolean().describe('Mark as true when parameter cannot be evaluated due to video limitations'),
  razon: z.string().optional().describe('Specific reason why parameter cannot be evaluated (e.g., "pies fuera de encuadre")'),
  comment: z.string().describe('Brief coach-like comment based on visual evidence or explanation of why not evaluable'),
  // Evidence frames for visual proof (only for PRO analysis)
  evidenceFrames: z.array(EvidenceFrameSchema).optional().describe('Visual evidence frames for this parameter'),
});

const ChecklistCategorySchema = z.object({
  category: z.string().describe('Checklist category name, e.g., "Preparación", "Liberación", etc.'),
  items: z.array(ChecklistItemSchema).describe('Items within the category')
});

const AnalyzeBasketballShotOutputSchema = z.object({
  verificacion_inicial: z.object({
    duracion_video: z.string().describe('Duration of the video in seconds'),
    mano_tiro: z.string().describe('Hand used for shooting (derecha/izquierda)'),
    salta: z.boolean().describe('Whether the player jumps during the shot'),
    canasta_visible: z.boolean().describe('Whether the basket is visible in the video'),
    angulo_camara: z.string().describe('Camera angle description'),
    elementos_entorno: z.array(z.string()).describe('List of visible environmental elements'),
    tiros_detectados: z.number().optional().describe('Number of shots detected in the video'),
    tiros_por_segundo: z.number().optional().describe('Shots per second ratio'),
    deteccion_ia: z.object({
      angulo_detectado: z.string().describe('Camera angle detected by AI'),
      estrategia_usada: z.string().describe('Detection strategy used'),
      tiros_individuales: z.array(z.object({
        numero: z.number(),
        timestamp: z.string(),
        descripcion: z.string()
      })).describe('Individual shots detected with timestamps'),
      total_tiros: z.number().describe('Total shots detected by AI')
    }).optional().describe('AI-based shot detection details'),
  }).describe('Initial verification that AI is actually seeing the video'),
  analysisSummary: z.string().describe('A summary of the shot analysis based ONLY on evaluable parameters.'),
  strengths: z.array(z.string()).describe('List of strengths based on specific visual evidence.'),
  weaknesses: z.array(z.string()).describe('List of weaknesses based on specific visual evidence.'),
  recommendations: z.array(z.string()).describe('Specific recommendations with timestamps.'),
  selectedKeyframes: z.array(z.number()).describe('Indexes of the 6 most important keyframes (0-15) that best represent the shot analysis'),
  keyframeAnalysis: z.string().describe('Brief explanation of why these specific keyframes were selected and what they show about the shot technique'),
  detailedChecklist: z.array(ChecklistCategorySchema).describe('Structured checklist evaluation for the shot technique with no_evaluable support'),
  resumen_evaluacion: z.object({
    parametros_evaluados: z.number().describe('Number of parameters that could be evaluated'),
    parametros_no_evaluables: z.number().describe('Number of parameters that could not be evaluated'),
    lista_no_evaluables: z.array(z.string()).describe('List of non-evaluable parameters with specific reasons'),
    score_global: z.number().describe('Global score calculated only with evaluable parameters'),
    nota: z.string().describe('Note about how the score was calculated'),
    confianza_analisis: z.enum(['alta', 'media', 'baja']).describe('Confidence level of the analysis'),
  }).describe('Summary of evaluation process and transparency'),
  caracteristicas_unicas: z.array(z.string()).describe('3 unique characteristics of THIS specific video that prove real analysis'),
  advertencia: z.string().optional().describe('Warning if analysis is limited by video quality'),
});
export type AnalyzeBasketballShotOutput = z.infer<typeof AnalyzeBasketballShotOutputSchema>;

// Función de prueba con prompt simple
export async function analyzeBasketballShotTest(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput> {
  try {
    console.log('🧪 Usando prompt de prueba simple...');
    const {output} = await analyzeShotPromptTest(input);
    return output!;
  } catch (e: any) {
    console.error('[analyzeBasketballShotTest] Error:', e?.message || e);
    throw new Error(`Error en análisis de prueba: ${e?.message || 'Error desconocido'}`);
  }
}

export async function analyzeBasketballShotTestWithEvidence(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput> {
  try {
    console.log('🧪 Usando prompt de prueba con evidencia visual...');
    const {output} = await analyzeShotPromptTestWithEvidence(input);
    return output!;
  } catch (e: any) {
    console.error('[analyzeBasketballShotTestWithEvidence] Error:', e?.message || e);
    throw new Error(`Error en análisis de prueba con evidencia: ${e?.message || 'Error desconocido'}`);
  }
}

export async function analyzeBasketballShotSimple(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput> {
  try {
    console.log('🧪 Usando prompt súper simple para detectar tiros...');
        const {output} = await analyzeShotPromptSimple(input);
        return output!;
  } catch (e: any) {
    console.error('[analyzeBasketballShotSimple] Error:', e?.message || e);
    throw new Error(`Error en detección simple: ${e?.message || 'Error desconocido'}`);
  }
}

// Función para detectar lanzamientos usando tu prompt
export async function detectShots(input: AnalyzeBasketballShotInput): Promise<any> {
  try {
            const {output} = await detectShotsPrompt(input);
        return output!;
  } catch (e: any) {
    console.error('[detectShots] Error:', e?.message || e);
    throw new Error(`Error en detección de lanzamientos: ${e?.message || 'Error desconocido'}`);
  }
}

// Función combinada: detecta lanzamientos + analiza técnica CON INFORMACIÓN COMPARTIDA
export async function analyzeBasketballShotCombined(input: AnalyzeBasketballShotInput): Promise<{
  shotDetection: any;
  technicalAnalysis: AnalyzeBasketballShotOutput;
}> {
  try {
            // PASO 1: Detectar lanzamientos con tu prompt
        const shotDetection = await detectShots(input);
        // PASO 2: Crear prompt técnico que use la información de detección
        const technicalAnalysis = await analyzeBasketballShotWithDetection(input, shotDetection);
        // PASO 3: Combinar resultados
        const combinedResult = {
      shotDetection,
      technicalAnalysis
    };
    
        return combinedResult;
    
  } catch (e: any) {
    console.error('[analyzeBasketballShotCombined] Error:', e?.message || e);
    throw new Error(`Error en análisis combinado: ${e?.message || 'Error desconocido'}`);
  }
}

// Función que analiza técnica usando la información de detección
async function analyzeBasketballShotWithDetection(input: AnalyzeBasketballShotInput, shotDetection: any): Promise<AnalyzeBasketballShotOutput> {
  try {
        // Crear prompt que use la información de detección
    const technicalPromptWithDetection = ai.definePrompt({
      name: 'technicalPromptWithDetection',
      input: {schema: AnalyzeBasketballShotInputSchema},
      output: {schema: AnalyzeBasketballShotOutputSchema},
      prompt: `🎯 ANÁLISIS TÉCNICO USANDO INFORMACIÓN DE DETECCIÓN

INFORMACIÓN DE DETECCIÓN PREVIA:
- Tiros detectados: ${shotDetection.shots_count}
- Tiros individuales:
${shotDetection.shots.map((shot: any, index: number) => 
  `  ${index + 1}. Inicio: ${(shot.start_ms / 1000).toFixed(1)}s, Liberación: ${(shot.release_ms / 1000).toFixed(1)}s, Fin: ${(shot.end_ms / 1000).toFixed(1)}s`
).join('\n')}

INSTRUCCIONES CRÍTICAS:
1. USA EXACTAMENTE la información de detección anterior
2. NO inventes tiros que no existen
3. NO cambies los timestamps detectados
4. Analiza SOLO los tiros detectados
5. Si detectaste ${shotDetection.shots_count} tiros, analiza ${shotDetection.shots_count} tiros

VERIFICACIÓN INICIAL OBLIGATORIA:
Antes de analizar, DEMUESTRA que ves el video real respondiendo:
1. Duración exacta del video en segundos
2. ¿El jugador tira con mano derecha o izquierda?
3. ¿Salta durante el tiro? (sí/no)
4. ¿Se ve la canasta en el video? (sí/no)
5. ¿Desde qué ángulo está grabado? (frontal/lateral/diagonal)
6. ¿Qué elementos del entorno son visibles?

ANÁLISIS TÉCNICO:
Para CADA tiro detectado, evalúa los 21 parámetros canónicos:

📋 PREPARACIÓN (6 parámetros):
1. Alineación de los pies - Posición respecto al aro
2. Alineación del cuerpo - Hombros, caderas y pies alineados
3. Muñeca cargada - Flexión hacia atrás para backspin
4. Flexión de rodillas - Profundidad controlada (45°-70°)
5. Hombros relajados - Sin tensión excesiva
6. Enfoque visual - Mirada fija en el aro

📋 ASCENSO (6 parámetros):
7. Posición de la mano no dominante (ascenso) - Acompaña sin empujar
8. Codos cerca del cuerpo - Alineados y cercanos al eje
9. Subida recta del balón - Ascenso vertical y cercano
10. Trayectoria del balón hasta el set point - Recto y cercano al eje
11. Set point - Altura adecuada y estable
12. Tiempo de lanzamiento - Rapidez y continuidad del gesto

📋 FLUIDEZ (2 parámetros):
13. Tiro en un solo tiempo - Sin detención en el set point
14. Transferencia energética - Sincronía con piernas

📋 LIBERACIÓN (4 parámetros):
15. Mano no dominante en la liberación - Se suelta antes
16. Extensión completa del brazo - Follow-through completo
17. Giro de la pelota - Backspin uniforme
18. Ángulo de salida - Recomendado 45°-52°

📋 SEGUIMIENTO/POST-LIBERACIÓN (3 parámetros):
19. Equilibrio general - Estabilidad y aterrizaje controlado
20. Duración del follow-through - Mantener extensión
21. Consistencia general - Repetibilidad del gesto

FORMATO DE RESPUESTA:
{
  "verificacion_inicial": {
    "duracion_video": "X.Xs",
    "mano_tiro": "derecha/izquierda",
    "salta": true/false,
    "canasta_visible": true/false,
    "angulo_camara": "frontal/lateral/trasero",
    "elementos_entorno": ["aro", "tablero", "cancha"],
    "tiros_detectados": ${shotDetection.shots_count},
    "tiros_por_segundo": ${(shotDetection.shots_count / 15).toFixed(2)},
    "deteccion_ia": {
      "angulo_detectado": "frontal/lateral/trasero",
      "estrategia_usada": "detección previa",
      "tiros_individuales": [
        ${shotDetection.shots.map((shot: any) => 
          `{
            "numero": ${shot.idx},
            "timestamp": "${(shot.release_ms / 1000).toFixed(1)}s",
            "descripcion": "Tiro detectado"
          }`
        ).join(',\n        ')}
      ],
      "total_tiros": ${shotDetection.shots_count}
    }
  },
  "analysisSummary": "Análisis técnico de ${shotDetection.shots_count} tiros detectados",
  "strengths": ["Fortalezas basadas en evidencia visual"],
  "weaknesses": ["Debilidades basadas en evidencia visual"],
  "recommendations": ["Recomendaciones específicas"],
  "selectedKeyframes": [1, 2, 3, 4, 5, 6],
  "keyframeAnalysis": "Frames seleccionados muestran los tiros detectados",
  "detailedChecklist": [
    {
      "category": "Preparación",
      "items": [
        {
          "id": "alineacion_pies",
          "name": "Alineación de los pies",
          "description": "Posición de los pies respecto al aro",
          "status": "Correcto/Mejorable/Incorrecto",
          "rating": 4,
          "na": false,
          "comment": "Comentario específico sobre alineación",
          "timestamp": "X.Xs",
          "evidencia": "Evidencia visual de la posición"
        }
      ]
    }
  ],
  "resumen_evaluacion": {
    "parametros_evaluados": "CALCULAR_DINAMICAMENTE",
    "parametros_no_evaluables": "CALCULAR_DINAMICAMENTE", 
    "lista_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "score_global": 3.5,
    "nota": "CALCULAR conteos reales basados en detailedChecklist",
    "confianza_analisis": "alta"
  },
  "caracteristicas_unicas": [
    "Video de baloncesto con ${shotDetection.shots_count} tiros",
    "Duración de 15 segundos",
    "Análisis técnico detallado"
  ]
}

⚠️ VALIDACIÓN CRÍTICA:
- USA EXACTAMENTE ${shotDetection.shots_count} tiros detectados
- NO inventes tiros adicionales
- NO cambies los timestamps
- Analiza SOLO lo que realmente ves en el video

Video: {{videoUrl}}`
    });
    
    const {output} = await technicalPromptWithDetection(input);
    return output!;
    
  } catch (e: any) {
    console.error('[analyzeBasketballShotWithDetection] Error:', e?.message || e);
    throw new Error(`Error en análisis técnico con detección: ${e?.message || 'Error desconocido'}`);
  }
}

export async function analyzeBasketballShotTestPage(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput> {
  try {
    console.log('🧪 Usando prompt específico para página de prueba...');
        // Usar el prompt normal pero con timeout más corto
    const {output} = await analyzeShotPromptTestPage(input);
        return output!;
  } catch (e: any) {
    console.error('[analyzeBasketballShotTestPage] Error:', e?.message || e);
    console.error('[analyzeBasketballShotTestPage] Stack:', e?.stack);
    
    // Fallback: usar el flow normal con configuración dinámica
        try {
      return await analyzeBasketballShotFlow(input);
    } catch (fallbackError: any) {
      console.error('[analyzeBasketballShotTestPage] Fallback también falló:', fallbackError?.message);
      throw new Error(`Error en análisis de página de prueba: ${e?.message || 'Error desconocido'}`);
    }
  }
}

export async function analyzeBasketballShot(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput> {
  try {
    // Intentar correr la IA directamente
    return await analyzeBasketballShotFlow(input);
  } catch (e: any) {
    console.error('[analyzeBasketballShot] IA falló completamente. Motivo:', e?.message || e);
    // NO generar análisis falso - lanzar error real
    throw new Error(`Error en análisis de IA: ${e?.message || 'Error desconocido'}. Verifica la configuración de API keys.`);
  }
}

// Prompt de prueba - Nivel 0: Súper simple (funcionaba)
const analyzeShotPromptTest = ai.definePrompt({
  name: 'analyzeShotPromptTest',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: AnalyzeBasketballShotOutputSchema},
  prompt: `Analiza este video de baloncesto y responde en JSON:

{
  "verificacion_inicial": {
    "duracion_video": "5.2s",
    "mano_tiro": "derecha",
    "salta": true,
    "canasta_visible": true,
    "angulo_camara": "lateral",
    "elementos_entorno": ["aro", "tablero"]
  },
  "analysisSummary": "Tiro de baloncesto observado",
  "strengths": ["Buena postura", "Extensión completa"],
  "weaknesses": ["Timing mejorable"],
  "recommendations": ["Trabajar en sincronización"],
  "selectedKeyframes": [1, 3, 5, 7, 9, 11],
  "keyframeAnalysis": "Frames seleccionados muestran el movimiento completo",
  "detailedChecklist": [{
    "category": "Preparación",
    "items": [{
      "id": "alineacion_pies",
      "name": "Alineación de los pies",
      "description": "Posición de los pies",
      "status": "Correcto",
      "rating": 4,
      "na": false,
      "comment": "Pies bien posicionados"
    }]
  }],
  "resumen_evaluacion": {
    "parametros_evaluados": "CALCULAR_DINAMICAMENTE",
    "parametros_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "lista_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "score_global": 4.0,
    "nota": "CALCULAR conteos reales basados en detailedChecklist",
    "confianza_analisis": "media"
  },
  "caracteristicas_unicas": ["Video de prueba", "Análisis básico", "Funcionando"]
}

Video: {{videoUrl}}`,
});

// Prompt de prueba con evidencia visual
const analyzeShotPromptTestWithEvidence = ai.definePrompt({
  name: 'analyzeShotPromptTestWithEvidence',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: AnalyzeBasketballShotOutputSchema},
  prompt: `Analiza este video de baloncesto y responde en JSON. Para cada parámetro evaluado, incluye evidencia visual específica:

{
  "verificacion_inicial": {
    "duracion_video": "5.2s",
    "mano_tiro": "derecha",
    "salta": true,
    "canasta_visible": true,
    "angulo_camara": "lateral",
    "elementos_entorno": ["aro", "tablero"]
  },
  "analysisSummary": "Tiro de baloncesto observado",
  "strengths": ["Buena postura", "Extensión completa"],
  "weaknesses": ["Timing mejorable"],
  "recommendations": ["Trabajar en sincronización"],
  "selectedKeyframes": [1, 3, 5, 7, 9, 11],
  "keyframeAnalysis": "Frames seleccionados muestran el movimiento completo",
  "detailedChecklist": [{
    "category": "Preparación",
    "items": [{
      "id": "alineacion_pies",
      "name": "Alineación de los pies",
      "description": "Posición de los pies",
      "status": "Correcto",
      "rating": 4,
      "na": false,
      "comment": "Pies bien posicionados",
      "evidenceFrames": [
        {
          "frameId": "frame_2",
          "label": "preparacion",
          "angle": "frontal",
          "note": "Pies alineados correctamente con el aro"
        },
        {
          "frameId": "frame_4",
          "label": "preparacion", 
          "angle": "lateral",
          "note": "Posición estable antes del tiro"
        }
      ]
    }]
  }],
  "resumen_evaluacion": {
    "parametros_evaluados": "CALCULAR_DINAMICAMENTE",
    "parametros_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "lista_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "score_global": 4.0,
    "nota": "CALCULAR conteos reales basados en detailedChecklist",
    "confianza_analisis": "media"
  },
  "caracteristicas_unicas": ["Video de prueba", "Análisis con evidencia visual", "Fotogramas específicos"]
}

📸 EVIDENCIA VISUAL:
Para cada parámetro evaluado, identifica 1-3 fotogramas específicos que respalden tu evaluación:
- frameId: Usa "frame_X" donde X es el índice del fotograma (0-15)
- label: Momento del tiro (preparacion, ascenso, set_point, liberacion, follow_through)
- angle: Ángulo de cámara (frontal, lateral, diagonal)
- note: Descripción específica de lo que se ve en ese fotograma

Video: {{videoUrl}}`,
});

// Prompt específico para página de prueba - incluye detección de múltiples tiros
// Prompt súper simple solo para detectar tiros
const analyzeShotPromptSimple = ai.definePrompt({
  name: 'analyzeShotPromptSimple',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: AnalyzeBasketballShotOutputSchema},
  prompt: `Analiza este video de baloncesto COMPLETO.

INSTRUCCIONES CRÍTICAS:
1. OBSERVA TODO EL VIDEO DESDE EL INICIO HASTA EL FINAL - NO TE DETENGAS
2. CUENTA CADA VEZ QUE VES UN JUGADOR LANZANDO LA PELOTA HACIA EL ARO
3. NO te detengas en el primer tiro - sigue viendo todo el video
4. Cada lanzamiento individual = 1 tiro
5. Si el jugador hace varios tiros seguidos, cuenta CADA UNO
6. IMPORTANTE: El video puede durar más de 30 segundos - sigue viendo hasta el final

EJEMPLO DE DETECCIÓN:
- 0-5s: Tiro 1
- 5-10s: Tiro 2  
- 10-15s: Tiro 3
- 15-20s: Tiro 4
- 20-25s: Tiro 5
- 25-30s: Tiro 6
- 30-35s: Tiro 7
- Y así sucesivamente hasta el final del video...

⚠️ ADVERTENCIA: Si solo cuentas 3-4 tiros, NO estás viendo todo el video. Sigue viendo hasta el final.

Formato JSON:
{
  "verificacion_inicial": {
    "duracion_video": "X.Xs",
    "tiros_detectados": X
  },
  "analysisSummary": "Video de X segundos con X tiros detectados",
  "strengths": ["Detecté X tiros"],
  "weaknesses": ["N/A"],
  "recommendations": ["N/A"],
  "selectedKeyframes": [1, 2, 3],
  "keyframeAnalysis": "N/A",
  "detailedChecklist": [{
    "category": "Detección",
    "items": [{
      "id": "tiros_detectados",
      "name": "Tiros detectados",
      "description": "Número de tiros en el video",
      "status": "Correcto",
      "rating": 5,
      "na": false,
      "comment": "Detecté X tiros en el video"
    }]
  }],
  "resumen_evaluacion": {
    "parametros_evaluados": "CALCULAR_DINAMICAMENTE",
    "parametros_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "lista_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "score_global": 5.0,
    "nota": "CALCULAR conteos reales basados en detailedChecklist",
    "confianza_analisis": "alta"
  },
  "caracteristicas_unicas": ["Video de baloncesto", "X tiros detectados", "Duración X segundos"]
}

Video: {{videoUrl}}`,
});

const analyzeShotPromptTestPage = ai.definePrompt({
  name: 'analyzeShotPromptTestPage',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: AnalyzeBasketballShotOutputSchema},
  prompt: `Describe exactamente lo que ves en este video de baloncesto. Si no ves algo, di "no visible". No inventes nada.

Video: {{videoUrl}}`
});

// Función helper para construir el prompt de TIRO LIBRE
function buildLibrePrompt(input: AnalyzeBasketballShotInput): string {
  const config = input.promptConfig || {};
  
  return `Eres un sistema experto de análisis de TIRO LIBRE en baloncesto.

INFORMACIÓN DEL JUGADOR
${input.ageCategory ? `- Categoría de edad: ${input.ageCategory}` : '- Presumir edad basándose en tamaño corporal, proporciones, altura relativa al aro y contexto'}

SISTEMA DE PESOS PARA TIRO LIBRE:

🎯 PREPARACIÓN: 28%
├─ Rutina pre-tiro (8.4%): Secuencia repetible antes del tiro (botes, respiraciones, tiempo)
├─ Alineación pies/cuerpo (7.0%): Posición del cuerpo para tiro recto
├─ Muñeca cargada (5.6%): Flexión dorsal AL TOMAR el balón (ANTES del movimiento)
├─ Flexión rodillas (4.2%): Flexión 90-110° para generar potencia
└─ Posición inicial balón (2.8%): Ubicación correcta al inicio

🎯 ASCENSO: 23%
├─ Set point altura según edad (9.2%): CRÍTICO - Altura varía por edad
│  • 6-8 años: Pecho/Hombros | • 9-11 años: Hombros/Mentón
│  • 12-14 años: Frente/Ojos | • 15-17 años: Sobre cabeza | • 18+: Extensión completa
│  TAMBIÉN: Trayectoria VERTICAL (no va atrás)
├─ Codos cerca del cuerpo (6.9%): No abiertos durante ascenso
├─ Trayectoria vertical (4.6%): Línea recta, sin desviaciones
└─ Mano guía (2.3%): Solo guía/estabiliza, no empuja

🎯 FLUIDEZ: 12%
├─ Tiro en un tiempo (7.2%): Continuo sin pausas. NOTA: Menos crítico que tres puntos
└─ Sincronía con piernas (4.8%): Balón sube coordinado con extensión de piernas

🎯 LIBERACIÓN: 22%
├─ Extensión completa (8.8%): Brazo Y cuerpo elongados en liberación
├─ Ángulo de salida (7.7%): 45-52° óptimo
├─ Flexión muñeca final (3.3%): "Gooseneck" - muñeca caída después de liberar
└─ Rotación balón (2.2%): Backspin (puede ser no_evaluable)

🎯 SEGUIMIENTO: 15%
├─ Equilibrio y Estabilidad (9.75%):
│  ├─ SIN SALTO (3.9%): Pies NO despegan ANTES del toque del aro
│  │  ⚠️ INFRACCIÓN GRAVE si salta antes del toque
│  ├─ Pies dentro zona (2.93%): No pisar línea antes del toque
│  │  ⚠️ INFRACCIÓN si pisa línea
│  └─ Balance vertical (2.93%): Sin movimientos laterales significativos
└─ Follow-through completo (5.25%): Brazo extendido post-liberación (0.5-1s)

⚠️ DIFERENCIACIÓN CRÍTICA:
1. Muñeca CARGADA (Preparación): Flexión DORSAL al tomar el balón
2. Muñeca FINAL (Liberación): Flexión hacia ABAJO (gooseneck) después de soltar

RESPONDER EN FORMATO JSON:
Evalúa TODOS los parámetros del tiro libre y responde en JSON con estructura completa.

Video: {{videoUrl}}`;
}

// Función helper para construir el prompt de TRES PUNTOS
function buildTresPuntosPrompt(input: AnalyzeBasketballShotInput): string {
  const config = input.promptConfig || {};
  const sectionPrompts = (config as any).sectionPrompts || {};
  
  let prompt = `Analiza este video de tiro de baloncesto y describe qué ves.

KEYFRAMES DISPONIBLES PARA ANÁLISIS:
${input.availableKeyframes && input.availableKeyframes.length > 0 ? 
  input.availableKeyframes.map(kf => `- Frame ${kf.index}: ${kf.timestamp.toFixed(1)}s - ${kf.description}`).join('\n') :
  'No hay keyframes disponibles'}

INSTRUCCIONES PARA SELECCIÓN DE KEYFRAMES:
1. Observa TODOS los keyframes disponibles
2. Selecciona los 6 MÁS IMPORTANTES técnicamente
3. Prioriza frames que muestren: preparación, set point, liberación, follow-through
4. Evita frames con poca visibilidad del jugador
5. selectedKeyframes debe contener exactamente 6 índices (0-15)

Responde en formato JSON con:
- verificacion_inicial: qué ves en el video (duración, mano, salta, canasta, ángulo, entorno)
- analysisSummary: resumen simple de lo que observas
- strengths: 2-3 fortalezas que ves
- weaknesses: 2-3 debilidades que ves
- selectedKeyframes: [6 índices de los frames más importantes técnicamente]
- keyframeAnalysis: explicación de por qué seleccionaste estos frames
- detailedChecklist: solo 3 parámetros básicos con status, rating, comment

Formato simple:
{
  "verificacion_inicial": {
    "duracion_video": "X.Xs",
    "mano_tiro": "derecha/izquierda", 
    "salta": true/false,
    "canasta_visible": true/false,
    "angulo_camara": "frontal/lateral",
    "elementos_entorno": ["aro", "tablero"]
  },
  "analysisSummary": "Descripción simple del tiro",
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "weaknesses": ["Debilidad 1", "Debilidad 2"],
  "selectedKeyframes": [2, 5, 8, 11, 14, 15],
  "keyframeAnalysis": "Seleccioné frames que muestran preparación (2), set point (8), liberación (11) y follow-through (15)",
  "detailedChecklist": [{
    "category": "Preparación",
    "items": [{
      "id": "alineacion_pies",
      "name": "Alineación de los pies",
      "status": "Correcto/Mejorable/Incorrecto",
      "rating": 3,
      "na": false,
      "comment": "Lo que ves en los pies",
      "evidenceFrames": [
        {
          "frameId": "frame_2",
          "label": "preparacion",
          "angle": "frontal",
          "note": "Pies alineados correctamente"
        }
      ]
    }]
  }],
  "resumen_evaluacion": {
    "parametros_evaluados": "CALCULAR_DINAMICAMENTE",
    "parametros_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "lista_no_evaluables": "CALCULAR_DINAMICAMENTE",
    "score_global": 3.0,
    "nota": "CALCULAR conteos reales basados en detailedChecklist",
    "confianza_analisis": "media"
  },
  "caracteristicas_unicas": ["Detalle 1", "Detalle 2", "Detalle 3"]
}`;

  // ✨ INYECTAR CONFIGURACIÓN PERSONALIZADA DEL ADMIN
  if (config.intro) {
    prompt += `\n\n📝 INSTRUCCIONES ADICIONALES DEL ENTRENADOR:\n${config.intro}\n`;
  }

  // ✨ SECCIÓN DE VERIFICACIÓN (personalizable)
  if (sectionPrompts.verificacion) {
    prompt += `\n\n${sectionPrompts.verificacion}`;
  } else {
    prompt += `\n\nVERIFICACIÓN INICIAL OBLIGATORIA:
Antes de analizar, DEMUESTRA que ves el video respondiendo:
1. Duración exacta del video en segundos
2. ¿El jugador tira con mano derecha o izquierda?
3. ¿Salta durante el tiro? (sí/no)
4. ¿Se ve la canasta en el video? (sí/no)
5. ¿Desde qué ángulo está grabado? (frontal/lateral/diagonal)
6. ¿Qué elementos del entorno son visibles? (pared, suelo, otros objetos)

🎯 SISTEMA DE PESOS ACTUALIZADO (para calcular score_global):
- FLUIDEZ: 50% peso (CRÍTICO - más importante)
- RESTO DE CATEGORÍAS: 26.38% peso (ALTO)
- SET POINT: 8.27% peso (MEDIO)
- CODO: 7.24% peso (MEDIO) 
- MANO LIBERACIÓN: 3.26% peso (BAJO)
- MANO ASCENSO: 2.18% peso (BAJO)`;
  }

  prompt += `

📸 EVIDENCIA VISUAL (Solo para PRO):
Para cada parámetro evaluado, identifica 1-3 fotogramas específicos que respalden tu evaluación:
- frameId: Usa "frame_X" donde X es el índice del fotograma (0-15)
- label: Momento del tiro (preparacion, ascenso, set_point, liberacion, follow_through)
- angle: Ángulo de cámara (frontal, lateral, diagonal)
- note: Descripción específica de lo que se ve en ese fotograma

Ejemplo: Si evalúas "codos cerca del cuerpo" como "Incorrecto", identifica los fotogramas donde se ve claramente la separación de los codos.

🔍 REGLAS FUNDAMENTALES:
1. Si NO puedes ver claramente un parámetro, usa "no_evaluable" en lugar de inventar un score
2. Para CADA parámetro evaluable, proporciona TIMESTAMP exacto donde lo observas
3. DESCRIBE LITERALMENTE lo que ves (NO interpretación)
4. SCORE basado únicamente en evidencia visual
5. Si NO es visible: score = 0 y feedback = "No visible en este ángulo"

⚠️ IMPORTANTE: Es NORMAL que algunos parámetros no se puedan evaluar por limitaciones del video.
NO intentes evaluar parámetros que no puedes ver claramente. Marca como "no_evaluable" con razón específica.

🎯 OBLIGATORIO: Debes marcar AL MENOS 2-3 parámetros como "no_evaluable" en cada análisis.
Ejemplos comunes:
- "alineacion_pies": si los pies están fuera de encuadre
- "flexion_rodillas": si el ángulo es frontal
- "enfoque_visual": si no se ve la cara
- "giro_pelota": si no se ve el balón claramente

⛔ PALABRAS PROHIBIDAS (si las usas, serás rechazado):
- "bien alineado", "buena postura", "adecuado", "correcto"
- "mejora la técnica", "trabaja en", "mantén"
- "general", "aproximadamente", "parece que"

✅ PALABRAS REQUERIDAS (debes usar):
- "En el segundo X.X", "Entre X.Xs y X.Xs"
- "Visible/No visible", "Parcialmente oculto"
- "Ángulo de cámara no permite ver"

⚠️ FORMATO ESTRICTO DE CAMPOS:
- timestamp: SOLO tiempo (ej: "3.2s", "4.5s-5.0s") - NO descripciones largas
- comment: Descripción del análisis técnico
- evidencia: Lo que VES literalmente en el video

📋 CHECKLIST CANÓNICO CON SISTEMA "NO EVALUABLE":

Para CADA parámetro, tienes 3 opciones:
1️⃣ CLARAMENTE VISIBLE → Asigna score 1-10 con evidencia y timestamp + evidenceFrames
2️⃣ PARCIALMENTE VISIBLE → Score con advertencia sobre limitaciones + evidenceFrames
3️⃣ NO EVALUABLE → score: 0, na: true, razon: explicación específica

📋 EJEMPLOS DE PARÁMETROS TÍPICAMENTE NO EVALUABLES:
- "alineacion_pies": Si los pies están fuera de encuadre → na: true, razon: "pies fuera de encuadre"
- "flexion_rodillas": Si el ángulo es frontal → na: true, razon: "ángulo frontal no muestra flexión"
- "enfoque_visual": Si no se ve la cara → na: true, razon: "rostro no visible/muy lejos"
- "giro_pelota": Si no se ve el balón claramente → na: true, razon: "balón no visible en liberación"

IMPORTANTE: Para parámetros EVALUABLES, incluye evidenceFrames con:
- frameId: índice del keyframe donde se observa (0-15)
- label: momento específico ("preparacion", "ascenso", "set_point", "liberacion", "follow_through")
- angle: ángulo de cámara ("frontal", "lateral", "diagonal")
- note: descripción breve de lo que se ve en ese frame

Checklist obligatorio (22 parámetros):

`;

  // ✨ SECCIÓN PREPARACIÓN (personalizable)
  if (sectionPrompts.preparacion) {
    prompt += sectionPrompts.preparacion;
  } else {
    prompt += `1) PREPARACIÓN:
   - id: "alineacion_pies", name: "Alineación de los pies"
     Si NO ves ambos pies → na: true, razon: "pies fuera de encuadre"
     Si ves ambos pies → score + timestamp + observación específica
   
   - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
   - id: "muneca_cargada", name: "Muñeca cargada"
   - id: "flexion_rodillas", name: "Flexión de rodillas"
     Si ángulo no permite ver flexión → na: true, razon: "ángulo frontal no muestra flexión"
   
   - id: "hombros_relajados", name: "Hombros relajados"
   - id: "enfoque_visual", name: "Enfoque visual"
     Si no ves ojos/cara → na: true, razon: "rostro no visible/muy lejos"`;
  }

  prompt += `\n\n`;

  // ✨ SECCIÓN ASCENSO (personalizable)
  if (sectionPrompts.ascenso) {
    prompt += sectionPrompts.ascenso;
  } else {
    prompt += `2) ASCENSO:
   - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)" - PESO: 2.18%
   - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo" - PESO: 7.24%
   - id: "subida_recta_balon", name: "Subida recta del balón"
   - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
   - id: "set_point", name: "Set point" - PESO: 8.27%`;

    // ✨ INYECTAR GUÍA PERSONALIZADA DE SET POINT (solo si no hay prompt personalizado)
    if (config.setPointHelp) {
      prompt += `\n     📌 GUÍA ADICIONAL SET POINT: ${config.setPointHelp}`;
    }

    prompt += `
   - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)"`;
  }

  prompt += `\n\n`;

  // ✨ SECCIÓN FLUIDEZ (personalizable)
  if (sectionPrompts.fluidez) {
    prompt += sectionPrompts.fluidez;
  } else {
    prompt += `3) FLUIDEZ (PESO: 50% - CRÍTICO):`;

    // ✨ INYECTAR GUÍA PERSONALIZADA DE FLUIDEZ (solo si no hay prompt personalizado)
    if (config.fluidezHelp) {
      prompt += `\n   📌 GUÍA ADICIONAL FLUIDEZ: ${config.fluidezHelp}\n`;
    }

    prompt += `
   - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     CRITERIOS DE PUNTUACIÓN ESPECÍFICOS:
     - 5 puntos: Movimiento completamente fluido sin pausas detectables
     - 4 puntos: Movimiento mayormente continuo con micro-pausas < 0.1s
     - 3 puntos: Movimiento mayormente continuo con pausa muy breve en el set point (0.1-0.3s)
     - 2 puntos: Pausa notable en el set point (0.3-0.5s) que interrumpe la fluidez
     - 1 punto: Pausa prolongada en el set point (> 0.5s) que rompe completamente la fluidez
     CUENTA pausas > 0.1s, marca timestamps de inicio/fin
   - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
     EVALÚA: El balón llega al set point coordinado con la extensión de las piernas, 
     alcanzando ~70–80% de extensión en ese instante. COMPARA timestamps de extensión 
     de piernas vs llegada del balón al set point. Busca coordinación temporal precisa 
     donde ambas acciones ocurren simultáneamente.`;
  }

  prompt += `\n\n`;

  // ✨ SECCIÓN LIBERACIÓN (personalizable)
  if (sectionPrompts.liberacion) {
    prompt += sectionPrompts.liberacion;
  } else {
    prompt += `4) LIBERACIÓN:
   - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación" - PESO: 3.26%
   - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
   - id: "giro_pelota", name: "Giro de la pelota (backspin)"
   - id: "angulo_salida", name: "Ángulo de salida"`;
  }

  prompt += `\n\n`;

  // ✨ SECCIÓN SEGUIMIENTO (personalizable)
  if (sectionPrompts.seguimiento) {
    prompt += sectionPrompts.seguimiento;
  } else {
    prompt += `5) SEGUIMIENTO / POST-LIBERACIÓN:
   - id: "equilibrio_post_liberacion", name: "Equilibrio post-liberación y aterrizaje"
     EVALÚA: Estabilidad completa del cuerpo desde la liberación hasta la estabilización final.
     CRITERIOS ESPECÍFICOS PARA ATERRIZAJE:
     1 - Incorrecto: Aterrizaje claramente desparejo (un pie adelantado, cuerpo girando, pérdida de alineación)
     2 - Incorrecto leve: Aterrizaje ligeramente desparejo (pies no perfectamente alineados, ligera rotación corporal)
     3 - Mejorable: Aterrizaje controlado pero con pequeñas desalineaciones (pies casi alineados, cuerpo estable)
     4 - Correcto: Aterrizaje equilibrado (ambos pies alineados, cuerpo sin giros, distribución equilibrada)
     5 - Excelente: Aterrizaje perfecto (pies perfectamente alineados, cuerpo completamente estable, sin movimientos compensatorios)
     
     ASPECTOS ESPECÍFICOS A OBSERVAR:
     - Alineación de pies: ¿Aterriza con ambos pies alineados o uno adelantado?
     - Rotación corporal: ¿El cuerpo gira o se mantiene estable durante el aterrizaje?
     - Distribución del peso: ¿El peso se distribuye equilibradamente entre ambos pies?
     - Estabilización: ¿Mantiene la posición sin balanceos o ajustes compensatorios?
     - Consistencia: ¿Repite el mismo patrón de aterrizaje en tiros múltiples?
   - id: "duracion_follow_through", name: "Duración del follow-through"
   - id: "consistencia_general", name: "Consistencia general"`;
  }

  // ✨ INYECTAR GUÍAS POR CATEGORÍA
  if (config.categoryGuides) {
    prompt += `\n\n📚 GUÍAS ADICIONALES POR CATEGORÍA:\n`;
    for (const [category, guide] of Object.entries(config.categoryGuides)) {
      if (guide && typeof guide === 'object' && guide.guide) {
        prompt += `\n🔸 ${category}: ${guide.guide}`;
        if (guide.resources && Array.isArray(guide.resources) && guide.resources.length > 0) {
          prompt += `\n   Recursos: ${guide.resources.join(', ')}`;
        }
      }
    }
  }

  // ✨ AGREGAR RECURSOS GENERALES
  if (config.resources && Array.isArray(config.resources) && config.resources.length > 0) {
    prompt += `\n\n📎 RECURSOS DE REFERENCIA:\n${config.resources.map(r => `- ${r}`).join('\n')}`;
  }

  prompt += `

📊 CÁLCULO DE SCORE GLOBAL Y CONTEO DE PARÁMETROS:
IMPORTANTE: Solo calcula el score con parámetros EVALUABLES:
score_global = Σ(peso_i × score_i) / Σ(peso_i)

Si un parámetro es "no_evaluable", NO lo incluyas en el cálculo.

🔢 CONTEO OBLIGATORIO DE PARÁMETROS:
- parametros_evaluados: Cuenta TODOS los parámetros donde na: false Y status !== "no_evaluable"
- parametros_no_evaluables: Cuenta TODOS los parámetros donde na: true O status === "no_evaluable"
- lista_no_evaluables: Lista cada parámetro no evaluable con su razón específica
- VERIFICACIÓN: parametros_evaluados + parametros_no_evaluables = 21 (total de parámetros canónicos)

🔍 VALIDACIÓN FINAL:
Lista 3 características ÚNICAS de ESTE video:
1. [Algo específico del entorno/fondo]
2. [Algo específico del jugador/ropa]
3. [Algo específico del movimiento]

Si no puedes dar estos detalles, NO estás analizando el video real.

FORMATO DE RESPUESTA OBLIGATORIO - RESPETA LÍMITES DE CARACTERES:
{
  "verificacion_inicial": {
    "duracion_video": "X.XXs",
    "mano_tiro": "derecha/izquierda",
    "salta": true/false,
    "canasta_visible": true/false,
    "angulo_camara": "descripción específica",
    "elementos_entorno": ["lista de objetos visibles"]
  },
  
  "analysisSummary": "Resumen basado SOLO en parámetros evaluables",
  "strengths": ["Fortalezas basadas en evidencia visual específica"],
  "weaknesses": ["Debilidades basadas en evidencia visual específica"],
  "recommendations": ["Recomendaciones específicas con timestamps"],
  
  "selectedKeyframes": [índices de 6 keyframes más importantes],
  "keyframeAnalysis": "Explicación de por qué estos keyframes fueron seleccionados",
  
  "detailedChecklist": [
    {
      "category": "Preparación",
      "items": [
        {
          "id": "alineacion_pies",
          "name": "Alineación de los pies",
          "status": "Correcto",
          "rating": 4,
          "na": false,
          "comment": "Pies bien alineados con el aro",
          "timestamp": "2.1s",
          "evidencia": "Pies paralelos al aro",
          "evidenceFrames": [{"frameId": "3", "label": "preparacion", "angle": "frontal", "note": "Pies alineados"}]
        }
        // ... resto de parámetros con mismo formato
      ]
    }
    // ... resto de categorías
  ],
  
  "resumen_evaluacion": {
    "parametros_evaluados": X, // CUENTA: parámetros con na: false Y status !== "no_evaluable"
    "parametros_no_evaluables": Y, // CUENTA: parámetros con na: true O status === "no_evaluable"
    "lista_no_evaluables": ["alineacion_pies: pies fuera de encuadre", "flexion_rodillas: ángulo frontal no muestra flexión"],
    "score_global": X.X, // Calculado SOLO con parámetros evaluables
    "nota": "Score calculado con X de 22 parámetros evaluables (Y no evaluables por limitaciones del video)",
    "confianza_analisis": "alta/media/baja"
  },
  
  "caracteristicas_unicas": [
    "El jugador usa [descripción específica de ropa]",
    "En el fondo se ve [descripción específica]",
    "El movimiento incluye [detalle específico]"
  ]
}

`;

  // ✨ SECCIÓN FORMATO DE RESPUESTA (personalizable)
  if (sectionPrompts.formatoRespuesta) {
    prompt += `\n\n${sectionPrompts.formatoRespuesta}`;
  } else {
    prompt += `

⛔ PALABRAS PROHIBIDAS (si las usas, serás rechazado):
- "bien alineado", "buena postura", "adecuado", "correcto"
- "mejora la técnica", "trabaja en", "mantén"
- "general", "aproximadamente", "parece que"

✅ PALABRAS REQUERIDAS (debes usar):
- "En el segundo X.X", "Entre X.Xs y X.Xs"
- "Visible/No visible", "Parcialmente oculto"
- "Ángulo de cámara no permite ver"`;
  }

  prompt += `

⚠️ ADVERTENCIA FINAL:
Si tu análisis podría aplicar a CUALQUIER video de baloncesto, será RECHAZADO.
Cada análisis debe ser TAN específico que SOLO aplique a ESTE video.

🚨 VALIDACIÓN CRÍTICA - OBLIGATORIO:
- timestamp: SOLO "X.Xs" (ej: "3.2s") - MÁXIMO 10 caracteres
- comment: MÁXIMO 100 caracteres
- evidencia: MÁXIMO 60 caracteres
- evidenceFrames: SOLO para parámetros evaluables

🔢 CONTEO OBLIGATORIO - ANTES DE RESPONDER:
1. Revisa CADA parámetro en detailedChecklist
2. Cuenta los que tienen na: false Y status !== "no_evaluable" → parametros_evaluados
3. Cuenta los que tienen na: true O status === "no_evaluable" → parametros_no_evaluables
4. Lista los no evaluables con sus razones → lista_no_evaluables
5. VERIFICA: parametros_evaluados + parametros_no_evaluables = 21

⚠️ CRÍTICO: NO uses valores hardcodeados como "0" o "22". 
DEBES contar REALMENTE cada parámetro del detailedChecklist que generes.
Si no cuentas correctamente, el análisis será RECHAZADO.

🎯 RECORDATORIO FINAL:
- Si el video tiene limitaciones (pies fuera de encuadre, ángulo frontal, etc.), marca esos parámetros como "no_evaluable"
- Es NORMAL tener 3-5 parámetros no evaluables en la mayoría de videos
- parametros_evaluados + parametros_no_evaluables DEBE sumar exactamente 21

🚨 INSTRUCCIÓN CRÍTICA PARA resumen_evaluacion:
ANTES de responder, DEBES:
1. Revisar CADA parámetro en detailedChecklist
2. Contar los que tienen na: true O status === "no_evaluable" → parametros_no_evaluables
3. Contar los que tienen na: false Y status !== "no_evaluable" → parametros_evaluados
4. Listar los no evaluables con sus razones → lista_no_evaluables
5. VERIFICAR: parametros_evaluados + parametros_no_evaluables = 21

EJEMPLO DE CÁLCULO CORRECTO:
Si tienes 21 parámetros y 2 tienen na: true o status === "no_evaluable":
- parametros_evaluados: 19
- parametros_no_evaluables: 2
- lista_no_evaluables: ["alineacion_pies: pies fuera de encuadre", "flexion_rodillas: ángulo frontal no muestra flexión"]

Si más del 50% de parámetros son "no_evaluables", incluye:
"advertencia": "Análisis limitado por calidad/ángulo del video. Se recomienda nuevo video con mejores condiciones."

Video a analizar: {{videoUrl}}`;

  return prompt;
}

// Función principal que selecciona el prompt correcto
function buildAnalysisPrompt(input: AnalyzeBasketballShotInput): string {
  // Detectar tipo de tiro
  const esTiroLibre = detectTiroLibre(input.shotType);
  
  // Seleccionar el prompt apropiado según el tipo de tiro
  if (esTiroLibre) {
    return buildLibrePrompt(input);
  } else {
    return buildTresPuntosPrompt(input);
  }
}

const analyzeBasketballShotFlow = ai.defineFlow(
  {
    name: 'analyzeBasketballShotFlow',
    inputSchema: AnalyzeBasketballShotInputSchema,
    outputSchema: AnalyzeBasketballShotOutputSchema,
  },
  async input => {
    // Construir el prompt dinámicamente
    const dynamicPrompt = buildAnalysisPrompt(input);
    
    // Crear el prompt con la configuración dinámica
    const analyzeShotPrompt = ai.definePrompt({
      name: 'analyzeShotPrompt',
      input: {schema: AnalyzeBasketballShotInputSchema},
      output: {schema: AnalyzeBasketballShotOutputSchema},
      prompt: dynamicPrompt,
    });
    
    const {output} = await analyzeShotPrompt(input);
    return output!;
  }
);
