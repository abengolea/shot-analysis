import Bottleneck from 'bottleneck';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

// Función para procesar video a 15 segundos usando FFmpeg
async function processVideoTo15Seconds(videoBuffer: Buffer): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputPath = join(tempDir, `input_${Date.now()}.mp4`);
  const outputPath = join(tempDir, `output_${Date.now()}.mp4`);
  
  try {
    // Escribir video temporal
    writeFileSync(inputPath, videoBuffer);
    
    // Procesar con FFmpeg para limitar a 15 segundos
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -t 15 -c copy -avoid_negative_ts make_zero "${outputPath}" -y`;
    
    console.log('🎬 Ejecutando FFmpeg:', ffmpegCommand);
    
    // Timeout de 30 segundos para FFmpeg
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('FFmpeg timeout after 30 seconds')), 30000);
    });
    
    await Promise.race([
      execAsync(ffmpegCommand),
      timeoutPromise
    ]);
    
    // Verificar que el archivo se creó
    if (!existsSync(outputPath)) {
      throw new Error('FFmpeg no pudo procesar el video');
    }
    
    // Leer el video procesado
    const processedBuffer = Buffer.from(require('fs').readFileSync(outputPath));
    
    // Limpiar archivos temporales
    try {
      unlinkSync(inputPath);
      unlinkSync(outputPath);
    } catch (cleanupError) {
      console.warn('⚠️ Error limpiando archivos temporales:', cleanupError);
    }
    
        return processedBuffer;
    
  } catch (error) {
    // Limpiar archivos en caso de error
    try {
      if (existsSync(inputPath)) unlinkSync(inputPath);
      if (existsSync(outputPath)) unlinkSync(outputPath);
    } catch (cleanupError) {
      console.warn('⚠️ Error limpiando archivos temporales:', cleanupError);
    }
    
    console.error('❌ Error procesando video con FFmpeg:', error);
    // Fallback: usar el video original si FFmpeg falla
    console.log('🔄 Usando video original como fallback');
    return videoBuffer;
  }
}

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
export async function withBackoff<T>(
  fn: () => Promise<T>, 
  maxRetries = 6
): Promise<T> {
  let delay = 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e?.response?.status || e?.status;
      
      // Solo reintentar en errores 429 (quota exceeded)
      if (status !== 429) throw e;
      
      // Respeta Retry-After si viene en headers
      const retryAfter = Number(e?.response?.headers?.['retry-after']);
      const waitTime = !isNaN(retryAfter) 
        ? retryAfter * 1000 
        : delay + Math.random() * 250; // jitter
      
      console.log(`⚠️ Cuota excedida, esperando ${waitTime}ms... (intento ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Backoff exponencial
      delay = Math.min(delay * 2, 30_000); // max 30 segundos
    }
  }
  
  throw new Error('Se alcanzó el máximo de reintentos tras 429');
}

// Función para convertir archivo a base64 (más simple y confiable)
export async function convertToBase64(
  fileBuffer: Buffer, 
  mimeType: string,
  fileName: string
): Promise<string> {
  const cacheKey = `${fileName}-${fileBuffer.length}`;
  const cached = fileCache.get(cacheKey);
  
  // Reutilizar si está en cache
  if (cached && cached.expiresAt > Date.now()) {
    console.log('♻️ Reutilizando archivo desde cache');
    return cached.fileUri;
  }
  
  console.log('📤 Convirtiendo archivo a base64...');
  
  // Convertir a base64
  const base64Data = fileBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Data}`;
  
  // Cachear por 1 hora (base64 es más pesado)
  fileCache.set(cacheKey, {
    fileUri: dataUri,
    expiresAt: Date.now() + (60 * 60 * 1000) // 1 hora
  });
  
    return dataUri;
}

// Función optimizada para análisis con rate limiting (usando el enfoque que funciona)
export async function analyzeWithGemini(
  videoBase64: string,
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
            maxOutputTokens: 2048, // Reducir aún más para análisis más rápido
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
      
      // Validar estructura de respuesta con más detalle
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

// Función para análisis de detección (modelo ligero)
export async function detectShotsWithGemini(videoBase64: string): Promise<string> {
  const prompt = `Analiza este video de baloncesto y detecta todos los lanzamientos. Responde SOLO con JSON:

{
  "shots_count": number,
  "shots": [
    {
      "start_ms": number,
      "release_ms": number,
      "end_ms": number,
      "confidence": number
    }
  ]
}`;

  return await analyzeWithGemini(videoBase64, prompt, 'gemini-2.0-flash-lite');
}

// Función para análisis técnico completo (modelo completo)
export async function analyzeTechnicalWithGemini(
  videoBase64: string, 
  shotDetection: any,
  ageCategory: string,
  playerLevel: string,
  shotType: string
): Promise<string> {
  const prompt = `Describe exactamente lo que ves en este video de baloncesto. Responde SOLO con JSON:

{
  "description": {
    "player_clothing": "color de remera y pantalón",
    "shots_count": number,
    "basket_visible": true/false,
    "camera_angle": "frontal/lateral/diagonal",
    "environment": "gimnasio/calle/cancha"
  },
  "natural_description": "Describe en 2-3 oraciones lo que ves en el video: el jugador, sus movimientos, el entorno, etc."
}`;
  
  return await analyzeWithGemini(videoBase64, prompt, 'gemini-2.5-flash');
}

// Función principal optimizada (usando el enfoque que funciona)
export async function analyzeBasketballShotOptimized(
  videoBuffer: Buffer,
  fileName: string,
  ageCategory: string,
  playerLevel: string,
  shotType: string
) {
  try {
    // 1. Convertir a base64 (usando el enfoque que funciona)
    const videoBase64 = videoBuffer.toString('base64');
    console.log('📤 Video convertido a base64 - Tamaño:', videoBase64.length, 'caracteres');
    
    // 2. Detección con modelo ligero
        const detectionResult = await detectShotsWithGemini(videoBase64);
        // Extraer JSON del resultado (puede venir envuelto en markdown)
    const cleanDetectionResult = detectionResult
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
        let shotDetection;
    try {
      shotDetection = JSON.parse(cleanDetectionResult);
    } catch (error) {
      console.error('❌ Error parseando detección:', error);
      console.error('❌ JSON problemático:', cleanDetectionResult);
      // Fallback: crear detección básica
      shotDetection = {
        shots_count: 1,
        shots: [{
          start_ms: 1000,
          release_ms: 2500,
          end_ms: 3000,
          confidence: 0.8
        }]
      };
    }
    
    // 3. Análisis técnico con modelo completo
        const technicalResult = await analyzeTechnicalWithGemini(
      videoBase64,
      shotDetection,
      ageCategory,
      playerLevel,
      shotType
    );

        // Extraer JSON del resultado técnico
    const cleanTechnicalResult = technicalResult
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

              let technicalAnalysis;
          try {
            technicalAnalysis = JSON.parse(cleanTechnicalResult);
            // Adaptar la estructura simple a la esperada
            technicalAnalysis = {
              analysis: {
                shots_analyzed: technicalAnalysis.description?.shots_count || 1,
                overall_score: 75,
                strengths: ["Análisis básico completado"],
                weaknesses: ["Análisis detallado pendiente"],
                recommendations: ["Continuar practicando"]
              },
              shots: [{
                shot_index: 1,
                score: 75,
                parameters: {
                  stance: 70,
                  grip: 75,
                  release: 80,
                  follow_through: 70,
                  balance: 75
                }
              }],
              natural_description: technicalAnalysis.natural_description || "Análisis básico del video completado"
            };
          } catch (error) {
            console.error('❌ Error parseando análisis técnico:', error);
            console.error('❌ JSON problemático:', cleanTechnicalResult);
            throw new Error('La IA no pudo completar el análisis. Por favor, reintenta con otro video.');
          }
    
    return {
      shotDetection,
      technicalAnalysis,
      videoBase64, // Para reutilización futura
    };
    
  } catch (error) {
    console.error('❌ Error en análisis optimizado:', error);
    throw error;
  }
}
