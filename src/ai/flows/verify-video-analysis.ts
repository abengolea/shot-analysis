'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VerifyVideoAnalysisInputSchema = z.object({
  videoUrl: z.string().describe('URL of the basketball shot video.'),
});

const VerifyVideoAnalysisOutputSchema = z.object({
  verificacion_basica: z.object({
    duracion_video: z.string().describe('Duración exacta del video en segundos'),
    color_camiseta: z.string().describe('Color de la camiseta del jugador'),
    color_pantalon: z.string().describe('Color del pantalón del jugador'),
    angulo_camara: z.string().describe('Ángulo de la cámara: frontal, lateral, diagonal, trasero'),
    canasta_visible: z.boolean().describe('¿Se ve la canasta en el video?'),
    aro_visible: z.boolean().describe('¿Se ve el aro en el video?'),
    tablero_visible: z.boolean().describe('¿Se ve el tablero en el video?'),
    encestes_observados: z.number().describe('Número de encestes que realmente se ven'),
    tiros_fallidos: z.number().describe('Número de tiros fallidos que realmente se ven'),
    total_tiros: z.number().describe('Total de tiros observados'),
    elementos_entorno: z.array(z.string()).describe('Elementos del entorno visibles'),
    detalles_especificos: z.array(z.string()).describe('3 detalles específicos únicos de este video')
  }),
  confianza_analisis: z.enum(['alta', 'media', 'baja']).describe('Confianza en que está analizando el video real'),
  advertencias: z.array(z.string()).describe('Advertencias sobre limitaciones del video')
});

export type VerifyVideoAnalysisInput = z.infer<typeof VerifyVideoAnalysisInputSchema>;
export type VerifyVideoAnalysisOutput = z.infer<typeof VerifyVideoAnalysisOutputSchema>;

const verifyVideoAnalysisPrompt = ai.definePrompt({
  name: 'verifyVideoAnalysisPrompt',
  input: {schema: VerifyVideoAnalysisInputSchema},
  output: {schema: VerifyVideoAnalysisOutputSchema},
  prompt: `🔍 VERIFICACIÓN DE ANÁLISIS DE VIDEO REAL

Tu tarea es DEMOSTRAR que estás analizando el video real y NO simulando datos.

INSTRUCCIONES CRÍTICAS:
1. OBSERVA TODO EL VIDEO desde el inicio hasta el final
2. DESCRIBE EXACTAMENTE lo que ves, sin inventar nada
3. Si NO puedes ver algo claramente, di "no visible" o "no se puede determinar"
4. NO inventes colores, ángulos, o resultados
5. Sé específico y detallado

VERIFICACIÓN OBLIGATORIA:
Responde estas preguntas basándote SOLO en lo que realmente ves:

1. DURACIÓN: ¿Cuánto dura exactamente el video?
2. VESTIMENTA: ¿Qué color tiene la camiseta? ¿Qué color tiene el pantalón?
3. ÁNGULO: ¿Desde qué ángulo está grabado? (frontal, lateral, diagonal, trasero)
4. CANASTA: ¿Se ve la canasta? ¿Se ve el aro? ¿Se ve el tablero?
5. RESULTADOS: ¿Cuántos tiros encestan realmente? ¿Cuántos fallan?
6. ENTORNO: ¿Qué elementos del entorno son visibles?

FORMATO DE RESPUESTA:
{
  "verificacion_basica": {
    "duracion_video": "X.Xs",
    "color_camiseta": "color específico o 'no visible'",
    "color_pantalon": "color específico o 'no visible'",
    "angulo_camara": "frontal/lateral/diagonal/trasero",
    "canasta_visible": true/false,
    "aro_visible": true/false,
    "tablero_visible": true/false,
    "encestes_observados": X,
    "tiros_fallidos": X,
    "total_tiros": X,
    "elementos_entorno": ["elemento1", "elemento2"],
    "detalles_especificos": [
      "Detalle único 1 del video",
      "Detalle único 2 del video", 
      "Detalle único 3 del video"
    ]
  },
  "confianza_analisis": "alta/media/baja",
  "advertencias": [
    "Advertencia 1 si hay limitaciones",
    "Advertencia 2 si hay limitaciones"
  ]
}

⚠️ VALIDACIÓN CRÍTICA:
- Si describes colores que no están claros → confianza_analisis: "baja"
- Si inventas resultados de tiros → confianza_analisis: "baja"
- Si no puedes ver la canasta pero dices que encesta → confianza_analisis: "baja"
- Si describes detalles genéricos → confianza_analisis: "baja"

✅ INDICADORES DE ANÁLISIS REAL:
- Detalles específicos únicos del video
- Colores precisos de la vestimenta
- Ángulo de cámara correcto
- Resultados de tiros basados en lo visible
- Elementos del entorno específicos

Video: {{videoUrl}}`
});

export async function verifyVideoAnalysis(input: VerifyVideoAnalysisInput): Promise<VerifyVideoAnalysisOutput> {
  try {
            const {output} = await verifyVideoAnalysisPrompt(input);
        return output!;
  } catch (e: any) {
    console.error('[verifyVideoAnalysis] Error:', e?.message || e);
    throw new Error(`Error en verificación de video: ${e?.message || 'Error desconocido'}`);
  }
}


