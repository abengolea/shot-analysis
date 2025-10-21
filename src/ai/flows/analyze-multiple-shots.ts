'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { extractFramesFromMultipleShots } from '@/lib/ffmpeg';

const AnalyzeMultipleShotsInputSchema = z.object({
  videoBuffer: z.instanceof(Buffer).describe('Buffer del video a analizar.'),
  videoUrl: z.string().describe('URL del video (para logging).'),
  shotType: z.string().optional().describe('Tipo de tiro esperado (opcional).'),
});

const ShotAnalysisSchema = z.object({
  shotIndex: z.number().describe('Índice del tiro (0, 1, 2, etc.)'),
  startTime: z.number().describe('Tiempo de inicio del tiro en segundos'),
  endTime: z.number().describe('Tiempo de fin del tiro en segundos'),
  isBasketballShot: z.boolean().describe('Si este segmento es un tiro de baloncesto válido'),
  confidence: z.number().min(0).max(1).describe('Confianza de la detección (0-1)'),
  basketballIndicators: z.array(z.string()).describe('Indicadores de baloncesto encontrados'),
  nonBasketballIndicators: z.array(z.string()).describe('Indicadores que sugieren que NO es baloncesto'),
  description: z.string().describe('Descripción de lo que se ve en este segmento'),
});

const AnalyzeMultipleShotsOutputSchema = z.object({
  totalShotsDetected: z.number().describe('Número total de segmentos detectados'),
  validBasketballShots: z.number().describe('Número de tiros de baloncesto válidos'),
  shotAnalyses: z.array(ShotAnalysisSchema).describe('Análisis de cada segmento detectado'),
  overallRecommendation: z.enum(['PROCEED', 'REJECT', 'REVIEW']).describe('Recomendación general'),
  overallConfidence: z.number().min(0).max(1).describe('Confianza general del análisis'),
  summary: z.string().describe('Resumen del análisis completo'),
  extractedFrames: z.array(z.object({
    shotIndex: z.number(),
    startTime: z.number(),
    endTime: z.number(),
    frames: z.array(z.object({
      index: z.number(),
      timestamp: z.number(),
      imageData: z.string().describe('Frame en base64')
    }))
  })).optional().describe('Frames extraídos para visualización')
});

export type AnalyzeMultipleShotsInput = z.infer<typeof AnalyzeMultipleShotsInputSchema>;
export type AnalyzeMultipleShotsOutput = z.infer<typeof AnalyzeMultipleShotsOutputSchema>;

export async function analyzeMultipleShots(
  input: AnalyzeMultipleShotsInput
): Promise<AnalyzeMultipleShotsOutput> {
  try {
        // Extraer segmentos de tiros del video
    const shotSegments = await extractFramesFromMultipleShots(input.videoBuffer);
    console.log(`[analyzeMultipleShots] Detectados ${shotSegments.length} segmentos de tiros`);
    
    if (shotSegments.length === 0) {
      return {
        totalShotsDetected: 0,
        validBasketballShots: 0,
        shotAnalyses: [],
        overallRecommendation: 'REJECT',
        overallConfidence: 0.1,
        summary: 'No se pudieron detectar segmentos de tiros en el video.'
      };
    }
    
    // Convertir frames a base64 para enviar a la IA
    const segmentsData = shotSegments.map(segment => ({
      shotIndex: segment.shotIndex,
      startTime: segment.startTime,
      endTime: segment.endTime,
      frames: segment.frames.map((frame, index) => ({
        index,
        timestamp: frame.timestamp,
        imageData: frame.imageBuffer.toString('base64')
      }))
    }));
    
    const result = await analyzeMultipleShotsFlow({
      ...input,
      segments: segmentsData
    });
    
    // La validación ahora se basa únicamente en la presencia de elementos de baloncesto
    // No hay validación post-procesamiento sesgada hacia fiestas
    
    // Agregar los frames extraídos al resultado
    result.extractedFrames = segmentsData;
    
    console.log('[analyzeMultipleShots] Resultado:', result);
    return result;
  } catch (e: any) {
    console.error('[analyzeMultipleShots] Error en análisis:', e?.message || e);
    console.error('[analyzeMultipleShots] Stack:', e?.stack);
    
    return {
      totalShotsDetected: 0,
      validBasketballShots: 0,
      shotAnalyses: [],
      overallRecommendation: 'REVIEW',
      overallConfidence: 0.2,
      summary: `Error técnico al analizar el video: ${e?.message || 'Error desconocido'}`
    };
  }
}

const AnalyzeMultipleShotsWithDataInputSchema = z.object({
  videoUrl: z.string().describe('URL del video (para logging).'),
  shotType: z.string().optional().describe('Tipo de tiro esperado (opcional).'),
  segments: z.array(z.object({
    shotIndex: z.number(),
    startTime: z.number(),
    endTime: z.number(),
    frames: z.array(z.object({
      index: z.number(),
      timestamp: z.number(),
      imageData: z.string().describe('Frame en base64')
    }))
  })).describe('Segmentos de tiros detectados con frames')
});

const analyzeMultipleShotsPrompt = ai.definePrompt({
  name: 'analyzeMultipleShotsPrompt',
  input: { schema: AnalyzeMultipleShotsWithDataInputSchema },
  output: { schema: AnalyzeMultipleShotsOutputSchema },
  prompt: `Eres un experto en análisis de video deportivo especializado en baloncesto. Tu tarea es analizar múltiples segmentos de un video para determinar cuáles contienen tiros de baloncesto válidos.

INSTRUCCIONES IMPORTANTES:
1. Analiza cada segmento por separado
2. Para cada segmento, examina todos los frames proporcionados
3. Determina si cada segmento es un tiro de baloncesto válido
4. Proporciona un análisis detallado de cada segmento
5. Analiza solo lo que realmente ves en los frames proporcionados
6. NO inventes contenido que no esté presente

ELEMENTOS QUE INDICAN BALONCESTO EN UN SEGMENTO:
- Canasta de baloncesto (aro, tablero, red) - debe ser visible y clara
- Balón de baloncesto (color naranja, tamaño estándar) - debe ser visible y claro
- Cancha de baloncesto (líneas, dimensiones, superficie) - debe ser visible y clara
- Jugador con ropa deportiva ejecutando movimiento de tiro
- Movimiento de lanzamiento hacia una canasta
- Entorno deportivo (gimnasio, cancha, etc.)
- Equipamiento deportivo (zapatillas, ropa deportiva)

CRITERIOS DE EVALUACIÓN POR SEGMENTO:
- PROCEED: Si ves CLARAMENTE una canasta de baloncesto Y un balón naranja Y movimiento de tiro
- REJECT: Si NO ves elementos claros de baloncesto (canasta, balón, cancha, movimiento de tiro)
- REVIEW: Solo si el contenido es completamente ambiguo

RECOMENDACIÓN GENERAL:
- PROCEED: Solo si hay al menos un segmento con evidencia CLARA de baloncesto
- REJECT: Si NO hay evidencia clara de baloncesto en ningún segmento
- REVIEW: Solo si es completamente ambiguo

REGLAS CRÍTICAS:
1. Si no ves una canasta de baloncesto clara, elige REJECT
2. Si no ves un balón de baloncesto claro, elige REJECT
3. Si no ves movimiento de tiro claro, elige REJECT
4. Si no estás 100% seguro de que es baloncesto, elige REJECT
5. Analiza solo lo que realmente ves en los frames proporcionados
6. NO inventes contenido que no esté presente
7. Es mejor rechazar contenido ambiguo que aprobar contenido no deportivo`
});

const analyzeMultipleShotsFlow = ai.defineFlow(
  {
    name: 'analyzeMultipleShotsFlow',
    inputSchema: AnalyzeMultipleShotsWithDataInputSchema,
    outputSchema: AnalyzeMultipleShotsOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeMultipleShotsPrompt(input);
    return output!;
  }
);
