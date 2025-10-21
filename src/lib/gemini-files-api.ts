import Bottleneck from 'bottleneck';

// Configuración de rate limiting
const limiter = new Bottleneck({
  minTime: Math.ceil(60_000 / 8) // 8 req/min
});

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
      delay = Math.min(delay * 2, 30_000);
    }
  }
  throw new Error('Se alcanzó el máximo de reintentos tras 429');
}

// Función para subir archivo a Gemini Files API
export async function uploadToFilesAPI(
  videoBuffer: Buffer,
  fileName: string,
  mimeType: string = 'video/mp4'
): Promise<string> {
  return await limiter.schedule(async () => {
    return await withBackoff(async () => {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY no configurada');
      }

      console.log('📤 Subiendo archivo a Gemini Files API...');

      // Crear el boundary para multipart
      const boundary = '----formdata-boundary-' + Math.random().toString(36).substring(2);
      
      // Crear el cuerpo multipart manualmente
      const metadata = {
        file: {
          displayName: fileName
        }
      };

      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="metadata"\r\n`),
        Buffer.from(`Content-Type: application/json\r\n\r\n`),
        Buffer.from(JSON.stringify(metadata)),
        Buffer.from(`\r\n--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`),
        Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
        videoBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const response = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error subiendo archivo:', errorText);
        throw new Error(`Error subiendo archivo: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
            // Esperar a que el archivo esté ACTIVE
      const fileUri = result.file.uri;
      console.log('⏳ Esperando que el archivo esté ACTIVE...');
      
      await waitForFileActive(fileUri, apiKey);
      
            return fileUri;
    });
  });
}

// Función para esperar que el archivo esté ACTIVE
async function waitForFileActive(fileUri: string, apiKey: string, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${fileUri}?key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`Error verificando estado del archivo: ${response.status}`);
    }
    
    const fileInfo = await response.json();
    console.log(`📋 Estado del archivo (intento ${i + 1}):`, fileInfo.state);
    
    if (fileInfo.state === 'ACTIVE') {
      return fileInfo;
    }
    
    if (fileInfo.state === 'FAILED') {
      throw new Error('El archivo falló al procesarse');
    }
    
    // Esperar 2 segundos antes del siguiente intento
    await new Promise(r => setTimeout(r, 2000));
  }
  
  throw new Error('Timeout esperando que el archivo esté ACTIVE');
}

// Función para análisis usando Files API
export async function analyzeWithFilesAPI(
  fileUri: string,
  prompt: string,
  model: 'gemini-2.0-flash-lite' | 'gemini-2.5-flash' = 'gemini-2.5-flash'
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
                file_data: {
                  mime_type: 'video/mp4',
                  file_uri: fileUri
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
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

      // Verificar si Gemini rechazó el contenido
      if (result.candidates && result.candidates[0] && result.candidates[0].finishReason === 'SAFETY') {
        console.error('❌ Gemini rechazó el contenido por políticas de seguridad');
        throw new Error('El video fue rechazado por políticas de seguridad de Gemini. Intenta con otro video.');
      }
      
      if (result.candidates && result.candidates[0] && result.candidates[0].finishReason === 'RECITATION') {
        console.error('❌ Gemini rechazó el contenido por recitación');
        throw new Error('El video fue rechazado por políticas de contenido de Gemini. Intenta con otro video.');
      }
      
      // Validar estructura de respuesta
      if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts) {
        console.error('❌ No hay partes en el contenido:', result.candidates?.[0]?.content);
        console.error('❌ Respuesta completa de Gemini:', JSON.stringify(result, null, 2));
        throw new Error('Gemini rechazó el contenido del video. Verifica que el video sea válido y contenga contenido de baloncesto.');
      }
      
      const text = result.candidates[0].content.parts[0].text;
      if (!text) {
        console.error('❌ No hay texto en la respuesta');
        throw new Error('No se encontró texto en la respuesta de Gemini');
      }
      
      return text;
    });
  });
}

// Función principal optimizada con Files API
export async function analyzeBasketballShotWithFilesAPI(
  videoBuffer: Buffer,
  fileName: string,
  ageCategory: string,
  playerLevel: string,
  shotType: string
) {
  try {
    // 1. Subir archivo a Files API
    console.log('📤 Subiendo video a Gemini Files API...');
    const fileUri = await uploadToFilesAPI(videoBuffer, fileName);
    
    // 2. Análisis unificado con Files API
        const prompt = `VERIFICACIÓN ESTRICTA: Describe EXACTAMENTE lo que ves en este video. Si no ves algo claramente, di "no visible". Responde SOLO con JSON:

{
  "verification": {
    "player_clothing": "color EXACTO de remera y pantalón con detalles de ribetes",
    "shots_count": "número REAL de tiros que ves",
    "basket_visible": true/false,
    "camera_angle": "frontal/lateral/diagonal",
    "environment": "gimnasio/calle/cancha",
    "specific_colors": "colores específicos que ves",
    "ribets_details": "detalles de ribetes o líneas en la ropa"
  },
  "reality_check": {
    "is_analyzing_real_video": true/false,
    "confidence": 0-100,
    "video_quality": "buena/media/mala"
  },
  "natural_description": "Descripción EXACTA de lo que ves en 2 oraciones"
}`;

    const analysisResult = await analyzeWithFilesAPI(fileUri, prompt, 'gemini-2.0-flash-lite');
    
        // Extraer JSON del resultado
    const cleanResult = analysisResult
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(cleanResult);
    } catch (error) {
      console.error('❌ Error parseando análisis:', error);
      console.error('❌ JSON problemático:', cleanResult);
      throw new Error('La IA no pudo completar el análisis. Por favor, reintenta con otro video.');
    }
    
    // Filtrar videoBase64 si existe
    const { videoBase64, ...cleanAnalysis } = analysis;
    
    return {
      shotDetection: {
        shots_count: cleanAnalysis.description?.shots_count || 1,
        shots: [{
          start_ms: 1000,
          release_ms: 2500,
          end_ms: 3000,
          confidence: 0.8
        }]
      },
      technicalAnalysis: cleanAnalysis,
      fileUri, // Para reutilización futura
    };

  } catch (error) {
    console.error('❌ Error en análisis con Files API:', error);
    throw error;
  }
}
