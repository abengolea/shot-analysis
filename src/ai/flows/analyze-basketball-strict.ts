'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const StrictAnalysisInputSchema = z.object({
  videoUrl: z.string().describe('URL del video a analizar'),
  videoBuffer: z.instanceof(Buffer).optional().describe('Buffer del video (opcional)')
});

const StrictAnalysisOutputSchema = z.object({
  success: z.boolean().describe('Si el análisis fue exitoso'),
  visibility: z.object({
    playerVisible: z.enum(['sí', 'parcial', 'no']).describe('¿El jugador es claramente visible?'),
    hoopVisible: z.enum(['sí', 'no']).describe('¿La canasta es visible en el video?'),
    ballVisible: z.enum(['sí', 'parcial', 'no']).describe('¿Se ve el balón durante todo el tiro?'),
    videoQuality: z.enum(['buena', 'regular', 'mala']).describe('Calidad del video'),
    cameraAngle: z.enum(['frontal', 'lateral', 'otro']).describe('Ángulo de cámara')
  }).describe('Elementos de visibilidad'),
  preparation: z.object({
    feetPosition: z.enum(['paralelos', 'uno_adelante', 'no_visible']).describe('Posición de los pies'),
    kneeFlexion: z.enum(['mucho', 'poco', 'no_visible']).describe('Flexión de rodillas'),
    handPosition: z.enum(['visible', 'no_visible']).describe('Posición de manos en el balón')
  }).describe('Elementos de preparación'),
  execution: z.object({
    playerJumps: z.enum(['sí', 'no', 'no_claro']).describe('¿El jugador salta?'),
    armExtension: z.enum(['sí', 'no', 'no_claro']).describe('¿Brazo se extiende completamente?'),
    movementDuration: z.union([z.number(), z.literal('no_determinable')]).describe('Duración del movimiento en segundos')
  }).describe('Elementos de ejecución'),
  result: z.object({
    shotOutcome: z.enum(['entra', 'falla', 'no_visible']).describe('Resultado del tiro'),
    confidence: z.enum(['alta', 'media', 'baja']).describe('Confianza en el análisis')
  }).describe('Resultado del análisis'),
  error: z.string().optional().describe('Error si el análisis falló')
});

export type StrictAnalysisInput = z.infer<typeof StrictAnalysisInputSchema>;
export type StrictAnalysisOutput = z.infer<typeof StrictAnalysisOutputSchema>;

/**
 * Análisis estricto de tiro de baloncesto sin alucinaciones
 * Solo reporta lo que es 100% visible en el video
 */
export async function analyzeBasketballStrict(
  input: StrictAnalysisInput
): Promise<StrictAnalysisOutput> {
  try {
    console.log('[analyzeBasketballStrict] Iniciando análisis estricto para:', input.videoUrl);

    // Configurar Gemini con parámetros anti-alucinación
    const genAI = new (await import('@google/generative-ai')).GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || 
      process.env.GOOGLE_API_KEY || 
      process.env.GOOGLE_GENAI_API_KEY || 
      'AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4'
    );

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,  // Más bajo = menos creativo
        topP: 0.8,         // Más selectivo
        topK: 10,          // Menos opciones
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH'
        }
      ]
    });

    // Subir video
    const videoFile = await model.uploadFile(input.videoUrl);

    // Prompt anti-alucinación
    const strictPrompt = `
ANÁLISIS DE TIRO DE BALONCESTO - MODO ESTRICTO ANTI-ALUCINACIÓN

REGLAS OBLIGATORIAS:
1. SOLO reporta lo que es 100% visible en el video
2. USA "no_visible" si no es claramente observable
3. NO inventes métricas que no puedes medir
4. NO asumas el resultado si no ves la canasta
5. NO inventes nombres, lugares o contexto
6. SI NO PUEDES VER ALGO CLARAMENTE, DEBES RESPONDER "no_visible"

PREGUNTAS ESPECÍFICAS (responde SOLO lo que ves):

VISIBILIDAD:
- ¿El jugador es claramente visible? (sí/parcial/no)
- ¿La canasta es visible en el video? (sí/no)
- ¿Se ve el balón durante todo el tiro? (sí/parcial/no)
- ¿Calidad del video? (buena/regular/mala)
- ¿Ángulo de cámara? (frontal/lateral/otro)

PREPARACIÓN (si es visible):
- Pies: ¿Puedes ver la posición? (paralelos/uno_adelante/no_visible)
- Rodillas: ¿Flexionadas? (mucho/poco/no_visible)
- Manos: ¿Posición en el balón? (visible/no_visible)

EJECUCIÓN (si es visible):
- ¿El jugador salta? (sí/no/no_claro)
- ¿Brazo se extiende completamente? (sí/no/no_claro)
- ¿Cuántos segundos dura el movimiento? (número o "no_determinable")

RESULTADO:
- ¿Se ve si el tiro entra? (entra/falla/no_visible)
- ¿Confianza en el análisis? (alta/media/baja)

IMPORTANTE: 
- NO INVENTES DATOS
- USA "no_visible" PARA TODO LO QUE NO PUEDAS VER CLARAMENTE
- SI NO ESTÁS 100% SEGURO, RESPONDE "no_visible"

RESPONDE EN JSON ESTRICTO:
{
  "visibility": {
    "playerVisible": "sí/parcial/no",
    "hoopVisible": "sí/no",
    "ballVisible": "sí/parcial/no",
    "videoQuality": "buena/regular/mala",
    "cameraAngle": "frontal/lateral/otro"
  },
  "preparation": {
    "feetPosition": "paralelos/uno_adelante/no_visible",
    "kneeFlexion": "mucho/poco/no_visible",
    "handPosition": "visible/no_visible"
  },
  "execution": {
    "playerJumps": "sí/no/no_claro",
    "armExtension": "sí/no/no_claro",
    "movementDuration": "número o no_determinable"
  },
  "result": {
    "shotOutcome": "entra/falla/no_visible",
    "confidence": "alta/media/baja"
  }
}

NO INVENTES NADA. Si no puedes determinarlo, usa "no_visible" o "no_determinable".
`;

    console.log('[analyzeBasketballStrict] Enviando prompt estricto a Gemini...');

    // Analizar con prompt estricto
    const response = await model.generateContent([strictPrompt, videoFile]);
    const responseText = response.response.text();

    console.log('[analyzeBasketballStrict] Respuesta de Gemini:', responseText);

    // Parsear respuesta JSON
    let analysisResult;
    try {
      // Extraer JSON de la respuesta (puede tener texto adicional)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (parseError) {
      console.error('[analyzeBasketballStrict] Error parseando JSON:', parseError);
      return {
        success: false,
        visibility: {
          playerVisible: 'no',
          hoopVisible: 'no',
          ballVisible: 'no',
          videoQuality: 'mala',
          cameraAngle: 'otro'
        },
        preparation: {
          feetPosition: 'no_visible',
          kneeFlexion: 'no_visible',
          handPosition: 'no_visible'
        },
        execution: {
          playerJumps: 'no_claro',
          armExtension: 'no_claro',
          movementDuration: 'no_determinable'
        },
        result: {
          shotOutcome: 'no_visible',
          confidence: 'baja'
        },
        error: 'Error parseando respuesta de Gemini'
      };
    }

    // Validar que todos los campos requeridos estén presentes
    const validatedResult = validateAnalysisResult(analysisResult);

    console.log('[analyzeBasketballStrict] Análisis completado exitosamente');

    return {
      success: true,
      ...validatedResult
    };

  } catch (error: any) {
    console.error('[analyzeBasketballStrict] Error en análisis:', error?.message || error);
    
    return {
      success: false,
      visibility: {
        playerVisible: 'no',
        hoopVisible: 'no',
        ballVisible: 'no',
        videoQuality: 'mala',
        cameraAngle: 'otro'
      },
      preparation: {
        feetPosition: 'no_visible',
        kneeFlexion: 'no_visible',
        handPosition: 'no_visible'
      },
      execution: {
        playerJumps: 'no_claro',
        armExtension: 'no_claro',
        movementDuration: 'no_determinable'
      },
      result: {
        shotOutcome: 'no_visible',
        confidence: 'baja'
      },
      error: error?.message || 'Error desconocido'
    };
  }
}

/**
 * Valida y completa el resultado del análisis
 */
function validateAnalysisResult(result: any): Omit<StrictAnalysisOutput, 'success' | 'error'> {
  return {
    visibility: {
      playerVisible: result.visibility?.playerVisible || 'no',
      hoopVisible: result.visibility?.hoopVisible || 'no',
      ballVisible: result.visibility?.ballVisible || 'no',
      videoQuality: result.visibility?.videoQuality || 'mala',
      cameraAngle: result.visibility?.cameraAngle || 'otro'
    },
    preparation: {
      feetPosition: result.preparation?.feetPosition || 'no_visible',
      kneeFlexion: result.preparation?.kneeFlexion || 'no_visible',
      handPosition: result.preparation?.handPosition || 'no_visible'
    },
    execution: {
      playerJumps: result.execution?.playerJumps || 'no_claro',
      armExtension: result.execution?.armExtension || 'no_claro',
      movementDuration: result.execution?.movementDuration || 'no_determinable'
    },
    result: {
      shotOutcome: result.result?.shotOutcome || 'no_visible',
      confidence: result.result?.confidence || 'baja'
    }
  };
}
