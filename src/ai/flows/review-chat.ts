'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReviewChatInput = z.object({
  analysisSummary: z.string().optional(),
  detailedChecklist: z.any().optional(),
  message: z.string(),
  attachments: z.array(z.string()).optional(),
  attachmentsMd: z.string().optional(),
});

const ReviewChatOutput = z.object({
  reply: z.string(),
});

const reviewChatPrompt = ai.definePrompt({
  name: 'reviewChatPrompt',
  input: { schema: ReviewChatInput },
  output: { schema: ReviewChatOutput },
  prompt: `Eres un experto en técnica de tiro de básquet.
Dispones del resumen del análisis de IA y su checklist. El usuario (administrador) te plantea dudas u objeciones y puede adjuntar imágenes (descripciones/URLs). Responde en español, breve y concreto, y JUSTIFICA cada afirmación con señales visuales (posición de manos, codo, sincronía, momento aproximado) y sugerencias prácticas.

Si el usuario señala un error plausible, propone cómo ajustar la calificación (1..5) o el comentario del ítem. Indica claramente: "Sugerencia de ajuste: ...".

Contexto — Resumen del análisis:
{{analysisSummary}}

Contexto — Checklist (JSON):
{{detailedChecklist}}

Adjuntos del usuario (si hay):
{{attachmentsMd}}

Mensaje del usuario:
{{message}}

Devuelve sólo el texto de tu respuesta en 'reply'.`,
});

export const reviewChatFlow = ai.defineFlow(
  {
    name: 'reviewChatFlow',
    inputSchema: ReviewChatInput,
    outputSchema: ReviewChatOutput,
  },
  async (input) => {
    const { output } = await reviewChatPrompt(input);
    return output!;
  }
);

