'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RewriteCoachCommentInputSchema = z.object({
  text: z.string().describe('Comentario original del entrenador.'),
});

export type RewriteCoachCommentInput = z.infer<typeof RewriteCoachCommentInputSchema>;

const RewriteCoachCommentOutputSchema = z.object({
  improved: z.string().describe('Comentario reescrito en español.'),
});

export type RewriteCoachCommentOutput = z.infer<typeof RewriteCoachCommentOutputSchema>;

export async function rewriteCoachComment(
  input: RewriteCoachCommentInput
): Promise<RewriteCoachCommentOutput> {
  return rewriteCoachCommentFlow(input);
}

const rewriteCoachCommentPrompt = ai.definePrompt({
  name: 'rewriteCoachCommentPrompt',
  input: { schema: RewriteCoachCommentInputSchema },
  output: { schema: RewriteCoachCommentOutputSchema },
  prompt: `Sos un entrenador de básquet y vas a mejorar la redacción del comentario.

Reglas:
- Mantén el sentido original; no inventes información.
- Tono profesional, claro y alentador.
- 2 a 5 frases, conciso.
- Evita listas, Markdown o emojis.
- Corrige gramática y puntuación.

Comentario original:
{{text}}

Devolvé solo el texto mejorado en 'improved'.`,
});

const rewriteCoachCommentFlow = ai.defineFlow(
  {
    name: 'rewriteCoachCommentFlow',
    inputSchema: RewriteCoachCommentInputSchema,
    outputSchema: RewriteCoachCommentOutputSchema,
  },
  async (input) => {
    const { output } = await rewriteCoachCommentPrompt(input);
    return output!;
  }
);
