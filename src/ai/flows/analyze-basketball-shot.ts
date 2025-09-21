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

// Ya no necesitamos este schema porque la IA no generará keyframes
// Los keyframes se extraerán con FFmpeg en el backend


// Checklist schemas
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

const analyzeShotPrompt = ai.definePrompt({
  name: 'analyzeShotPrompt',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: AnalyzeBasketballShotOutputSchema},
  prompt: `🚨 ANÁLISIS FORENSE DE VIDEO - MODO ESTRICTO ANTI-SIMULACIÓN

VERIFICACIÓN INICIAL OBLIGATORIA:
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
- MANO ASCENSO: 2.18% peso (BAJO)

🔍 REGLAS FUNDAMENTALES:
1. Si NO puedes ver claramente un parámetro, usa "no_evaluable" en lugar de inventar un score
2. Para CADA parámetro evaluable, proporciona TIMESTAMP exacto donde lo observas
3. DESCRIBE LITERALMENTE lo que ves (NO interpretación)
4. SCORE basado únicamente en evidencia visual
5. Si NO es visible: score = 0 y feedback = "No visible en este ángulo"

⛔ PALABRAS PROHIBIDAS (si las usas, serás rechazado):
- "bien alineado", "buena postura", "adecuado", "correcto"
- "mejora la técnica", "trabaja en", "mantén"
- "general", "aproximadamente", "parece que"

✅ PALABRAS REQUERIDAS (debes usar):
- "En el segundo X.X", "Entre X.Xs y X.Xs"
- "Visible/No visible", "Parcialmente oculto"
- "Ángulo de cámara no permite ver"

📋 CHECKLIST CANÓNICO CON SISTEMA "NO EVALUABLE":

Para CADA parámetro, tienes 3 opciones:
1️⃣ CLARAMENTE VISIBLE → Asigna score 1-10 con evidencia y timestamp
2️⃣ PARCIALMENTE VISIBLE → Score con advertencia sobre limitaciones
3️⃣ NO EVALUABLE → score: 0, na: true, razon: explicación específica

Checklist obligatorio (22 parámetros):

1) PREPARACIÓN:
   - id: "alineacion_pies", name: "Alineación de los pies"
     Si NO ves ambos pies → na: true, razon: "pies fuera de encuadre"
     Si ves ambos pies → score + timestamp + observación específica
   
   - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
   - id: "muneca_cargada", name: "Muñeca cargada"
   - id: "flexion_rodillas", name: "Flexión de rodillas"
     Si ángulo no permite ver flexión → na: true, razon: "ángulo frontal no muestra flexión"
   
   - id: "hombros_relajados", name: "Hombros relajados"
   - id: "enfoque_visual", name: "Enfoque visual"
     Si no ves ojos/cara → na: true, razon: "rostro no visible/muy lejos"

2) ASCENSO:
   - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)" - PESO: 2.18%
   - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo" - PESO: 7.24%
   - id: "subida_recta_balon", name: "Subida recta del balón"
   - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
   - id: "set_point", name: "Set point" - PESO: 8.27%
   - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)"

3) FLUIDEZ (PESO: 50% - CRÍTICO):
   - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     CUENTA pausas > 0.2s, marca timestamps de inicio/fin
   - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
     COMPARA timestamps de extensión de piernas vs brazos

4) LIBERACIÓN:
   - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación" - PESO: 3.26%
   - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
   - id: "giro_pelota", name: "Giro de la pelota (backspin)"
   - id: "angulo_salida", name: "Ángulo de salida"

5) SEGUIMIENTO / POST-LIBERACIÓN:
   - id: "mantenimiento_equilibrio", name: "Mantenimiento del equilibrio"
   - id: "equilibrio_aterrizaje", name: "Equilibrio en el aterrizaje"
   - id: "duracion_follow_through", name: "Duración del follow-through"
   - id: "consistencia_repetitiva", name: "Consistencia repetitiva"

📊 CÁLCULO DE SCORE GLOBAL:
IMPORTANTE: Solo calcula el score con parámetros EVALUABLES:
score_global = Σ(peso_i × score_i) / Σ(peso_i)

Si un parámetro es "no_evaluable", NO lo incluyas en el cálculo.

🔍 VALIDACIÓN FINAL:
Lista 3 características ÚNICAS de ESTE video:
1. [Algo específico del entorno/fondo]
2. [Algo específico del jugador/ropa]
3. [Algo específico del movimiento]

Si no puedes dar estos detalles, NO estás analizando el video real.

FORMATO DE RESPUESTA OBLIGATORIO:
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
          "status": "Correcto/Mejorable/Incorrecto/no_evaluable",
          "rating": [1-5] o 0 si no_evaluable,
          "na": true/false,
          "comment": "En X.Xs, observo... / No evaluable: pies fuera de encuadre",
          "timestamp": "X.Xs",
          "evidencia": "Descripción literal de lo que VES"
        }
        // ... resto de parámetros con mismo formato
      ]
    }
    // ... resto de categorías
  ],
  
  "resumen_evaluacion": {
    "parametros_evaluados": X,
    "parametros_no_evaluables": Y,
    "lista_no_evaluables": ["parámetro: razón específica"],
    "score_global": X.X,
    "nota": "Score calculado solo con X de 22 parámetros evaluables",
    "confianza_analisis": "alta/media/baja"
  },
  
  "caracteristicas_unicas": [
    "El jugador usa [descripción específica de ropa]",
    "En el fondo se ve [descripción específica]",
    "El movimiento incluye [detalle específico]"
  ]
}

⚠️ ADVERTENCIA FINAL:
Si tu análisis podría aplicar a CUALQUIER video de baloncesto, será RECHAZADO.
Cada análisis debe ser TAN específico que SOLO aplique a ESTE video.

Si más del 50% de parámetros son "no_evaluables", incluye:
"advertencia": "Análisis limitado por calidad/ángulo del video. Se recomienda nuevo video con mejores condiciones."

Video a analizar: {{videoUrl}}`,
});

const analyzeBasketballShotFlow = ai.defineFlow(
  {
    name: 'analyzeBasketballShotFlow',
    inputSchema: AnalyzeBasketballShotInputSchema,
    outputSchema: AnalyzeBasketballShotOutputSchema,
  },
  async input => {
    const {output} = await analyzeShotPrompt(input);
    return output!;
  }
);
