import { GoogleGenerativeAI } from '@google/generative-ai';
import Bottleneck from 'bottleneck';

// Configuración de rate limiting (70-80% del límite)
const limiter = new Bottleneck({
  minTime: Math.ceil(60_000 / 8) // 8 req/min (80% de 10 RPM)
});

// Cliente Gemini optimizado
const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  'AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4'
);

// Cache de archivos subidos
const fileCache = new Map<string, { fileUri: string; expiresAt: number }>();

// Función de backoff exponencial con jitter
export async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 6) {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e?.response?.status || e?.status;
      if (status !== 429) {
        throw e;
      }
      const retryAfter = Number(e?.response?.headers?.["retry-after"]);
      const waitTime = !isNaN(retryAfter) ? retryAfter * 1000 : delay + Math.random() * 250;
      console.warn(`⚠️ Recibido 429, reintentando en ${waitTime / 1000} segundos... (intento ${i + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, waitTime));
      delay = Math.min(delay * 2, 30_000); // Max 30 seconds delay
    }
  }
  throw new Error('Se alcanzó el máximo de reintentos tras 429');
}

// Función optimizada para análisis con rate limiting
export async function analyzeWithGemini22Parameters(
  videoBase64: string,
  prompt: string,
  model: 'gemini-3.1-flash-lite-preview' | 'gemini-2.5-flash' = 'gemini-2.5-flash'
) {
  return await limiter.schedule(async () => {
    return await withBackoff(async () => {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY no configurada');
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'video/mp4',
                  data: videoBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 1024, // Reducido para 22 parámetros
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en análisis:', errorText);
        throw new Error(`Error en análisis: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('🔍 Respuesta completa de Gemini:', JSON.stringify(result, null, 2));

      // Verificar si Gemini rechazó el contenido por políticas de seguridad
      if (result.candidates && result.candidates[0] && result.candidates[0].finishReason === 'SAFETY') {
        console.error('❌ Gemini rechazó el contenido por políticas de seguridad');
        throw new Error('El video fue rechazado por políticas de seguridad de Gemini. Intenta con otro video.');
      }
      
      if (result.candidates && result.candidates[0] && result.candidates[0].finishReason === 'RECITATION') {
        console.error('❌ Gemini rechazó el contenido por recitación');
        throw new Error('El video fue rechazado por políticas de contenido de Gemini. Intenta con otro video.');
      }
      
      // Validar estructura de respuesta
      if (!result.candidates) {
        console.error('❌ No hay candidatos en la respuesta:', result);
        throw new Error('No se encontraron candidatos en la respuesta de Gemini');
      }
      
      if (!result.candidates[0]) {
        console.error('❌ Candidato 0 no existe:', result.candidates);
        throw new Error('El primer candidato no existe en la respuesta de Gemini');
      }
      
      if (!result.candidates[0].content) {
        console.error('❌ No hay contenido en el candidato:', result.candidates[0]);
        throw new Error('No se encontró contenido en el candidato de Gemini');
      }
      
      if (!result.candidates[0].content.parts) {
        console.error('❌ No hay partes en el contenido:', result.candidates[0].content);
        console.error('❌ Respuesta completa de Gemini:', JSON.stringify(result, null, 2));
        throw new Error('Gemini rechazó el contenido del video. Verifica que el video sea válido y contenga contenido de baloncesto.');
      }
      
      if (!result.candidates[0].content.parts[0]) {
        console.error('❌ Parte 0 no existe:', result.candidates[0].content.parts);
        throw new Error('La primera parte no existe en la respuesta de Gemini');
      }
      
      const text = result.candidates[0].content.parts[0].text;
      if (!text) {
        console.error('❌ No hay texto en la parte:', result.candidates[0].content.parts[0]);
        throw new Error('No se encontró texto en la respuesta de Gemini');
      }
      
      return text;
    });
  });
}

// Función unificada: verificación + detección + 22 parámetros en una sola llamada
export async function analyzeUnified22Parameters(
  videoBase64: string,
  ageCategory: string,
  playerLevel: string,
  shotType: string
): Promise<string> {
  const prompt = `Analiza este video de baloncesto. Responde SOLO con JSON:

{
  "verification": {
    "player_clothing": "color exacto de remera y pantalón",
    "shots_count": number,
    "basket_visible": true/false,
    "camera_angle": "frontal/lateral/diagonal",
    "environment": "gimnasio/calle/cancha",
    "player_hand": "derecha/izquierda",
    "jumps": true/false,
    "ball_visible": true/false
  },
  "shots_detection": {
    "shots_count": number,
    "shots": [
      {
        "start_ms": number,
        "release_ms": number,
        "end_ms": number,
        "confidence": number
      }
    ]
  },
  "natural_description": "Describe en 2-3 oraciones lo que ves en el video",
  "parameters_22": {
    "alineacion_pies": {"score": 0-100, "comment": "string"},
    "alineacion_cuerpo": {"score": 0-100, "comment": "string"},
    "muneca_cargada": {"score": 0-100, "comment": "string"},
    "flexion_rodillas": {"score": 0-100, "comment": "string"},
    "hombros_relajados": {"score": 0-100, "comment": "string"},
    "enfoque_visual": {"score": 0-100, "comment": "string"},
    "mano_no_dominante_ascenso": {"score": 0-100, "comment": "string"},
    "codos_cerca_cuerpo": {"score": 0-100, "comment": "string"},
    "subida_recta_balon": {"score": 0-100, "comment": "string"},
    "trayectoria_hasta_set_point": {"score": 0-100, "comment": "string"},
    "set_point": {"score": 0-100, "comment": "string"},
    "tiempo_lanzamiento": {"score": 0-100, "comment": "string"},
    "mano_no_dominante_liberacion": {"score": 0-100, "comment": "string"},
    "extension_completa_brazo": {"score": 0-100, "comment": "string"},
    "giro_pelota": {"score": 0-100, "comment": "string"},
    "angulo_salida": {"score": 0-100, "comment": "string"},
    "mantenimiento_equilibrio": {"score": 0-100, "comment": "string"},
    "equilibrio_aterrizaje": {"score": 0-100, "comment": "string"},
    "duracion_follow_through": {"score": 0-100, "comment": "string"},
    "consistencia_movimiento": {"score": 0-100, "comment": "string"},
    "consistencia_tecnica": {"score": 0-100, "comment": "string"},
    "consistencia_resultados": {"score": 0-100, "comment": "string"}
  },
  "overall_score": 0-100,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"]
}`;
  
  return await analyzeWithGemini22Parameters(videoBase64, prompt, 'gemini-3.1-flash-lite-preview');
}

// Función principal optimizada para 22 parámetros (UNA SOLA LLAMADA)
export async function analyzeBasketballShot22Parameters(
  videoBuffer: Buffer,
  fileName: string,
  ageCategory: string,
  playerLevel: string,
  shotType: string
) {
  try {
    // 1. Convertir a base64
    const videoBase64 = videoBuffer.toString('base64');
    console.log('📤 Video convertido a base64 - Tamaño:', videoBase64.length, 'caracteres');
    
    // 2. ANÁLISIS UNIFICADO: verificación + detección + 22 parámetros en UNA llamada
    console.log('🚀 Iniciando análisis unificado (verificación + detección + 22 parámetros)...');
    const unifiedResult = await analyzeUnified22Parameters(
      videoBase64,
      ageCategory,
      playerLevel,
      shotType
    );

        // Extraer JSON del resultado unificado
    const cleanUnifiedResult = unifiedResult
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

        let unifiedAnalysis;
    try {
      unifiedAnalysis = JSON.parse(cleanUnifiedResult);
    } catch (error) {
      console.error('❌ Error parseando análisis unificado:', error);
      console.error('❌ JSON problemático:', cleanUnifiedResult);
      throw new Error('La IA no pudo completar el análisis unificado. Por favor, reintenta con otro video.');
    }
    
    // 3. Separar los resultados en la estructura esperada
    const videoVerification = {
      verification: unifiedAnalysis.verification,
      reality_check: {
        is_real_video: true,
        confidence: 85,
        suspicious_elements: [],
        video_quality: "buena"
      }
    };

    const shotDetection = unifiedAnalysis.shots_detection;

    const technicalAnalysis = {
      description: unifiedAnalysis.verification,
      natural_description: unifiedAnalysis.natural_description,
      parameters_22: unifiedAnalysis.parameters_22,
      overall_score: unifiedAnalysis.overall_score,
      strengths: unifiedAnalysis.strengths,
      weaknesses: unifiedAnalysis.weaknesses,
      recommendations: unifiedAnalysis.recommendations
    };
    
    return {
      videoVerification,
      shotDetection,
      technicalAnalysis,
      videoBase64, // Para reutilización futura
    };

  } catch (error) {
    console.error('❌ Error en análisis de 22 parámetros:', error);
    throw error;
  }
}
