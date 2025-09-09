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
});
export type AnalyzeBasketballShotInput = z.infer<typeof AnalyzeBasketballShotInputSchema>;

// Ya no necesitamos este schema porque la IA no generará keyframes
// Los keyframes se extraerán con FFmpeg en el backend


// Checklist schemas
const ChecklistItemSchema = z.object({
  id: z.string().describe('Stable id for the checklist item (slug-like).'),
  name: z.string().describe('Name of the checklist item'),
  description: z.string().describe('Short description of what is being evaluated'),
  status: z.enum(['Correcto', 'Mejorable', 'Incorrecto']).describe('Evaluation status'),
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

export async function analyzeBasketballShot(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput>
{
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
  if (!hasKey) {
    console.warn('[analyzeBasketballShot] Sin API key; devolviendo análisis básico');
    const selected = Array.isArray(input.availableKeyframes)
      ? input.availableKeyframes.slice(0, 6).map((k) => k.index)
      : [];
    return {
      analysisSummary: 'Análisis básico sin IA: configura la API key para resultados completos.',
      strengths: [],
      weaknesses: [],
      recommendations: ['Configura GEMINI_API_KEY o GOOGLE_API_KEY para activar el análisis completo.'],
      selectedKeyframes: selected,
      keyframeAnalysis: selected.length > 0 ? 'Selección automática de los primeros fotogramas disponibles.' : 'Sin fotogramas disponibles.',
      detailedChecklist: [],
    } as AnalyzeBasketballShotOutput;
  }
  return analyzeBasketballShotFlow(input);
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
  Si falta evidencia por no contar con ciertos ángulos, marca el ítem con el estado más prudente (por ejemplo "Mejorable") e indica en el comentario: "No evaluable por falta de ángulo <front/back/left/right>".

  Debes INCLUIR obligatoriamente estos 3 ítems en el checklist (en una categoría como "Timing y Giro" o similar):
  - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)", description: "Tiempo desde que el jugador toma el balón hasta que lo suelta". En el comentario escribe el tiempo estimado en segundos, por ejemplo: "Tiempo: 0.62s". Si no es medible, indícalo.
  - id: "muneca_cargada", name: "Muñeca cargada antes del ascenso", description: "La muñeca de tiro debe estar flexionada (cargada) antes de iniciar el ascenso de la pelota". Si no está claramente cargada, marca Incorrecto o Mejorable y explica que la muñeca debe estar cargada.
  - id: "giro_pelota", name: "Giro de la pelota (backspin)", description: "El balón debe tener un giro limpio hacia atrás en el aire". Comenta la calidad del backspin (limpio/bajo/irregular). Si no hay evidencia, indícalo.

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
