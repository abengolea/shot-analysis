'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeVideoContentInputSchema = z.object({
  videoUrl: z.string().describe('URL del video a analizar.'),
  shotType: z.string().optional().describe('Tipo de tiro esperado (opcional).'),
});

const AnalyzeVideoContentOutputSchema = z.object({
  isBasketballContent: z.boolean().describe('Si el video contiene contenido de baloncesto válido.'),
  confidence: z.number().min(0).max(1).describe('Nivel de confianza del análisis (0-1).'),
  detectedElements: z.array(z.string()).describe('Elementos específicos de baloncesto detectados en el video.'),
  reason: z.string().describe('Explicación detallada del análisis realizado.'),
  recommendation: z.enum(['PROCEED', 'REJECT', 'REVIEW']).describe('Recomendación: continuar, rechazar, o revisar manualmente.'),
  videoDescription: z.string().describe('Descripción detallada de lo que se ve en el video.'),
  basketballIndicators: z.array(z.string()).describe('Indicadores específicos de baloncesto encontrados.'),
  nonBasketballIndicators: z.array(z.string()).describe('Indicadores que sugieren que NO es baloncesto.'),
});

export type AnalyzeVideoContentInput = z.infer<typeof AnalyzeVideoContentInputSchema>;
export type AnalyzeVideoContentOutput = z.infer<typeof AnalyzeVideoContentOutputSchema>;

export async function analyzeVideoContent(
  input: AnalyzeVideoContentInput
): Promise<AnalyzeVideoContentOutput> {
  try {
        const result = await analyzeVideoContentFlow(input);
    console.log('[analyzeVideoContent] Resultado:', result);
    return result;
  } catch (e: any) {
    console.error('[analyzeVideoContent] Error en análisis:', e?.message || e);
    console.error('[analyzeVideoContent] Stack:', e?.stack);
    
    // Fallback: análisis básico basado en URL si la IA falla
    const url = input.videoUrl.toLowerCase();
    const isPartyVideo = url.includes('party') || 
                        url.includes('fiesta') || 
                        url.includes('celebration') ||
                        url.includes('dance') ||
                        url.includes('wedding') ||
                        url.includes('birthday');
    
    return {
      isBasketballContent: !isPartyVideo,
      confidence: 0.6,
      detectedElements: isPartyVideo ? [] : ['URL sugiere contenido deportivo'],
      reason: isPartyVideo 
        ? 'Análisis de IA no disponible. URL sugiere video de fiesta/celebración.'
        : 'Análisis de IA no disponible. Se requiere revisión manual del contenido.',
      recommendation: isPartyVideo ? 'REJECT' : 'REVIEW',
      videoDescription: 'No se pudo analizar el contenido del video con IA.',
      basketballIndicators: [],
      nonBasketballIndicators: isPartyVideo ? ['URL sugiere fiesta/celebración'] : []
    };
  }
}

const analyzeVideoContentPrompt = ai.definePrompt({
  name: 'analyzeVideoContentPrompt',
  input: { schema: AnalyzeVideoContentInputSchema },
  output: { schema: AnalyzeVideoContentOutputSchema },
  prompt: `Eres un experto en análisis de video deportivo especializado en baloncesto. Tu tarea es analizar el contenido de un video para determinar si contiene un tiro de baloncesto válido.

INSTRUCCIONES:
1. Analiza el video en detalle para identificar elementos específicos de baloncesto
2. Busca indicadores claros de que es un tiro de baloncesto real
3. Identifica cualquier elemento que sugiera que NO es baloncesto
4. Proporciona una descripción detallada de lo que ves en el video
5. Da una recomendación clara basada en tu análisis

ELEMENTOS A BUSCAR EN BALONCESTO:
- Canasta de baloncesto (aro, tablero, red)
- Balón de baloncesto (color naranja, tamaño estándar)
- Cancha de baloncesto (líneas, dimensiones, superficie)
- Jugador ejecutando un tiro
- Movimiento de tiro típico (posición, seguimiento)
- Entorno deportivo apropiado

ELEMENTOS QUE INDICAN QUE NO ES BALONCESTO:
- Fiestas, celebraciones, eventos sociales
- Otros deportes (fútbol, tenis, etc.)
- Contenido no deportivo
- Videos de entretenimiento
- Contenido inapropiado

CRITERIOS DE EVALUACIÓN:
- PROCEED: Video claramente muestra un tiro de baloncesto
- REJECT: Video claramente NO es de baloncesto (fiesta, otro deporte, etc.)
- REVIEW: Contenido ambiguo que requiere revisión manual

Proporciona un análisis detallado y honesto del contenido del video.`
});

const analyzeVideoContentFlow = ai.defineFlow(
  {
    name: 'analyzeVideoContentFlow',
    inputSchema: AnalyzeVideoContentInputSchema,
    outputSchema: AnalyzeVideoContentOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeVideoContentPrompt(input);
    return output!;
  }
);
