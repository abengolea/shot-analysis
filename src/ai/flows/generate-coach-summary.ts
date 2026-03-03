'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateCoachSummaryInputSchema = z.object({
  analysisSummary: z.string().optional().describe('Resumen del análisis automático (si existe).'),
  detailedChecklist: z.string().optional().describe('Checklist detallado serializado en JSON.'),
  coachFeedback: z.string().optional().describe('Feedback del coach (ratings/comentarios) serializado en JSON.'),
  shotType: z.string().optional().describe('Tipo de tiro (libre/media/tres).'),
});

export type GenerateCoachSummaryInput = z.infer<typeof GenerateCoachSummaryInputSchema>;

const GenerateCoachSummaryOutputSchema = z.object({
  summary: z.string().describe('Resumen breve y claro en español.'),
});

export type GenerateCoachSummaryOutput = z.infer<typeof GenerateCoachSummaryOutputSchema>;

export async function generateCoachSummary(
  input: GenerateCoachSummaryInput
): Promise<GenerateCoachSummaryOutput> {
  return generateCoachSummaryFlow(input);
}

const generateCoachSummaryPrompt = ai.definePrompt({
  name: 'generateCoachSummaryPrompt',
  input: { schema: GenerateCoachSummaryInputSchema },
  output: { schema: GenerateCoachSummaryOutputSchema },
  prompt: `Sos un entrenador de básquet. Redactá un resumen completo en español.

Reglas:
- No inventes información que no esté en los datos.
- Si hay feedback del coach, evitá repetir textualmente lo que dijo la IA.
- Si hay pocas correcciones, empezá con una frase tipo: "En líneas generales estoy de acuerdo con las devoluciones de la IA, pero no concuerdo con estos puntos:".
- Si hay muchas correcciones, enfocá el resumen principalmente en esas correcciones y en las recomendaciones propias.
- Si no hay feedback del coach, basate en el resumen y checklist automático.
- Incluí 2–3 fortalezas y 3–5 mejoras concretas.
- Luego listá explícitamente qué ítems fueron corregidos y por qué.
- Cerrá con próximos pasos accionables.
- Tono profesional, claro y alentador.

Tipo de tiro: {{shotType}}
Resumen IA: {{analysisSummary}}
Checklist (JSON): {{detailedChecklist}}
Feedback coach (JSON): {{coachFeedback}}

Devolvé solo el texto del resumen.`,
});

const generateCoachSummaryFlow = ai.defineFlow(
  {
    name: 'generateCoachSummaryFlow',
    inputSchema: GenerateCoachSummaryInputSchema,
    outputSchema: GenerateCoachSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await generateCoachSummaryPrompt(input);
    return output!;
  }
);
