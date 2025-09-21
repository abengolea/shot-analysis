'use server';

/**
 * @fileOverview Validación de contenido de video para asegurar que sea de baloncesto
 * antes de proceder con el análisis de tiro.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ValidateBasketballContentInputSchema = z.object({
  videoUrl: z.string().describe('URL del video a validar.'),
  shotType: z.string().optional().describe('Tipo de tiro esperado (opcional).'),
});

const ValidateBasketballContentOutputSchema = z.object({
  isBasketballContent: z.boolean().describe('Si el video contiene contenido de baloncesto.'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianza de la validación (0-1).'),
  detectedElements: z.array(z.string()).describe('Elementos de baloncesto detectados en el video.'),
  reason: z.string().describe('Explicación de por qué se considera o no contenido de baloncesto.'),
  recommendation: z.enum(['PROCEED', 'REJECT', 'REVIEW']).describe('Recomendación: continuar, rechazar, o revisar manualmente.'),
});

export type ValidateBasketballContentInput = z.infer<typeof ValidateBasketballContentInputSchema>;
export type ValidateBasketballContentOutput = z.infer<typeof ValidateBasketballContentOutputSchema>;

export async function validateBasketballContent(
  input: ValidateBasketballContentInput
): Promise<ValidateBasketballContentOutput> {
  try {
    return await validateBasketballContentFlow(input);
  } catch (e: any) {
    console.warn('[validateBasketballContent] IA falló, usando validación básica. Motivo:', e?.message || e);
    return {
      isBasketballContent: false,
      confidence: 0.0,
      detectedElements: [],
      reason: 'No se pudo validar el contenido del video. Se requiere revisión manual.',
      recommendation: 'REVIEW'
    };
  }
}

const validateContentPrompt = ai.definePrompt({
  name: 'validateBasketballContentPrompt',
  input: { schema: ValidateBasketballContentInputSchema },
  output: { schema: ValidateBasketballContentOutputSchema },
  prompt: `Eres un experto en análisis de video deportivo. Tu tarea es determinar si un video contiene contenido de baloncesto válido para análisis de técnica de tiro.

CRITERIOS ESTRICTOS PARA CONSIDERAR CONTENIDO VÁLIDO:
- Debe mostrar claramente a una persona ejecutando un tiro de baloncesto
- Debe incluir elementos visuales de baloncesto (canasta, balón, cancha, etc.)
- El movimiento debe ser un tiro (no dribbling, pase, o defensa solamente)
- Debe ser posible evaluar la técnica del tiro desde los ángulos disponibles

ELEMENTOS QUE INDICAN CONTENIDO VÁLIDO:
- Canasta de baloncesto visible
- Balón de baloncesto
- Movimiento de tiro (elevación, seguimiento del brazo)
- Cancha de baloncesto o entorno deportivo
- Persona ejecutando el tiro

ELEMENTOS QUE INDICAN CONTENIDO INVÁLIDO:
- Videos de fiestas, celebraciones, o eventos sociales
- Animales, paisajes, o contenido no deportivo
- Otros deportes (fútbol, tenis, etc.)
- Solo dribbling sin tiro
- Videos corruptos o sin contenido claro
- Contenido inapropiado o no relacionado

INSTRUCCIONES:
1. Analiza el video frame por frame
2. Identifica elementos de baloncesto presentes
3. Determina si se puede evaluar la técnica de tiro
4. Asigna un nivel de confianza basado en la claridad del contenido
5. Proporciona una recomendación clara

Video a analizar: {{videoUrl}}
Tipo de tiro esperado: {{shotType}}

Responde en español y sé muy estricto con la validación. Es mejor rechazar contenido dudoso que generar análisis falsos.`,
});

const validateBasketballContentFlow = ai.defineFlow(
  {
    name: 'validateBasketballContentFlow',
    inputSchema: ValidateBasketballContentInputSchema,
    outputSchema: ValidateBasketballContentOutputSchema,
  },
  async input => {
    const { output } = await validateContentPrompt(input);
    return output!;
  }
);
