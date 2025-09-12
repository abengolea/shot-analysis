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
  // legacy status 3 niveles
  status: z.enum(['Correcto', 'Mejorable', 'Incorrecto']).describe('Evaluation status'),
  // nuevo sistema opcional numérico 1..5
  rating: z.number().int().min(1).max(5).optional().describe('Optional 1..5 rating if available'),
  // ítem especial: Fluidez / Armonía (1..10)
  rating10: z.number().int().min(1).max(10).optional().describe('Optional 1..10 rating for Fluidez/Armonía'),
  na: z.boolean().optional().describe('Mark as not applicable when there is not enough evidence to evaluate'),
  comment: z.string().describe('Brief coach-like comment. If not enough evidence due to missing angles, explicitly say: "No evaluable por falta de ángulo X"'),
});

const ChecklistCategorySchema = z.object({
  category: z.string().describe('Checklist category name, e.g., "Preparación", "Liberación", etc.'),
  items: z.array(ChecklistItemSchema).describe('Items within the category')
});

const AnalyzeBasketballShotOutputSchema = z.object({
  analysisSummary: z.string().describe('A summary of the shot analysis.'),
  strengths: z.array(z.string()).describe('List of strengths in the player\'s shot.'),
  weaknesses: z.array(z.string()).describe('List of weaknesses in the player\'s shot.'),
  recommendations: z.array(z.string()).describe('Personalized recommendations for improvement.'),
  selectedKeyframes: z.array(z.number()).describe('Indexes of the 6 most important keyframes (0-15) that best represent the shot analysis'),
  keyframeAnalysis: z.string().describe('Brief explanation of why these specific keyframes were selected and what they show about the shot technique'),
  detailedChecklist: z.array(ChecklistCategorySchema).describe('Structured checklist evaluation for the shot technique'),
});
export type AnalyzeBasketballShotOutput = z.infer<typeof AnalyzeBasketballShotOutputSchema>;

export async function analyzeBasketballShot(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput> {
  try {
    // Intentar correr la IA directamente; si falla por clave ausente u otro motivo, caemos al básico
    return await analyzeBasketballShotFlow(input);
  } catch (e: any) {
    console.warn('[analyzeBasketballShot] IA falló, usando análisis básico. Motivo:', e?.message || e);
    const selected = Array.isArray(input.availableKeyframes)
      ? input.availableKeyframes.slice(0, 6).map((k) => k.index)
      : [];
    return {
      analysisSummary: 'Análisis básico: no se pudo ejecutar la IA (ver logs del servidor).',
      strengths: [],
      weaknesses: [],
      recommendations: ['Verifica la GEMINI_API_KEY/GOOGLE_API_KEY y vuelve a intentar.'],
      selectedKeyframes: selected,
      keyframeAnalysis: selected.length > 0 ? 'Selección automática de los primeros fotogramas disponibles.' : 'Sin fotogramas disponibles.',
      detailedChecklist: [],
    } as AnalyzeBasketballShotOutput;
  }
}

const analyzeShotPrompt = ai.definePrompt({
  name: 'analyzeShotPrompt',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: AnalyzeBasketballShotOutputSchema},
  prompt: `Analiza este video de lanzamiento de básquet y genera un análisis completo.

IMPORTANTE: NO intentes generar imágenes. Solo analiza el contenido del video y proporciona:

- Resumen del análisis de la técnica
- Fortalezas técnicas identificadas (al menos 3 si hay evidencia)
- Debilidades a mejorar (al menos 3 si hay evidencia)
- Recomendaciones específicas (3-5, accionables)
- Un checklist detallado y estructurado (4–6 categorías, 3–5 ítems por categoría) usando los estados: Correcto | Mejorable | Incorrecto. 
  Si falta evidencia por no contar con ciertos ángulos, NO penalices: marca el ítem con na: true e indica en el comentario: "No evaluable por falta de ángulo <front/back/left/right>".
  IMPORTANTE: Debes devolver EXACTAMENTE estas 5 categorías y sus ítems, en este orden: "Preparación" → "Ascenso" → "Fluidez" → "Liberación" → "Seguimiento / Post-liberación". NO inventes categorías ni ítems y NO cambies los ids. Si un ítem no puede evaluarse, déjalo con na: true y comentario explicando por qué.

  Checklist canónico (Tiro de Tres) — estructura obligatoria:
  1) Preparación
     - id: "alineacion_pies", name: "Alineación de los pies"
     - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
     - id: "muneca_cargada", name: "Muñeca cargada"
     - id: "flexion_rodillas", name: "Flexión de rodillas"
     - id: "hombros_relajados", name: "Hombros relajados"
     - id: "enfoque_visual", name: "Enfoque visual"
  2) Ascenso
     - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)"
     - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo"
     - id: "subida_recta_balon", name: "Subida recta del balón"
     - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
     - id: "set_point", name: "Set point"
     - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)" (en el comentario escribe el tiempo estimado, p. ej. "Tiempo: 0.62s").
  3) Fluidez
     - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
  4) Liberación
     - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación"
     - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
     - id: "giro_pelota", name: "Giro de la pelota (backspin)" (evalúa: gira hacia atrás/adecuado, gira poco/insuficiente, no gira/malo, gira hacia delante/inadecuado)
     - id: "angulo_salida", name: "Ángulo de salida"
  5) Seguimiento / Post-liberación
     - id: "mantenimiento_equilibrio", name: "Mantenimiento del equilibrio"
     - id: "equilibrio_aterrizaje", name: "Equilibrio en el aterrizaje"
     - id: "duracion_follow_through", name: "Duración del follow-through"
     - id: "consistencia_repetitiva", name: "Consistencia repetitiva"
  Devuelve exactamente estas categorías e ítems, con estos ids y names. Para cada ítem incluye: rating (1..5), status (Correcto/Mejorable/Incorrecto), comment (en español, breve y concreto), y na: true cuando falte evidencia (explicándolo en comment). No devuelvas categorías ni ítems extra.

  Notas técnicas clave a reflejar en comentarios:
  - Set point: altura adecuada por edad; mantener continuidad (un solo tiempo); si hay pausa/corte, menciónalo.
  - Tiempo de lanzamiento: reporta el tiempo estimado entre recepción y liberación (en segundos).
  - Backspin: especifica calidad y dirección del giro.
  - Ángulo de salida: indica si está en el rango recomendado según el jugador.

Si existe configuración de prompts de admin, considérela como guía adicional para redactar el análisis:
- Intro adicional: {{promptConfig.intro}}
- Guía de Fluidez/Armonía: {{promptConfig.fluidezHelp}}
- Guía de Set Point: {{promptConfig.setPointHelp}}
- Recursos globales: {{promptConfig.resources}}
- Guías por categoría (si existen): {{promptConfig.categoryGuides}}

Si hay guías por categoría en promptConfig.categoryGuides, úselas para orientar la evaluación y los comentarios de cada categoría del checklist cuando apliquen.

ADEMÁS, selecciona los 6 keyframes más importantes de los disponibles:

{{availableKeyframes}}

Selecciona exactamente 6 keyframes que mejor representen:
1. Posición inicial y preparación
2. Momento de elevación de la pelota
3. Punto de liberación del tiro
4. Seguimiento del movimiento
5. Posición de los pies y estabilidad
6. Posición de los brazos y técnica

Retorna los índices de los 6 keyframes seleccionados y explica brevemente por qué los elegiste.

Adapta el lenguaje según la categoría de edad: {{ageCategory}}.

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
