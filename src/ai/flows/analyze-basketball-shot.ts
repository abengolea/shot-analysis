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
});
export type AnalyzeBasketballShotInput = z.infer<typeof AnalyzeBasketballShotInputSchema>;

const KeyframeImagesSchema = z.object({
    front: z.array(z.string()).describe('List of base64 encoded keyframe images from the front angle.'),
    back: z.array(z.string()).describe('List of base64 encoded keyframe images from the back angle.'),
    left: z.array(z.string()).describe('List of base64 encoded keyframe images from the left side angle.'),
    right: z.array(z.string()).describe('List of base64 encoded keyframe images from the right side angle.'),
});


const AnalyzeBasketballShotOutputSchema = z.object({
  analysisSummary: z.string().describe('A summary of the shot analysis.'),
  strengths: z.array(z.string()).describe('List of strengths in the player\'s shot.'),
  weaknesses: z.array(z.string()).describe('List of weaknesses in the player\'s shot.'),
  recommendations: z.array(z.string()).describe('Personalized recommendations for improvement.'),
  keyframes: KeyframeImagesSchema.describe('Keyframe images from four different angles.'),
});
export type AnalyzeBasketballShotOutput = z.infer<typeof AnalyzeBasketballShotOutputSchema>;

export async function analyzeBasketballShot(input: AnalyzeBasketballShotInput): Promise<AnalyzeBasketballShotOutput>
{
  return analyzeBasketballShotFlow(input);
}

const analyzeShotPrompt = ai.definePrompt({
  name: 'analyzeShotPrompt',
  input: {schema: AnalyzeBasketballShotInputSchema},
  output: {schema: AnalyzeBasketballShotOutputSchema},
  prompt: `Analisa el lanzamiento de este jugador de básquet a partir de los fotogramas y datos biomecánicos proporcionados.

Indica fortalezas y debilidades técnicas.

Adapta las recomendaciones según su categoría: {{ageCategory}}.

Sé específico en las correcciones, indicando ángulos y tiempos si es posible.

Sugiere entre 2 y 4 ejercicios prácticos para mejorar los errores detectados.

Si el jugador es menor de 12 años, utiliza lenguaje simple y positivo; si es profesional, utiliza terminología técnica avanzada.

Here's the video to analyze: {{videoUrl}}`,
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
