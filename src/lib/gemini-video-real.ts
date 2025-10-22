import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { analyzeVideoSingleCall } from '@/utils/gemini-single-call';

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '');

// Schema para verificación de video real
const VideoRealVerificationSchema = z.object({
  videoInfo: z.object({
    duration: z.string(),
    fps: z.number(),
    resolution: z.string(),
    optimizedSize: z.string(),
    originalSize: z.string().optional(),
    reduction: z.string().optional(),
  }),
  verification: z.object({
    isReal: z.boolean(),
    confidence: z.number(),
    description: z.string(),
  }),
  shotDetection: z.object({
    shotsCount: z.number(),
    shots: z.array(z.object({
      startTime: z.number(),
      endTime: z.number(),
      confidence: z.number(),
      description: z.string(),
      keyframes: z.array(z.object({
        timestamp: z.number(),
        description: z.string(),
        importance: z.string(),
      })).optional(),
    })),
  }),
  details: z.object({
    colors: z.string(),
    objects: z.string(),
    actions: z.string(),
    environment: z.string(),
  }),
  technicalAnalysis: z.object({
    parameters: z.array(z.any()), // Cambiado a z.any() para ser más flexible
    overallScore: z.number(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    recommendations: z.array(z.string()),
  }).optional(),
});

export async function analyzeVideoReal(videoBuffer1: Buffer, fileName1: string, videoBuffer2?: Buffer, fileName2?: string, videoBuffer3?: Buffer, fileName3?: string) {
  try {
        // 1. PREPROCESAMIENTO DE VIDEOS
    console.log('⚙️ Preprocesando video 1...');
    const { optimizedVideo: optimizedVideo1, videoInfo: videoInfo1 } = await preprocessVideo(videoBuffer1, fileName1);
    
    let optimizedVideo2: Buffer | undefined;
    let videoInfo2: any;
    
    if (videoBuffer2 && fileName2) {
      console.log('⚙️ Preprocesando video 2...');
      const result2 = await preprocessVideo(videoBuffer2, fileName2);
      optimizedVideo2 = result2.optimizedVideo;
      videoInfo2 = result2.videoInfo;
    }
    
    let optimizedVideo3: Buffer | undefined;
    let videoInfo3: any;
    
    if (videoBuffer3 && fileName3) {
      console.log('⚙️ Preprocesando video 3...');
      const result3 = await preprocessVideo(videoBuffer3, fileName3);
      optimizedVideo3 = result3.optimizedVideo;
      videoInfo3 = result3.videoInfo;
    }
    
    // 2. ANÁLISIS ÚNICO CON GEMINI (1 LLAMADA CON RETRY)
    console.log('🤖 Analizando con Gemini (1 llamada única)...');
    const base64Video1 = optimizedVideo1.toString('base64');
    const base64Video2 = optimizedVideo2 ? optimizedVideo2.toString('base64') : undefined;
    const base64Video3 = optimizedVideo3 ? optimizedVideo3.toString('base64') : undefined;
    
    const analysisResult = await analyzeVideoSingleCall(base64Video1, base64Video2, base64Video3);
    
    // 3. AGREGAR INFORMACIÓN DE OPTIMIZACIÓN
    return {
      ...analysisResult,
      videoInfo: {
        ...analysisResult.videoInfo,
        ...videoInfo1,
        ...(videoInfo2 && { video2: videoInfo2 }),
        ...(videoInfo3 && { video3: videoInfo3 })
      }
    };
    
  } catch (error) {
    console.error('❌ Error en análisis de video real:', error);
    throw error;
  }
}

export async function preprocessVideo(videoBuffer: Buffer, fileName: string): Promise<{ optimizedVideo: Buffer, videoInfo: any }> {
  console.log('📹 Video original:', {
    size: (videoBuffer.length / 1024 / 1024).toFixed(2) + ' MB',
    fileName
  });

  try {
    // Crear archivo temporal
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Usar directorio temporal del sistema si es posible
    const tempDir = process.env.TEMP || process.env.TMP || path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
      } catch (error) {
        console.warn('⚠️ No se pudo crear directorio temporal, usando directorio actual:', error.message);
        return { optimizedVideo: videoBuffer, videoInfo: { format: { duration: "10.0" } } };
      }
    }

    const inputPath = path.join(tempDir, `input_${Date.now()}.mp4`);
    const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);

    // Guardar video temporal
    console.log('🔍 Debug - Guardando video temporal:', {
      inputPath,
      bufferSize: videoBuffer.length,
      bufferSizeMB: (videoBuffer.length / 1024 / 1024).toFixed(2) + ' MB'
    });
    
    fs.writeFileSync(inputPath, videoBuffer);
    
    // Verificar que el archivo se guardó correctamente
    const stats = fs.statSync(inputPath);
    console.log('🔍 Debug - Archivo temporal guardado:', {
      path: inputPath,
      size: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2) + ' MB'
    });

    console.log('⚙️ Optimizando video con FFmpeg...');
    
    // Comando FFmpeg para optimización ULTRA (10s, 4 FPS, 360p)
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -t 10 -r 4 -vf "scale=360:-1" -c:v libx264 -preset fast -crf 30 -c:a aac -b:a 32k -movflags +faststart "${outputPath}" -y`;
    
    try {
      await execAsync(ffmpegCommand);
    } catch (ffmpegError) {
      console.warn('⚠️ FFmpeg no disponible, usando video original:', ffmpegError.message);
      // Si FFmpeg falla, usar el video original sin optimizar
      fs.copyFileSync(inputPath, outputPath);
    }

    // Leer video optimizado
    const optimizedBuffer = fs.readFileSync(outputPath);
    
    // Obtener información del video optimizado
    let videoInfo;
    try {
      const infoCommand = `ffprobe -v quiet -print_format json -show_format -show_streams "${outputPath}"`;
      const { stdout: infoOutput } = await execAsync(infoCommand);
      videoInfo = JSON.parse(infoOutput);
    } catch (ffprobeError) {
      console.warn('⚠️ FFprobe no disponible, usando información básica:', ffprobeError.message);
      // Información básica si FFprobe no está disponible
      videoInfo = {
        format: {
          duration: "10.0",
          size: optimizedBuffer.length.toString()
        },
        streams: [{
          width: 360,
          height: 240,
          r_frame_rate: "4/1"
        }]
      };
    }

    // Limpiar archivos temporales
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (cleanupError) {
      console.warn('⚠️ Error limpiando archivos temporales:', cleanupError);
    }

    const optimizedSize = (optimizedBuffer.length / 1024 / 1024).toFixed(2);
    const originalSize = (videoBuffer.length / 1024 / 1024).toFixed(2);
    
    console.log('✅ Video optimizado:', {
      originalSize: originalSize + ' MB',
      optimizedSize: optimizedSize + ' MB',
      reduction: ((1 - optimizedBuffer.length / videoBuffer.length) * 100).toFixed(1) + '%'
    });

    return {
      optimizedVideo: optimizedBuffer,
      videoInfo: {
        duration: videoInfo.format.duration || '10s',
        fps: 4,
        resolution: '360p',
        optimizedSize: optimizedSize + ' MB',
        originalSize: originalSize + ' MB',
        reduction: ((1 - optimizedBuffer.length / videoBuffer.length) * 100).toFixed(1) + '%'
      }
    };

  } catch (error) {
    console.error('❌ Error en preprocesamiento:', error);
    console.log('🔄 Usando video original como fallback...');
    
    return {
      optimizedVideo: videoBuffer,
      videoInfo: {
        duration: 'original',
        fps: 30,
        resolution: 'original',
        optimizedSize: (videoBuffer.length / 1024 / 1024).toFixed(2) + ' MB',
        originalSize: (videoBuffer.length / 1024 / 1024).toFixed(2) + ' MB',
        reduction: '0%'
      }
    };
  }
}

async function detectShots(videoBuffer: Buffer) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.1,
    }
  });

  const base64Video = videoBuffer.toString('base64');
  
  const prompt = `
Analiza este video de baloncesto y detecta TODOS los tiros que realiza el jugador.

Un TIRO es cuando el jugador:
- Tiene el balón en las manos
- Se prepara para lanzar (flexiona rodillas, alinea cuerpo)
- Lanza el balón hacia la canasta
- Sigue con el movimiento de tiro

NO es tiro:
- Dribbling
- Pases
- Movimientos de preparación sin lanzar

Responde SOLO con JSON válido:
{
  "shotsCount": 2,
  "shots": [
    {
      "startTime": 1.5,
      "endTime": 3.2,
      "confidence": 90,
      "description": "Tiro libre desde la línea"
    },
    {
      "startTime": 5.0,
      "endTime": 6.8,
      "confidence": 85,
      "description": "Tiro de media distancia"
    }
  ]
}

IMPORTANTE: Si no ves tiros claros, pon shotsCount: 0 y shots: []
`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Video,
          mimeType: 'video/mp4'
        }
      },
      prompt
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('🎯 Detección de tiros:', text.substring(0, 200) + '...');
    
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try {
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ Error parseando JSON de detección:', parseError);
      console.error('❌ Texto que causó el error:', cleanText);
      return {
        shotsCount: 0,
        shots: []
      };
    }
    
  } catch (error) {
    console.error('❌ Error en detección de tiros:', error);
    return {
      shotsCount: 0,
      shots: []
    };
  }
}

async function extractKeyframes(videoBuffer: Buffer, shotDetection: any) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.1,
    }
  });

  const base64Video = videoBuffer.toString('base64');
  
  const prompt = `
Extrae keyframes importantes de los tiros de baloncesto.

Responde SOLO con JSON válido:
{
  "keyframes": [
    [
      {
        "timestamp": 2.5,
        "description": "Inicio del tiro",
        "importance": "crítico"
      },
      {
        "timestamp": 3.2,
        "description": "Preparación",
        "importance": "crítico"
      },
      {
        "timestamp": 3.8,
        "description": "Liberación",
        "importance": "crítico"
      }
    ]
  ]
}

Solo extrae keyframes de tiros reales.
`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Video,
          mimeType: 'video/mp4'
        }
      },
      prompt
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('🖼️ Extracción de keyframes:', text.substring(0, 200) + '...');
    
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try {
      const parsed = JSON.parse(cleanText);
      return parsed.keyframes || [];
    } catch (parseError) {
      console.error('❌ Error parseando JSON de keyframes:', parseError);
      console.error('❌ Texto que causó el error:', cleanText);
      return [];
    }
    
  } catch (error) {
    console.error('❌ Error en extracción de keyframes:', error);
    return [];
  }
}

async function analyzeTechnicalDetails(videoBuffer: Buffer, shotDetection: any, keyframes: any) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.1,
    }
  });

  const base64Video = videoBuffer.toString('base64');
  
  const prompt = `
Evalúa la técnica de tiro de baloncesto en este video.

🔧 PROMPT ACTUALIZADO - VERSIÓN CORREGIDA PARA EQUILIBRIO 🔧

CRITERIOS ESPECÍFICOS PARA EQUILIBRIO:
- 1-2 Incorrecto: Aterrizaje claramente desparejo (un pie adelantado, cuerpo girando, pérdida de alineación)
- 3 Mejorable: Aterrizaje controlado pero con pequeñas desalineaciones (pies casi alineados, cuerpo estable)
- 4-5 Correcto: Aterrizaje equilibrado (ambos pies alineados, cuerpo sin giros, distribución equilibrada)

OBSERVA ESPECÍFICAMENTE:
- ¿Aterriza con ambos pies alineados o uno adelantado?
- ¿El cuerpo gira o se mantiene estable durante el aterrizaje?
- ¿El peso se distribuye equilibradamente entre ambos pies?

Responde SOLO con JSON válido:
{
  "parameters": [
    {"name": "Alineación de pies", "score": 85, "status": "Correcto", "comment": "Pies bien alineados"},
    {"name": "Alineación del cuerpo", "score": 70, "status": "Mejorable", "comment": "Cuerpo desalineado"},
    {"name": "Muñeca cargada", "score": 80, "status": "Correcto", "comment": "Buena posición"},
    {"name": "Flexión de rodillas", "score": 75, "status": "Mejorable", "comment": "Flexión insuficiente"},
    {"name": "Hombros relajados", "score": 90, "status": "Correcto", "comment": "Hombros relajados"},
    {"name": "Enfoque visual", "score": 85, "status": "Correcto", "comment": "Buen enfoque"},
    {"name": "Mano no dominante", "score": 70, "status": "Mejorable", "comment": "Interfiere en el tiro"},
    {"name": "Codos cerca del cuerpo", "score": 80, "status": "Correcto", "comment": "Buena posición"},
    {"name": "Subida recta del balón", "score": 75, "status": "Mejorable", "comment": "Trayectoria irregular"},
    {"name": "Trayectoria hasta set point", "score": 80, "status": "Correcto", "comment": "Buena trayectoria"},
    {"name": "Set point", "score": 85, "status": "Correcto", "comment": "Posición correcta"},
    {"name": "Tiempo de lanzamiento", "score": 70, "status": "Mejorable", "comment": "Muy lento"},
    {"name": "Mano no dominante liberación", "score": 75, "status": "Mejorable", "comment": "Interfiere"},
    {"name": "Extensión completa del brazo", "score": 90, "status": "Correcto", "comment": "Excelente extensión"},
    {"name": "Giro de la pelota", "score": 60, "status": "Incorrecto", "comment": "Falta backspin"},
    {"name": "Ángulo de salida", "score": 80, "status": "Correcto", "comment": "Buen ángulo"},
    {"name": "Equilibrio general", "score": 85, "status": "Correcto", "comment": "Aterrizaje equilibrado con ambos pies alineados, sin giros corporales"},
    {"name": "Duración del follow-through", "score": 75, "status": "Mejorable", "comment": "Follow through corto"},
    {"name": "Consistencia general", "score": 70, "status": "Mejorable", "comment": "Movimiento y técnica inconsistentes"},
    {"name": "Consistencia de resultados", "score": 80, "status": "Correcto", "comment": "Resultados consistentes"}
  ],
  "overallScore": 78,
  "strengths": ["Buen equilibrio", "Extensión completa", "Enfoque visual"],
  "weaknesses": ["Tiempo lento", "Falta backspin", "Follow through corto"],
  "recommendations": ["Mejorar velocidad", "Practicar giro", "Extender follow through"]
}

IMPORTANTE: Cada parámetro debe ser un objeto con name, score, status y comment.
`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Video,
          mimeType: 'video/mp4'
        }
      },
      prompt
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('🔬 Análisis técnico:', text.substring(0, 200) + '...');
    
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try {
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ Error parseando JSON de análisis técnico:', parseError);
      console.error('❌ Texto que causó el error:', cleanText);
      return {
        parameters: [],
        overallScore: 0,
        strengths: [],
        weaknesses: [],
        recommendations: []
      };
    }
    
  } catch (error) {
    console.error('❌ Error en análisis técnico:', error);
    return {
      parameters: [],
      overallScore: 0,
      strengths: [],
      weaknesses: [],
      recommendations: []
    };
  }
}

async function analyzeWithGemini(videoBuffer: Buffer, shotDetection: any, keyframes: any, technicalAnalysis: any) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.1,
    }
  });

  // Convertir a base64
  const base64Video = videoBuffer.toString('base64');
  
  // Prompt final simplificado
  const prompt = `
Analiza este video de baloncesto y describe lo que ves.

Responde SOLO con JSON válido:
{
  "videoInfo": {
    "duration": "15s",
    "fps": 6,
    "resolution": "480p",
    "optimizedSize": "2MB"
  },
  "verification": {
    "isReal": true,
    "confidence": 95,
    "description": "Video real de baloncesto"
  },
  "shotDetection": {
    "shotsCount": ${shotDetection.shotsCount || 0},
    "shots": ${JSON.stringify(shotDetection.shots || [])}
  },
  "details": {
    "colors": "Describe los colores que ves",
    "objects": "Describe los objetos visibles",
    "actions": "Describe las acciones del jugador",
    "environment": "Describe el entorno"
  },
  "technicalAnalysis": {
    "parameters": ${JSON.stringify(technicalAnalysis.parameters || [])},
    "overallScore": ${technicalAnalysis.overallScore || 0},
    "strengths": ${JSON.stringify(technicalAnalysis.strengths || [])},
    "weaknesses": ${JSON.stringify(technicalAnalysis.weaknesses || [])},
    "recommendations": ${JSON.stringify(technicalAnalysis.recommendations || [])}
  }
}

Describe solo lo que ves en el video.
`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Video,
          mimeType: 'video/mp4'
        }
      },
      prompt
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('🤖 Respuesta de Gemini:', text.substring(0, 200) + '...');
    
    // Limpiar respuesta de markdown si existe
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('🤖 Respuesta limpia de Gemini:', cleanText);
    
    try {
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ Error parseando JSON de Gemini:', parseError);
      console.error('❌ Texto que causó el error:', cleanText);
      throw new Error(`Error parseando respuesta de Gemini: ${parseError instanceof Error ? parseError.message : 'Error desconocido'}`);
    }
    
  } catch (error) {
    console.error('❌ Error en Gemini:', error);
    throw new Error(`Error en análisis de Gemini: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
