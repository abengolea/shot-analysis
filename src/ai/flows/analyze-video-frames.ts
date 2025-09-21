'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';

const AnalyzeVideoFramesInputSchema = z.object({
  videoBuffer: z.instanceof(Buffer).describe('Buffer del video a analizar.'),
  videoUrl: z.string().describe('URL del video (para logging).'),
  shotType: z.string().optional().describe('Tipo de tiro esperado (opcional).'),
});

const AnalyzeVideoFramesOutputSchema = z.object({
  isBasketballContent: z.boolean().describe('Si el video contiene contenido de baloncesto válido.'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianza del análisis (0-1).'),
  detectedElements: z.array(z.string()).describe('Elementos específicos de baloncesto detectados en los frames.'),
  reason: z.string().describe('Explicación detallada del análisis realizado.'),
  recommendation: z.enum(['PROCEED', 'REJECT', 'REVIEW']).describe('Recomendación: continuar, rechazar, o revisar manualmente.'),
  videoDescription: z.string().describe('Descripción detallada de lo que se ve en los frames del video.'),
  basketballIndicators: z.array(z.string()).describe('Indicadores específicos de baloncesto encontrados en los frames.'),
  nonBasketballIndicators: z.array(z.string()).describe('Indicadores que sugieren que NO es baloncesto.'),
  analyzedFrames: z.number().describe('Número de frames analizados.'),
});

export type AnalyzeVideoFramesInput = z.infer<typeof AnalyzeVideoFramesInputSchema>;
export type AnalyzeVideoFramesOutput = z.infer<typeof AnalyzeVideoFramesOutputSchema>;

export async function analyzeVideoFrames(
  input: AnalyzeVideoFramesInput
): Promise<AnalyzeVideoFramesOutput> {
  try {
    console.log('[analyzeVideoFrames] Iniciando análisis de frames para:', input.videoUrl);
    
    // Extraer frames del video - más frames para mejor análisis
    const frames = await extractKeyframesFromBuffer(input.videoBuffer, 32); // 32 frames para análisis detallado
    console.log(`[analyzeVideoFrames] Extraídos ${frames.length} frames del video`);
    
    if (frames.length === 0) {
      return {
        isBasketballContent: false,
        confidence: 0.1,
        detectedElements: [],
        reason: 'No se pudieron extraer frames del video para análisis.',
        recommendation: 'REVIEW',
        videoDescription: 'Video no analizable - no se pudieron extraer frames.',
        basketballIndicators: [],
        nonBasketballIndicators: ['No se pudieron extraer frames del video'],
        analyzedFrames: 0
      };
    }
    
    // Convertir frames a base64 para enviar a la IA
    const frameData = frames.map((frame, index) => ({
      index,
      timestamp: frame.timestamp,
      imageData: frame.imageBuffer.toString('base64')
    }));
    
    const result = await analyzeVideoFramesFlow({
      ...input,
      frames: frameData
    });
    
    console.log('[analyzeVideoFrames] Resultado:', result);
    
    // Validación MUY ESTRICTA: solo aprobar con confianza muy alta
    if (result.isBasketballContent && result.confidence < 0.9) {
      console.log('[analyzeVideoFrames] Confianza insuficiente para aprobar, cambiando a REVIEW');
      result.isBasketballContent = false;
      result.recommendation = 'REVIEW';
      result.reason = `Confianza insuficiente (${Math.round(result.confidence * 100)}%): ${result.reason}. Se requiere revisión manual.`;
      result.confidence = Math.max(result.confidence, 0.3);
    }
    
    // Si la IA dice que es baloncesto pero hay indicadores de fiesta, rechazar
    if (result.isBasketballContent && result.nonBasketballIndicators.length > 0) {
      console.log('[analyzeVideoFrames] Detectados indicadores de fiesta, rechazando');
      result.isBasketballContent = false;
      result.recommendation = 'REJECT';
      result.reason = `Contenido ambiguo detectado: ${result.reason}. Indicadores de fiesta encontrados: ${result.nonBasketballIndicators.join(', ')}`;
      result.confidence = 0.2;
    }
    
    return result;
  } catch (e: any) {
    console.error('[analyzeVideoFrames] Error en análisis:', e?.message || e);
    console.error('[analyzeVideoFrames] Stack:', e?.stack);
    
    return {
      isBasketballContent: false,
      confidence: 0.2,
      detectedElements: [],
      reason: `Error técnico al analizar frames del video: ${e?.message || 'Error desconocido'}`,
      recommendation: 'REVIEW',
      videoDescription: 'Error al procesar el video para análisis.',
      basketballIndicators: [],
      nonBasketballIndicators: ['Error técnico en procesamiento'],
      analyzedFrames: 0
    };
  }
}

const AnalyzeVideoFramesWithDataInputSchema = z.object({
  videoUrl: z.string().describe('URL del video (para logging).'),
  shotType: z.string().optional().describe('Tipo de tiro esperado (opcional).'),
  frames: z.array(z.object({
    index: z.number(),
    timestamp: z.number(),
    imageData: z.string().describe('Frame en base64')
  })).describe('Frames extraídos del video en base64')
});

const analyzeVideoFramesPrompt = ai.definePrompt({
  name: 'analyzeVideoFramesPrompt',
  input: { schema: AnalyzeVideoFramesWithDataInputSchema },
  output: { schema: AnalyzeVideoFramesOutputSchema },
  prompt: `Eres un experto en análisis de video deportivo especializado en baloncesto. Tu tarea es analizar frames extraídos de un video para determinar si contiene contenido de baloncesto válido.

INSTRUCCIONES IMPORTANTES:
1. Analiza cada frame proporcionado en detalle
2. Busca CUALQUIER elemento relacionado con baloncesto
3. Sé GENEROSO en reconocer baloncesto - es mejor aprobar un video ambiguo que rechazar uno válido
4. Proporciona una descripción detallada de lo que ves
5. Da una recomendación clara basada en tu análisis visual

ELEMENTOS QUE INDICAN BALONCESTO (cualquiera de estos es suficiente):
- Canasta de baloncesto (aro, tablero, red) - INCLUSO SI ES PARCIAL O NO VISIBLE
- Balón de baloncesto (color naranja, tamaño estándar) - INCLUSO SI ES PARCIAL
- Cancha de baloncesto (líneas, dimensiones, superficie) - INCLUSO SI ES PARCIAL
- Jugador con UNIFORME DE BALONCESTO (camiseta, shorts deportivos)
- Jugador con BALÓN DE BALONCESTO en las manos
- Movimiento de tiro o lanzamiento (incluso si no se ve el aro)
- Jugador en posición de tiro o lanzamiento
- Entorno deportivo (gimnasio, cancha, etc.)
- Equipamiento deportivo (zapatillas, ropa deportiva)
- Cualquier combinación de: uniforme deportivo + balón + movimiento de tiro

ELEMENTOS QUE DEFINITIVAMENTE NO SON BALONCESTO:
- Fiestas, celebraciones, eventos sociales OBVIOS
- Otros deportes claramente identificables (fútbol, tenis, etc.)
- Contenido de entretenimiento/música OBVIO
- Personas bailando o cantando en contexto no deportivo
- Contenido claramente no deportivo

CRITERIOS DE EVALUACIÓN (EQUILIBRADO):
- PROCEED: Si hay evidencia de baloncesto (canasta, balón, cancha, jugador tirando, etc.) O si es un jugador haciendo movimiento de tiro
- REJECT: Solo si hay evidencia CLARA de fiesta, celebración, música, baile, o contenido NO deportivo
- REVIEW: Si el contenido es ambiguo pero no hay indicios claros de fiesta

REGLAS EQUILIBRADAS:
1. Si hay CUALQUIER indicio de fiesta/celebración, elige REJECT inmediatamente
2. Si ves un jugador con UNIFORME DE BALONCESTO haciendo movimiento de tiro, elige PROCEED (aunque no veas canasta)
3. Si ves un jugador con BALÓN DE BALONCESTO en posición de tiro, elige PROCEED
4. Si ves elementos de baloncesto (canasta, balón, cancha, jugador deportivo), elige PROCEED
5. Si hay música, baile, o celebraciones OBVIAS, elige REJECT
6. Si es un video deportivo ambiguo pero NO es fiesta, elige PROCEED
7. Analiza solo lo que realmente ves en los frames proporcionados
8. NO inventes contenido que no esté presente

CASOS ESPECIALES:
- Jugador con uniforme de baloncesto + balón = PROCEED (es baloncesto)
- Jugador haciendo movimiento de tiro + balón = PROCEED (es baloncesto)
- Solo falta canasta visible NO es razón para REJECT si hay otros elementos de baloncesto`
});

const analyzeVideoFramesFlow = ai.defineFlow(
  {
    name: 'analyzeVideoFramesFlow',
    inputSchema: AnalyzeVideoFramesWithDataInputSchema,
    outputSchema: AnalyzeVideoFramesOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeVideoFramesPrompt(input);
    return output!;
  }
);
