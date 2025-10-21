'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';

const ValidateBasketballSimpleInputSchema = z.object({
  videoBuffer: z.instanceof(Buffer).describe('Buffer del video a validar.'),
  videoUrl: z.string().describe('URL del video (para logging).'),
});

const ValidateBasketballSimpleOutputSchema = z.object({
  isBasketballContent: z.boolean().describe('Si el video contiene contenido de baloncesto válido.'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianza del análisis (0-1).'),
  reason: z.string().describe('Explicación del análisis realizado.'),
  recommendation: z.enum(['PROCEED', 'REJECT', 'REVIEW']).describe('Recomendación: continuar, rechazar, o revisar manualmente.'),
});

export type ValidateBasketballSimpleInput = z.infer<typeof ValidateBasketballSimpleInputSchema>;
export type ValidateBasketballSimpleOutput = z.infer<typeof ValidateBasketballSimpleOutputSchema>;

export async function validateBasketballSimple(
  input: ValidateBasketballSimpleInput
): Promise<ValidateBasketballSimpleOutput> {
  try {
        // Extraer solo 3 frames para análisis rápido
    const frames = await extractKeyframesFromBuffer(input.videoBuffer, 3);
    console.log(`[validateBasketballSimple] Extraídos ${frames.length} frames del video`);
    
    if (frames.length === 0) {
      return {
        isBasketballContent: true, // Ser permisivo si no se pueden extraer frames
        confidence: 0.5,
        reason: 'No se pudieron extraer frames del video. Se asume que es baloncesto por defecto.',
        recommendation: 'REVIEW'
      };
    }
    
    // Convertir frames a base64
    const frameData = frames.map((frame, index) => ({
      index,
      timestamp: frame.timestamp,
      imageData: frame.imageBuffer.toString('base64')
    }));
    
    const result = await validateBasketballSimpleFlow({
      ...input,
      frames: frameData
    });
    
    console.log('[validateBasketballSimple] Resultado:', result);
    
    // Ser muy permisivo - solo rechazar si es OBVIAMENTE no baloncesto
    if (result.recommendation === 'REJECT' && result.confidence < 0.9) {
      console.log('[validateBasketballSimple] Confianza baja para rechazo, cambiando a REVIEW');
      result.recommendation = 'REVIEW';
      result.isBasketballContent = true;
      result.reason = `Análisis inicial: ${result.reason}. Se requiere revisión manual.`;
    }
    
    return result;
  } catch (e: any) {
    console.error('[validateBasketballSimple] Error en validación:', e?.message || e);
    
    // En caso de error, ser permisivo
    return {
      isBasketballContent: true,
      confidence: 0.5,
      reason: `Error técnico al analizar el video: ${e?.message || 'Error desconocido'}. Se asume que es baloncesto por defecto.`,
      recommendation: 'REVIEW'
    };
  }
}

const ValidateBasketballSimpleWithDataInputSchema = z.object({
  videoUrl: z.string().describe('URL del video (para logging).'),
  frames: z.array(z.object({
    index: z.number(),
    timestamp: z.number(),
    imageData: z.string().describe('Frame en base64')
  })).describe('Frames extraídos del video en base64')
});

const validateBasketballSimplePrompt = ai.definePrompt({
  name: 'validateBasketballSimplePrompt',
  input: { schema: ValidateBasketballSimpleWithDataInputSchema },
  output: { schema: ValidateBasketballSimpleOutputSchema },
  prompt: `Eres un experto en análisis de video deportivo. Tu tarea es determinar si un video contiene contenido de baloncesto.

REGLAS IMPORTANTES:
1. Sé MUY GENEROSO - es mejor aprobar un video ambiguo que rechazar uno válido
2. Solo rechaza si es OBVIAMENTE no baloncesto (fiesta, otro deporte claro)
3. Si hay cualquier duda, elige PROCEED o REVIEW

ELEMENTOS QUE INDICAN BALONCESTO (cualquiera es suficiente):
- Canasta de baloncesto (aro, tablero, red)
- Balón de baloncesto (naranja)
- Cancha de baloncesto (líneas)
- Persona con ropa deportiva
- Entorno deportivo
- Cualquier elemento que sugiera deporte

ELEMENTOS QUE DEFINITIVAMENTE NO SON BALONCESTO:
- Fiestas/celebración OBVIA
- Otro deporte CLARAMENTE identificable
- Contenido de entretenimiento/música OBVIO

CRITERIOS:
- PROCEED: Si hay CUALQUIER indicio de baloncesto
- REJECT: Solo si es OBVIAMENTE no baloncesto
- REVIEW: Contenido ambiguo

Recuerda: Es mejor aprobar un video ambiguo que rechazar uno válido.`
});

const validateBasketballSimpleFlow = ai.defineFlow(
  {
    name: 'validateBasketballSimpleFlow',
    inputSchema: ValidateBasketballSimpleWithDataInputSchema,
    outputSchema: ValidateBasketballSimpleOutputSchema,
  },
  async (input) => {
    const { output } = await validateBasketballSimplePrompt(input);
    return output!;
  }
);
