'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';

const AnalyzeVideoFramesStrictInputSchema = z.object({
  videoBuffer: z.instanceof(Buffer).describe('Buffer del video a analizar.'),
  videoUrl: z.string().describe('URL del video (solo para logging).'),
});

const AnalyzeVideoFramesStrictOutputSchema = z.object({
  isBasketballContent: z.boolean().describe('Si el video contiene contenido de baloncesto.'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianza de la validación (0-1).'),
  detectedElements: z.array(z.string()).describe('Elementos de baloncesto detectados en el video.'),
  reason: z.string().describe('Explicación de por qué se considera o no contenido de baloncesto.'),
  recommendation: z.enum(['PROCEED', 'REJECT', 'REVIEW']).describe('Recomendación: continuar, rechazar, o revisar manualmente.'),
  frameAnalysis: z.array(z.object({
    frameIndex: z.number(),
    timestamp: z.number(),
    hasBasketballHoop: z.boolean(),
    hasBasketball: z.boolean(),
    hasBasketballCourt: z.boolean(),
    hasPartyContent: z.boolean(),
    description: z.string()
  })).describe('Análisis detallado de cada frame')
});

export type AnalyzeVideoFramesStrictInput = z.infer<typeof AnalyzeVideoFramesStrictInputSchema>;
export type AnalyzeVideoFramesStrictOutput = z.infer<typeof AnalyzeVideoFramesStrictOutputSchema>;

export async function analyzeVideoFramesStrict(
  input: AnalyzeVideoFramesStrictInput
): Promise<AnalyzeVideoFramesStrictOutput> {
  try {
        // Extraer frames del video
    const frames = await extractKeyframesFromBuffer(input.videoBuffer, 16);
    console.log(`[analyzeVideoFramesStrict] Extraídos ${frames.length} frames`);
    
    if (frames.length === 0) {
      return {
        isBasketballContent: false,
        confidence: 0.1,
        detectedElements: [],
        reason: 'No se pudieron extraer frames del video',
        recommendation: 'REJECT',
        frameAnalysis: []
      };
    }
    
    // Convertir frames a base64 para enviar a la IA
    const frameData = frames.map((frame, index) => ({
      index,
      timestamp: frame.timestamp,
      imageData: frame.imageBuffer.toString('base64')
    }));
    
    const result = await analyzeVideoFramesStrictFlow({
      ...input,
      frames: frameData
    });
    
    console.log('[analyzeVideoFramesStrict] Resultado:', result);
    
    // VALIDACIÓN POST-PROCESAMIENTO: Si hay CUALQUIER indicio de fiesta, RECHAZAR TODO
    const hasPartyInFrames = result.frameAnalysis.some(frame => frame.hasPartyContent);
    
    if (hasPartyInFrames) {
      console.log('[analyzeVideoFramesStrict] ¡FIESTA DETECTADA EN FRAMES! Rechazando todo el video.');
      result.isBasketballContent = false;
      result.confidence = 0.1;
      result.recommendation = 'REJECT';
      result.reason = 'VIDEO RECHAZADO: Se detectó contenido de fiesta en los frames analizados. Es imposible que un video de fiesta contenga baloncesto válido.';
      result.detectedElements = [];
    }
    
    return result;
  } catch (e: any) {
    console.error('[analyzeVideoFramesStrict] Error en análisis:', e?.message || e);
    console.error('[analyzeVideoFramesStrict] Stack:', e?.stack);
    
    return {
      isBasketballContent: false,
      confidence: 0.1,
      detectedElements: [],
      reason: `Error técnico al analizar frames: ${e?.message || 'Error desconocido'}`,
      recommendation: 'REJECT',
      frameAnalysis: []
    };
  }
}

const AnalyzeVideoFramesStrictWithDataInputSchema = z.object({
  videoUrl: z.string().describe('URL del video (solo para logging).'),
  frames: z.array(z.object({
    index: z.number(),
    timestamp: z.number(),
    imageData: z.string().describe('Frame en base64')
  })).describe('Frames extraídos del video')
});

const analyzeVideoFramesStrictPrompt = ai.definePrompt({
  name: 'analyzeVideoFramesStrictPrompt',
  input: { schema: AnalyzeVideoFramesStrictWithDataInputSchema },
  output: { schema: AnalyzeVideoFramesStrictOutputSchema },
  prompt: `Eres un experto en análisis de video deportivo especializado en baloncesto. Tu tarea es analizar frames extraídos de un video para determinar si contiene contenido de baloncesto válido.

IMPORTANTE: SOLO analiza lo que VES en las imágenes. NO uses la URL, el nombre del archivo, o cualquier contexto externo.

INSTRUCCIONES CRÍTICAS:
1. Analiza CADA frame proporcionado en detalle
2. Busca SOLO elementos visuales reales en las imágenes
3. NO inventes contenido que no esté visible
4. Si no ves algo claramente, di que NO lo ves
5. Sé MUY estricto: solo aprueba si ves evidencia CLARA

ELEMENTOS QUE INDICAN BALONCESTO (deben estar CLARAMENTE visibles):
- Canasta de baloncesto (aro, tablero, red) - DEBE estar COMPLETA y CLARA
- Balón de baloncesto (color naranja, tamaño estándar) - DEBE estar COMPLETO y CLARO
- Cancha de baloncesto (líneas, dimensiones, superficie) - DEBE estar CLARA
- Jugador ejecutando movimiento de tiro hacia una canasta
- Entorno deportivo (gimnasio, cancha) - DEBE ser OBVIO

ELEMENTOS QUE DEFINITIVAMENTE NO SON BALONCESTO:
- Fiestas, celebraciones, eventos sociales
- Personas bailando o cantando
- Música, discotecas, ambientes de fiesta
- Otros deportes claramente identificables
- Contenido de entretenimiento/música

CRITERIOS DE EVALUACIÓN MUY ESTRICTOS:
- PROCEED: Solo si ves CLARAMENTE una canasta COMPLETA Y un balón COMPLETO
- REJECT: Si hay CUALQUIER indicio de fiesta, baile, música, o contenido no deportivo
- REVIEW: Solo si el contenido es completamente ambiguo

REGLAS ABSOLUTAS:
1. Si no ves una canasta de baloncesto CLARA y COMPLETA, elige REJECT
2. Si no ves un balón de baloncesto CLARO y COMPLETO, elige REJECT
3. Si hay CUALQUIER indicio de fiesta/celebración, elige REJECT inmediatamente
4. NO inventes contenido que no esté presente
5. Si no estás 100% seguro, elige REJECT
6. Es mejor rechazar un video ambiguo que aprobar uno de fiesta

ANÁLISIS POR FRAME:
Para cada frame, debes indicar específicamente:
- hasBasketballHoop: true solo si ves una canasta COMPLETA y CLARA
- hasBasketball: true solo si ves un balón COMPLETO y CLARO
- hasBasketballCourt: true solo si ves líneas de cancha CLARAS
- hasPartyContent: true si ves CUALQUIER indicio de fiesta, baile, música, etc.
- description: describe EXACTAMENTE lo que ves, sin inventar nada

REGLA DE ORO: Si hay CUALQUIER frame con fiesta, RECHAZA TODO EL VIDEO.`
});

const analyzeVideoFramesStrictFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFramesStrictFlow',
    inputSchema: AnalyzeVideoFramesStrictWithDataInputSchema,
    outputSchema: AnalyzeVideoFramesStrictOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeVideoFramesStrictPrompt(input);
    return output!;
  }
);
