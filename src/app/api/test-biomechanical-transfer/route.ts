import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extractPosesFromFolder, calculateBiomechanicalAngles, FramePose as PoseFrame } from '@/lib/pose-detection';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  calculateDeterministicBiomech,
  calculateShoulderHipDistance,
  BiomechDeterministicOutput,
} from '@/lib/biomechanical-analysis';
import { Timeline, Keyframe, KeyframePose } from '@/lib/timeline-types';
import { adminDb } from '@/lib/firebase-admin';
import { Keypoint } from '@/lib/pose-detection';
import { generateRuleBasedFeedback } from '@/lib/feedback-rule-based';
import { createHash } from 'crypto';
import { detectCameraOrientation, getAnalysisCapabilities } from '@/lib/camera-orientation';

const execAsync = promisify(exec);

// ============================================================================
// CONSTANTES Y LÍMITES
// ============================================================================

const MAX_VIDEO_SIZE_MB = 120;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const ENABLE_VIDEO_DESCRIPTION = process.env.ENABLE_VIDEO_DESCRIPTION !== 'false';

interface HonestyGateResult {
  efficiencyIndex: number;
  fluidityScore: number | null;
  energyLeakPct: number | null;
  analysisComplete: boolean;
  segmentsDetected: number;
  banner: string | null;
}

function applyHonestyGate(
  sequence: BiomechDeterministicOutput['sequence'],
  metrics: BiomechDeterministicOutput['metrics'],
  efficiencyIndex: number
): HonestyGateResult {
  const detectedSegments = sequence.filter(seg => seg.status !== 'no_detectado' && seg.onsetMs !== null && seg.onsetMs !== undefined).length;
  const analysisComplete = detectedSegments >= 3;

  if (!analysisComplete) {
    return {
      efficiencyIndex: Math.min(efficiencyIndex, 40),
      fluidityScore: null,
      energyLeakPct: null,
      analysisComplete: false,
      segmentsDetected: detectedSegments,
      banner: 'Análisis incompleto: datos insuficientes para cadena cinética.',
    };
  }

  return {
    efficiencyIndex,
    fluidityScore: metrics.fluidityScore,
    energyLeakPct: metrics.energyLeakPct,
    analysisComplete: true,
    segmentsDetected: detectedSegments,
    banner: null,
  };
}

// ============================================================================
// SCHEMAS PARA LLM (solo coaching, no números)
// ============================================================================

const LlmCoachingInputSchema = z.object({
  videoUrl: z.string().describe('URL del video de tiro de baloncesto'),
  biomech: z.object({
    efficiencyIndex: z.number().describe('Índice de eficiencia de transferencia energética (0-100)'),
    sequence: z.array(z.object({
      segment: z.string().describe('Segmento corporal: piernas, cadera, tronco, brazo, muñeca, dedos'),
      onsetMs: z.number().optional().describe('Momento de activación en milisegundos desde el inicio (puede ser null si no detectado)'),
      order: z.number().optional().describe('Orden de activación (1=primero, 2=segundo, etc.)'),
      status: z.string().describe('Estado: correcto, mejorable, incorrecto, no_detectado'),
      delayMs: z.number().optional().describe('Retraso en milisegundos respecto al orden ideal'),
      peakVelMs: z.number().optional().describe('Momento de pico de velocidad en ms'),
    })).describe('Secuencia de activación de segmentos'),
    timing: z.object({
      setPointMs: z.number().nullable().optional().describe('Momento del set-point en ms'),
      releaseMs: z.number().nullable().optional().describe('Momento de liberación en ms'),
      releaseVsLegsMs: z.number().nullable().optional().describe('Diferencia entre release y t0 en ms'),
    }).describe('Análisis de timing'),
    metrics: z.object({
      fluidityScore: z.number().describe('Puntuación de fluidez (0-100)'),
      energyLeakPct: z.number().describe('Porcentaje de pérdidas de energía'),
      setPointScore: z.number().describe('Puntuación del set-point (0-100)'),
      sequenceDelayMs: z.number().describe('Retraso total en la secuencia en ms'),
    }).describe('Métricas biomecánicas'),
    formattedData: z.string().optional().describe('Datos formateados como string legible para el prompt'),
    jsonData: z.string().optional().describe('Datos en formato JSON serializado para el prompt'),
  }).describe('Resultados deterministas del análisis biomecánico'),
});

const LlmCoachingOutputSchema = z.object({
  feedback: z.object({
    errors: z.array(z.string()).describe('Errores detectados en lenguaje natural'),
    recommendations: z.array(z.string()).describe('Recomendaciones específicas'),
    strengths: z.array(z.string()).describe('Fortalezas identificadas'),
    coachMessages: z.array(z.string()).describe('Mensajes de coaching listos para UI'),
  }).refine(
    (fb) => fb.errors.length + fb.recommendations.length + fb.strengths.length + fb.coachMessages.length >= 1,
    {
      message: 'Debe haber al menos un ítem en feedback (errors, recommendations, strengths o coachMessages)',
    }
  ),
  labels: z.array(z.string()).optional().describe('Tags para UI'),
});

// Schema para descripción visual del video
const VideoDescriptionInputSchema = z.object({
  videoUrl: z.string().describe('URL del video de tiro de baloncesto'),
});

const VideoDescriptionOutputSchema = z.object({
  description: z.string().describe('Descripción detallada de lo que se ve en el video - SOLO lo que está realmente visible'),
  details: z.object({
    aroVisible: z.boolean().describe('Si se ve el aro/canasta - false si NO está visible en el video'),
    colorRemera: z.string().optional().describe('Color EXACTO de la remera/camiseta - usar "no visible" si no se puede determinar'),
    colorPantalon: z.string().optional().describe('Color EXACTO del pantalón - usar "no visible" si no se puede determinar'),
    entorno: z.string().describe('Tipo de entorno (gimnasio, cancha exterior, otro, indeterminado)'),
    iluminacion: z.string().optional().describe('Tipo de iluminación - usar "no se puede determinar" si no está claro'),
    calidadVideo: z.string().optional().describe('Calidad del video - usar "no se puede determinar" si no está claro'),
    otrosDetalles: z.string().optional().describe('Otros detalles visuales relevantes que REALMENTE ves'),
  }),
  isRealVideo: z.boolean().describe('Confirma que es un video real, no simulado'),
});

// Prompt especializado SOLO para coaching (no inventa números)
const biomechanicalCoachingPrompt = ai.definePrompt({
  name: 'biomechanicalCoachingPrompt',
  input: { schema: LlmCoachingInputSchema },
  output: { schema: LlmCoachingOutputSchema },
  prompt: `Eres un entrenador experto en biomecánica deportiva especializado en tiros de baloncesto.

🎯 TU TAREA:
Traducir los resultados técnicos del análisis biomecánico a mensajes de coaching claros y específicos.

⚠️ REGLA CRÍTICA:
NO INVENTES NÚMEROS. Los datos biomecánicos ya fueron calculados de forma determinista.
Tu trabajo es INTERPRETAR y EXPLICAR estos datos en lenguaje de coaching.

⚠️ REGLA CRÍTICA: NO INVENTES NÚMEROS. Usa EXCLUSIVAMENTE los valores del JSON estructurado.

DATOS BIOMECÁNICOS EN FORMATO JSON (FUENTE PRIMARIA - USA ESTOS NÚMEROS):
{{biomech.jsonData}}

DATOS FORMATADOS (SOLO COMO CONTEXTO LEGIBLE):
{{biomech.formattedData}}

INSTRUCCIONES DE USO:
- Lee los números del JSON estructurado arriba (jsonData)
- Usa formattedData solo como ayuda para entender el contexto
- NO recalcules tiempos ni métricas - usa los valores exactos del JSON

       ANÁLISIS DE LOS DATOS:

       ⚠️ REGLA CRÍTICA: HONESTIDAD CON DATOS FALTANTES
       - Si un segmento tiene "status: no_detectado", NO asumas que está correcto
       - Si MUCHOS segmentos son "no_detectado", el análisis es PARCIAL
       - NO digas "secuencia correcta" si no se detectaron la mayoría de segmentos
       - NO digas "excelente transferencia" si faltan datos críticos

       1. SECUENCIA DE ACTIVACIÓN:
          - PRIMERO: Cuenta cuántos segmentos tienen "status: no_detectado"
          - Si 3 o más segmentos son "no_detectado" → el análisis es PARCIAL
          - Si el análisis es parcial, di explícitamente: "Análisis limitado por falta de detección"
          - Revisa el orden de activación SOLO de los segmentos detectados (piernas → cadera → tronco → brazo → muñeca)
          - Si hay "delayMs" grande o "status: incorrecto", explica el problema
          - Si "brazo" tiene order < "cadera" o "tronco", indica "brazos anticipados"
          - Si un segmento es "no_detectado", menciona que NO se pudo evaluar ese segmento

       2. TIMING:
          - Si "releaseVsLegsMs" > 600-700ms, indica "liberación tardía"
          - Si "setPointMs" está muy lejos de t0+400ms, indica problema de set-point
          - Si setPointMs o releaseMs son null/undefined, indica "no detectado" en lugar de asumir

       3. MÉTRICAS:
          - "fluidityScore" bajo → movimiento brusco
          - "energyLeakPct" alto → pérdidas de energía
          - "sequenceDelayMs" alto → retrasos en la cadena
          - Si solo se detectó 1 segmento (piernas), las métricas pueden ser poco confiables

       4. ERRORES ESPECÍFICOS A DETECTAR:
          - "Brazos anticipados": Si brazo se activa antes de cadera/tronco (solo si están detectados)
          - "Liberación tardía": Si releaseVsLegsMs > 700ms (solo si está detectado)
          - "Falta de cadera": Si cadera tiene "no_detectado" → menciona que no se detectó activación de cadera
          - "Falta de tronco": Si tronco tiene "no_detectado" → menciona que no se detectó activación de tronco
          - "Falta de brazo": Si brazo tiene "no_detectado" → menciona que no se detectó activación de brazo
          - "Set-point incorrecto": Si setPointScore < 60 (solo si setPointMs está detectado)
          - "Movimiento brusco": Si fluidityScore < 60
          - "Fugas de energía": Si energyLeakPct > 35%
          - "Análisis limitado": Si 3+ segmentos son "no_detectado" → menciona que el análisis es parcial

FORMATO DE RESPUESTA:
{
  "feedback": {
    "errors": [
      "Tus brazos se adelantan. Primero genera impulso desde las piernas.",
      "Soltaste el balón tarde, después de completar la extensión."
    ],
    "recommendations": [
      "Inicia el movimiento desde las piernas antes de elevar los brazos",
      "Soltá el balón antes, acompañando la extensión final, no después"
    ],
    "strengths": [
      "Secuencia proximal → distal correcta",
      "Timing óptimo de liberación"
    ],
    "coachMessages": [
      "Tus brazos se adelantan. Primero genera impulso desde las piernas.",
      "Necesitas mayor participación de la cadera para transferir potencia.",
      "Elevá el punto de carga para optimizar la trayectoria y la transferencia."
    ]
  },
  "labels": ["brazos_anticipados", "liberacion_tardia"]
}

VIDEO: {{videoUrl}}

       INSTRUCCIONES IMPORTANTES:
       1. REGLA MÍNIMA: Debes generar AL MENOS 1 mensaje en alguna categoría (errors, recommendations, strengths o coachMessages)
       2. HONESTIDAD CON DATOS FALTANTES:
          - Si 3+ segmentos son "no_detectado", NO digas "secuencia correcta" o "excelente transferencia"
          - Si solo se detectó "piernas", di explícitamente que el análisis es PARCIAL
          - Menciona en "errors" o "recommendations" que faltan datos para análisis completo
       3. Si alguna lista resultaría vacía, agrega al menos 1 recomendación basada en biomech.sequence y biomech.timing
       4. Si no hay errores obvios PERO faltan datos, identifica que el análisis es limitado en "recommendations"
       5. Si hay aspectos positivos SOLO en segmentos detectados, inclúyelos en "strengths" (pero sé honesto)
       6. Los "coachMessages" deben ser mensajes directos y específicos para el jugador
          - Si faltan datos, menciona que el análisis es parcial
       7. Los "labels" deben ser tags técnicos como "brazos_anticipados", "liberacion_tardia", "analisis_parcial", etc.
       8. USA LOS NÚMEROS EXACTOS del JSON - no inventes valores, no recalcules
       9. NO asumas que algo está correcto si no se detectó - sé conservador

EJEMPLOS DE ANÁLISIS:
- Si biomech.sequence muestra brazo con order < cadera/tronco → "brazos_anticipados"
- Si biomech.timing.releaseVsLegsMs > 700 → "liberacion_tardia"
- Si biomech.metrics.setPointScore < 60 → "set_point_incorrecto"
- Si biomech.metrics.fluidityScore < 60 → "movimiento_brusco"
- Si biomech.metrics.energyLeakPct > 35 → "fugas_energia"

Analiza los datos biomecánicos y genera feedback de coaching en formato JSON. SIEMPRE retorna arrays con contenido, nunca arrays vacíos.`
});

// Prompt para descripción visual del video (verificación)
const videoDescriptionPrompt = ai.definePrompt({
  name: 'videoDescriptionPrompt',
  input: { schema: VideoDescriptionInputSchema },
  output: { schema: VideoDescriptionOutputSchema },
  prompt: `Eres un analista de video deportivo. Tu tarea es DESCRIBIR EXACTAMENTE lo que ves en este video de tiro de baloncesto.

🚨🚨🚨 REGLAS CRÍTICAS - NO INVENTAR 🚨🚨🚨
1. Describe SOLO lo que REALMENTE VES en el video
2. Si NO estás 100% seguro, di "no visible" o "no se puede determinar"
3. NO asumas colores basándote en "lo típico" - describe EXACTAMENTE lo que ves
4. NO inventes detalles que no están claramente visibles
5. Si el aro/canasta NO está visible en el frame, marca aroVisible: false
6. Sé CONSERVADOR: mejor "no visible" que inventar algo incorrecto

VIDEO: {{videoUrl}}

INSTRUCCIONES DETALLADAS:

1. OBSERVA EL VIDEO COMPLETO - Frame por frame si es necesario
   - NO hagas suposiciones basadas en "lo que suele ser"
   - Mira CADA frame para verificar qué está realmente visible

2. COLOR DE ROPA - Sé MUY ESPECÍFICO:
   - Observa el color REAL de la remera/camiseta que ves
   - Observa el color REAL del pantalón/short que ves
   - Si el color es oscuro y no puedes distinguir si es azul, negro, gris oscuro → di "color oscuro" o "no visible claramente"
   - Si el color es claro y no puedes distinguir → di "color claro" o "no visible claramente"
   - NO inventes colores estándar (blanco, negro) si no los ves claramente
   - Si ves un color específico, di el color EXACTO (ej: "azul marino", "azul claro", "negro")

3. ARO/CANASTA:
   - Busca el aro/canasta en TODOS los frames
   - Si NO lo ves en ningún frame, marca aroVisible: false
   - Si solo ves una parte (tablero pero no aro), di "parcialmente visible" en otrosDetalles
   - NO asumas que el aro está ahí solo porque es un video de baloncesto

4. ENTORNO:
   - Observa el fondo, las paredes, el piso
   - Sé específico: "gimnasio con paredes azules", "cancha exterior", etc.
   - Si no puedes determinar claramente → di "indeterminado"

5. ILUMINACIÓN Y CALIDAD:
   - Solo describe si puedes verlo claramente
   - Si no puedes determinar → di "no se puede determinar"

6. DESCRIPCIÓN NARRATIVA:
   - Describe SOLO lo que REALMENTE VES
   - NO uses frases como "claramente visible" si no estás seguro
   - Si algo no está visible, dilo explícitamente

EJEMPLOS DE LO QUE NO DEBES HACER:
❌ "camiseta blanca" si el video es oscuro y no puedes ver el color claramente
❌ "aro claramente visible" si el aro no aparece en el video
❌ "pantalones negros" si solo ves una silueta oscura
❌ Inventar detalles del entorno si no los ves

EJEMPLOS DE LO QUE SÍ DEBES HACER:
✅ "remera azul" solo si VES que es azul claramente
✅ "aroVisible: false" si NO aparece el aro en el video
✅ "color oscuro (no se puede determinar si azul o negro)" si no estás seguro
✅ "no visible" si no puedes ver algo claramente

FORMATO DE RESPUESTA:
{
  "description": "Descripción EXACTA de lo que ves - solo lo que está realmente visible",
  "details": {
    "aroVisible": false, // true SOLO si ves el aro claramente
    "colorRemera": "azul", // O "no visible" si no puedes verlo
    "colorPantalon": "azul", // O "no visible" si no puedes verlo
    "entorno": "gimnasio",
    "iluminacion": "artificial", // O "no se puede determinar"
    "calidadVideo": "buena", // O "no se puede determinar"
    "otrosDetalles": "Detalles específicos que REALMENTE ves"
  },
  "isRealVideo": true
}

⚠️ ÚLTIMA ADVERTENCIA:
Este es un TEST DE VERIFICACIÓN. Si inventas detalles, el test falla.
Describe SOLO lo que REALMENTE VES en el video, sin suposiciones ni inventos.

Responde en formato JSON con la estructura especificada.`
});

// ============================================================================
// FUNCIONES DE PROCESAMIENTO
// ============================================================================

/**
 * Procesa video con FFmpeg y extrae frames
 * Retorna paths temporales para cleanup
 */
async function processVideoForAnalysis(
  videoBuffer: Buffer,
  videoId: string,
  tmpDir: string
): Promise<{
  processedVideoPath: string;
  framesDir: string;
  thumbsDir: string;
  videoUrl: string;
  fps: number;
}> {
  const tempVideoPath = path.join(tmpDir, `temp_${videoId}.mp4`);
  const tempProcessedPath = path.join(tmpDir, `processed_${videoId}.mp4`);
  const framesDir = path.join(tmpDir, `frames_${videoId}`);
  
  // Guardar video original
  await fs.promises.writeFile(tempVideoPath, videoBuffer);
  console.log('📁 Video temporal guardado:', tempVideoPath);
  
  // Procesar video: 15s máximo, 12 FPS, 1280x720
  const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -t 15 -vf "fps=12,scale=1280:-1:flags=lanczos" -c:v libx264 -preset fast -crf 28 -b:v 500k -an -movflags +faststart "${tempProcessedPath}" -y`;
  console.log('🔧 Procesando video con FFmpeg...');
  await execAsync(ffmpegCommand);
  
  // Subir video procesado a Firebase
  const processedVideoId = `12fps-biomech-${uuidv4()}`;
  const processedVideoFileName = `test-videos/${processedVideoId}.mp4`;
  const processedVideoBuffer = await fs.promises.readFile(tempProcessedPath);
  
  if (!adminStorage) {
    throw new Error('Firebase Storage no está inicializado');
  }
  
  const videoRef = adminStorage.bucket().file(processedVideoFileName);
  await videoRef.save(processedVideoBuffer, {
    metadata: {
      contentType: 'video/mp4',
      metadata: {
        originalName: `biomech_${videoId}`,
        uploadedAt: new Date().toISOString(),
        fps: 12,
        resolution: '1280x720'
      }
    }
  });
  
  const videoUrl = `https://storage.googleapis.com/shotanalisys.firebasestorage.app/${processedVideoFileName}`;
  console.log('✅ Video subido:', videoUrl);
  
  // Extraer frames: 15 FPS en ventana de shot (0-2s) para mejor detección biomecánica
  // Esta es la ventana crítica donde ocurre la transferencia energética
  await fs.promises.mkdir(framesDir, { recursive: true });
  
  // Extraer ventana de shot (0-2s) a 15 FPS para mejor resolución temporal
  // Esta es la ventana crítica para detectar la cadena cinética
  const shotWindowCommand = `ffmpeg -i "${tempProcessedPath}" -t 2 -vf "fps=15,scale=640:-1:flags=lanczos" -q:v 4 "${framesDir}/frame_%05d.jpg" -y`;
  console.log('🔧 Extrayendo ventana de shot (0-2s) a 15 FPS para análisis biomecánico...');
  await execAsync(shotWindowCommand);
  
  // Contar frames extraídos para calcular FPS real
  const frameFiles = await fs.promises.readdir(framesDir);
  const frameCount = frameFiles.filter(f => f.endsWith('.jpg')).length;
  const actualFps = frameCount >= 30 ? 15 : 8; // Si hay 30+ frames en 2s, es 15 FPS
  console.log(`📊 Frames extraídos: ${frameCount}, FPS estimado: ${actualFps}`);
  
  // Extraer miniaturas para timeline: 4 FPS (cada 250ms), más livianas
  const thumbsDir = path.join(tmpDir, `thumbs_${videoId}`);
  await fs.promises.mkdir(thumbsDir, { recursive: true });
  const extractThumbsCommand = `ffmpeg -i "${tempProcessedPath}" -vf "fps=4,scale=320:-1:flags=lanczos" -q:v 6 "${thumbsDir}/thumb_%05d.jpg" -y`;
  console.log('🔧 Extrayendo miniaturas para timeline (4 FPS)...');
  await execAsync(extractThumbsCommand);
  
  // NO limpiar tempProcessedPath todavía - se necesita para generar keyframes
  // Se limpiará después en el finally
  
  return {
    processedVideoPath: tempVideoPath,
    framesDir,
    thumbsDir,
    videoUrl,
    fps: actualFps, // FPS real basado en frames extraídos (15 FPS en ventana de shot)
  };
}

/**
 * Realiza pose detection y cálculo de ángulos
 */
async function performPoseAnalysis(
  framesDir: string,
  fps: number
): Promise<{
  poseData: any;
  angles: Array<{tMs: number, elbowR?: number, kneeR?: number, hip?: number, wrist?: number}>;
  frames: PoseFrame[];
  shoulderHipDist: number;
}> {
  console.log('🤖 Iniciando pose detection...');
  
  const poseData = await extractPosesFromFolder(framesDir, fps);
  console.log(`✅ Pose detection: ${poseData.frames.length} frames`);
  
  const angles = calculateBiomechanicalAngles(poseData.frames);
  console.log(`✅ Ángulos calculados: ${angles.length} muestras`);
  
  const shoulderHipDist = calculateShoulderHipDistance(poseData.frames);
  console.log(`✅ Distancia hombro-cadera promedio: ${shoulderHipDist.toFixed(3)}`);
  
  return {
    poseData,
    angles,
    frames: poseData.frames,
    shoulderHipDist,
  };
}

/**
 * Extrae pose data de un frame cercano a un timestamp específico
 */
function getPoseForTime(
  tMs: number,
  frames: PoseFrame[],
  tolerance: number = 100
): PoseFrame | null {
  // Buscar frame más cercano al timestamp
  let closestFrame: PoseFrame | null = null;
  let minDiff = Infinity;
  
  for (const frame of frames) {
    const diff = Math.abs(frame.tMs - tMs);
    if (diff < minDiff && diff <= tolerance) {
      minDiff = diff;
      closestFrame = frame;
    }
  }
  
  return closestFrame;
}

/**
 * Convierte FramePose a KeyframePose con anclajes pre-calculados
 */
function framePoseToKeyframePose(frame: PoseFrame): KeyframePose {
  const anchors: KeyframePose['anchors'] = {};
  
  // Buscar keypoints específicos y crear anclajes
  for (const kp of frame.keypoints) {
    if (kp.name === 'right_elbow') {
      anchors.elbow = { x: kp.x, y: kp.y };
    } else if (kp.name === 'right_hip') {
      anchors.hip = { x: kp.x, y: kp.y };
    } else if (kp.name === 'right_wrist') {
      anchors.wrist = { x: kp.x, y: kp.y };
    } else if (kp.name === 'right_knee') {
      anchors.knee = { x: kp.x, y: kp.y };
    } else if (kp.name === 'right_shoulder') {
      anchors.shoulder = { x: kp.x, y: kp.y };
    }
  }
  
  return {
    keypoints: frame.keypoints,
    anchors: Object.keys(anchors).length > 0 ? anchors : undefined,
  };
}

/**
 * Genera keyframes automáticos basados en eventos biomecánicos
 */
async function generateAutoKeyframes(
  biomechOutput: BiomechDeterministicOutput,
  thumbsDir: string,
  videoId: string,
  fps: number,
  poseFrames?: PoseFrame[]
): Promise<Keyframe[]> {
  const keyframes: Keyframe[] = [];
  
  // Leer miniaturas disponibles
  const thumbFiles = await fs.promises.readdir(thumbsDir);
  const sortedThumbs = thumbFiles
    .filter(f => f.endsWith('.jpg'))
    .sort();
  
  // Función para obtener miniatura más cercana a un tMs
  const getThumbForTime = (tMs: number): string => {
    const frameIndex = Math.round((tMs / 1000) * 4); // 4 FPS para miniaturas
    const thumbFile = sortedThumbs[frameIndex] || sortedThumbs[sortedThumbs.length - 1];
    if (!thumbFile) return '';
    
    // Retornar nombre de archivo (se usará para subir después)
    const thumbFileName = `biomech-thumbs/${videoId}/${thumbFile}`;
    return thumbFileName;
  };
  
  // Función helper para crear keyframe con pose si está disponible
  const createKeyframe = (tMs: number, notes: any, eventType?: any): Keyframe => {
    const keyframe: Keyframe = {
      id: uuidv4(),
      tMs,
      thumbUrl: getThumbForTime(tMs),
      notes,
      eventType,
    };
    
    // Agregar pose data si está disponible
    if (poseFrames && poseFrames.length > 0) {
      const poseFrame = getPoseForTime(tMs, poseFrames, 150); // 150ms de tolerancia
      if (poseFrame) {
        keyframe.pose = framePoseToKeyframePose(poseFrame);
      }
    }
    
    return keyframe;
  };
  
         // Keyframe 1: t0_start (inicio de extensión)
         const t0Segment = biomechOutput.sequence.find(s => s.segment === 'piernas');
         const t0Ms = (t0Segment?.onsetMs !== null && t0Segment?.onsetMs !== undefined) ? t0Segment.onsetMs : 0;
         if (t0Ms >= 0 && t0Ms < 15000) { // Validar que esté dentro del rango del video
    keyframes.push(createKeyframe(
      t0Ms,
      [{
        id: uuidv4(),
        author: 'system',
        text: `Inicio de extensión de piernas (t0)`,
        tags: ['t0', 'piernas'],
        createdAt: new Date().toISOString(),
        anchor: 'knee',
      }],
      't0_start'
    ));
  }
  
  // Keyframe 2: Set-point
  if (biomechOutput.timing.setPointMs && biomechOutput.timing.setPointMs >= 0 && biomechOutput.timing.setPointMs < 15000) {
    keyframes.push(createKeyframe(
      biomechOutput.timing.setPointMs,
      [{
        id: uuidv4(),
        author: 'system',
        text: `Set-point detectado (score: ${biomechOutput.metrics.setPointScore}/100)`,
        tags: ['set-point'],
        createdAt: new Date().toISOString(),
        anchor: 'wrist', // Set-point típicamente cerca de la muñeca
      }],
      'set_point'
    ));
  }
  
  // Keyframe 3: Release
  if (biomechOutput.timing.releaseMs && biomechOutput.timing.releaseMs >= 0 && biomechOutput.timing.releaseMs < 15000) {
    const releaseDelay = biomechOutput.timing.releaseVsLegsMs || 0;
    keyframes.push(createKeyframe(
      biomechOutput.timing.releaseMs,
      [{
        id: uuidv4(),
        author: 'system',
        text: `Release estimado (${releaseDelay}ms después de t0)`,
        tags: ['release'],
        createdAt: new Date().toISOString(),
        anchor: 'wrist',
      }],
      'release'
    ));
  }
  
  // Mapeo de segmentos a anclajes
  const segmentToAnchor: Record<string, 'elbow' | 'hip' | 'wrist' | 'knee' | 'shoulder' | 'none'> = {
    'cadera': 'hip',
    'tronco': 'hip',
    'brazo': 'elbow',
    'muñeca': 'wrist',
    'dedos': 'wrist',
    'piernas': 'knee',
  };
  
         // Keyframes para onsets de segmentos
         for (const segment of biomechOutput.sequence) {
           // Incluir todos los segmentos excepto dedos (que es muy difícil de detectar)
           if (segment.segment !== 'dedos' && 
               segment.onsetMs !== null && 
               segment.onsetMs !== undefined && 
               segment.onsetMs >= 0 && 
               segment.onsetMs < 15000) {
             const existing = keyframes.find(kf => Math.abs(kf.tMs - segment.onsetMs!) < 50);
      if (!existing && segment.onsetMs !== null && segment.onsetMs !== undefined) {
        keyframes.push(createKeyframe(
          segment.onsetMs,
          [{
            id: uuidv4(),
            author: 'system',
            text: `Onset de ${segment.segment} (${segment.status})`,
            tags: [segment.segment, 'onset'],
            createdAt: new Date().toISOString(),
            anchor: segmentToAnchor[segment.segment] || 'none',
          }],
          `onset_${segment.segment}` as any
        ));
      }
    }
  }
  
  // Keyframe para pico de velocidad (si hay)
  for (const segment of biomechOutput.sequence) {
    if (segment.peakVelMs && segment.segment !== 'piernas') {
      const existing = keyframes.find(kf => Math.abs(kf.tMs - segment.peakVelMs!) < 50);
      if (!existing) {
        keyframes.push(createKeyframe(
          segment.peakVelMs,
          [{
            id: uuidv4(),
            author: 'system',
            text: `Pico de velocidad en ${segment.segment}`,
            tags: [segment.segment, 'peak_velocity'],
            createdAt: new Date().toISOString(),
            anchor: segmentToAnchor[segment.segment] || 'none',
          }],
          'peak_velocity'
        ));
      }
    }
  }
  
  // Ordenar por tMs
  keyframes.sort((a, b) => a.tMs - b.tMs);
  
  return keyframes;
}

/**
 * Sube miniaturas a Firebase Storage y actualiza URLs
 */
async function uploadThumbnails(
  keyframes: Keyframe[],
  thumbsDir: string,
  videoId: string
): Promise<Keyframe[]> {
  if (!adminStorage) {
    console.warn('⚠️ Firebase Storage no disponible, saltando upload de miniaturas');
    return keyframes;
  }
  
  const updatedKeyframes = await Promise.all(
    keyframes.map(async (kf) => {
      if (!kf.thumbUrl || !kf.thumbUrl.includes('/')) {
        return kf;
      }
      
      const thumbFileName = kf.thumbUrl;
      const thumbBasename = path.basename(thumbFileName);
      const thumbPath = path.join(thumbsDir, thumbBasename);
      
      try {
        // Verificar que el archivo existe
        await fs.promises.access(thumbPath);
        const thumbBuffer = await fs.promises.readFile(thumbPath);
        if (!adminStorage) return kf;
        const thumbRef = adminStorage.bucket().file(thumbFileName);
        
        await thumbRef.save(thumbBuffer, {
          metadata: {
            contentType: 'image/jpeg',
            metadata: {
              analysisId: videoId,
              tMs: kf.tMs.toString(),
            }
          }
        });
        
        // Generar URL pública
        const [url] = await thumbRef.getSignedUrl({
          action: 'read',
          expires: '03-01-2500', // URL de larga duración
        });
        
        return {
          ...kf,
          thumbUrl: url,
        };
      } catch (error) {
        console.warn(`⚠️ Error subiendo miniatura ${thumbFileName}:`, error);
      }
      
      return kf;
    })
  );
  
  return updatedKeyframes;
}

// ============================================================================
// ENDPOINT PRINCIPAL
// ============================================================================

export async function POST(request: NextRequest) {
  const analysisId = `biomech-${uuidv4()}`;
  const tmpDir = path.join(os.tmpdir(), analysisId);
  let cleanupPaths: string[] = [tmpDir];
  
  const startTime = Date.now();
  
  try {
    // Validación de Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type debe ser multipart/form-data' },
        { status: 400 }
      );
    }
    
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const cameraHintRaw = (formData.get('camera_hint') as string | null)?.toLowerCase();
    const cameraHint = cameraHintRaw === 'lateral' || cameraHintRaw === 'frontal' ? cameraHintRaw : undefined;
    
    if (!videoFile) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo de video' },
        { status: 400 }
      );
    }
    
    // Validación de tamaño
    if (videoFile.size > MAX_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        { 
          error: `Video demasiado grande. Máximo: ${MAX_VIDEO_SIZE_MB}MB`,
          size: videoFile.size,
          maxSize: MAX_VIDEO_SIZE_BYTES
        },
        { status: 400 }
      );
    }
    
    console.log(`📊 [${analysisId}] Video recibido:`, {
      name: videoFile.name,
      size: `${(videoFile.size / 1024 / 1024).toFixed(2)}MB`,
      type: videoFile.type
    });
    
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    
    // Crear directorio temporal
    await fs.promises.mkdir(tmpDir, { recursive: true });
    
    // 1. PROCESAR VIDEO
    const videoProcessingStart = Date.now();
    const { processedVideoPath, framesDir, thumbsDir, videoUrl, fps } = await processVideoForAnalysis(
      videoBuffer,
      analysisId,
      tmpDir
    );
    cleanupPaths.push(processedVideoPath, framesDir, thumbsDir);
    
    // Guardar processedVideoPath para uso en descripción visual
    const videoProcessedPath = processedVideoPath;
    const videoProcessingTime = Date.now() - videoProcessingStart;
    console.log(`⏱️ [${analysisId}] Procesamiento de video: ${videoProcessingTime}ms`);
    
    // 2. POSE DETECTION Y ÁNGULOS
    const poseStart = Date.now();
    let poseAnalysis: {
      poseData: any;
      angles: Array<{tMs: number, elbowR?: number, kneeR?: number, hip?: number, wrist?: number}>;
      frames: PoseFrame[];
      shoulderHipDist: number;
    } | null = null;
    let poseTime = 0;
    
    try {
      poseAnalysis = await performPoseAnalysis(framesDir, fps);
      poseTime = Date.now() - poseStart;
      console.log(`⏱️ [${analysisId}] Pose detection: ${poseTime}ms`);

      // Detectar orientación de cámara
      if (poseAnalysis && poseAnalysis.frames.length > 0) {
        const framesWithPose = poseAnalysis.frames.filter(frame =>
          frame.keypoints?.some(kp => (kp.score ?? 0) >= 0.3)
        ).length;
        const poseCoverage = poseAnalysis.frames.length > 0
          ? ((framesWithPose / poseAnalysis.frames.length) * 100).toFixed(1)
          : '0.0';
        console.log(`🤖 [${analysisId}] Landmarks válidos en ${framesWithPose}/${poseAnalysis.frames.length} frames (${poseCoverage}%)`);

        const cameraOrientation = detectCameraOrientation(poseAnalysis.frames, {
          hint: cameraHint,
        });
        const capabilities = getAnalysisCapabilities(cameraOrientation.orientation);
        
        console.log(`📹 [${analysisId}] Orientación de cámara:`, {
          orientation: cameraOrientation.orientation,
          confidence: cameraOrientation.confidence,
          reasoning: cameraOrientation.reasoning,
          metrics: cameraOrientation.metrics,
          capabilities: {
            canAnalyzeSequence: capabilities.canAnalyzeSequence,
            canAnalyzeSetPoint: capabilities.canAnalyzeSetPoint,
            canAnalyzeRelease: capabilities.canAnalyzeRelease,
          },
        });
        
        // Guardar para respuesta
        (poseAnalysis as any).cameraOrientation = cameraOrientation;
        (poseAnalysis as any).capabilities = capabilities;
      }
    } catch (poseError: any) {
      poseTime = Date.now() - poseStart;
      console.warn(`⚠️ [${analysisId}] Error en pose detection (${poseTime}ms):`, poseError.message);
      // Continuar sin pose detection (fallback)
    }
    
    // 3. ANÁLISIS BIOMECÁNICO DETERMINISTA
    console.log(`📐 [${analysisId}] Calculando análisis biomecánico determinista...`);
    const biomechStart = Date.now();
    
    let biomechOutput: BiomechDeterministicOutput;
    let honesty: HonestyGateResult | null = null;
    
    if (poseAnalysis && poseAnalysis.angles.length >= 5) {
      // Función de logging para debugging
      const debugLog = (msg: string, data?: any) => {
        console.log(`🔍 [${analysisId}] ${msg}`, data || '');
      };
      
      biomechOutput = calculateDeterministicBiomech(
        poseAnalysis.angles,
        poseAnalysis.frames,
        fps,
        debugLog
      );
      console.log(`✅ [${analysisId}] Análisis determinista completado:`, {
        efficiencyIndex: biomechOutput.efficiencyIndex,
        sequenceLength: biomechOutput.sequence.length,
        sequenceSegments: biomechOutput.sequence.map(s => s.segment),
        setPointMs: biomechOutput.timing.setPointMs,
        releaseMs: biomechOutput.timing.releaseMs,
        fluidityScore: biomechOutput.metrics.fluidityScore
      });
    } else {
      // Fallback: valores por defecto si no hay datos de pose
      console.warn(`⚠️ [${analysisId}] Sin datos de pose, usando valores por defecto`);
      biomechOutput = {
        efficiencyIndex: 50,
        sequence: [
          { segment: 'piernas', onsetMs: 0, order: 1, status: 'mejorable' },
          { segment: 'cadera', onsetMs: 150, order: 2, status: 'mejorable' },
          { segment: 'brazo', onsetMs: 450, order: 4, status: 'mejorable' },
        ],
        timing: { setPointMs: 550, releaseMs: 650 },
        metrics: {
          fluidityScore: 50,
          energyLeakPct: 50,
          setPointScore: 50,
          sequenceDelayMs: 0,
        },
      };
    }
    const biomechTime = Date.now() - biomechStart;
    console.log(`⏱️ [${analysisId}] Análisis biomecánico: ${biomechTime}ms`);

    honesty = applyHonestyGate(
      biomechOutput.sequence,
      biomechOutput.metrics,
      biomechOutput.efficiencyIndex
    );

    let analysisComplete = honesty.analysisComplete;
    let segmentsDetected = honesty.segmentsDetected;
    let effectiveEfficiencyIndex = honesty.efficiencyIndex;
    let effectiveFluidity = honesty.fluidityScore;
    let effectiveEnergy = honesty.energyLeakPct;

    console.log(`📸 [${analysisId}] Generando keyframes automáticos...`);
    const keyframesStart = Date.now();
    let autoKeyframes: Keyframe[] = [];
    let keyframesTime = 0;

    try {
      autoKeyframes = await generateAutoKeyframes(
        biomechOutput,
        thumbsDir,
        analysisId,
        fps,
        poseAnalysis?.frames // Pasar frames de pose para anclaje
      );

      // Subir miniaturas a Firebase
      autoKeyframes = await uploadThumbnails(autoKeyframes, thumbsDir, analysisId);

      keyframesTime = Date.now() - keyframesStart;
      console.log(`✅ [${analysisId}] ${autoKeyframes.length} keyframes generados (${keyframesTime}ms)`);
    } catch (keyframeError: any) {
      keyframesTime = Date.now() - keyframesStart;
      console.warn(`⚠️ [${analysisId}] Error generando keyframes (${keyframesTime}ms):`, keyframeError.message);
      // Continuar sin keyframes (no crítico)
    }

    // 5. DESCRIPCIÓN VISUAL DEL VIDEO (verificación)
    console.log(`👁️ [${analysisId}] Generando descripción visual del video...`);
    let videoDescription: any = null;
    let videoDescriptionTime = 0;

    if (ENABLE_VIDEO_DESCRIPTION) {
      const descriptionStartTime = Date.now();
      try {
        const descriptionResult = await videoDescriptionPrompt({ videoUrl });
        videoDescription = descriptionResult.output;
        videoDescriptionTime = Date.now() - descriptionStartTime;
        console.log(`✅ [${analysisId}] Descripción visual generada (${videoDescriptionTime}ms):`, {
          aroVisible: videoDescription.details.aroVisible,
          entorno: videoDescription.details.entorno,
          isRealVideo: videoDescription.isRealVideo,
        });
      } catch (descriptionError: any) {
        videoDescriptionTime = Date.now() - descriptionStartTime;
        console.warn(`⚠️ [${analysisId}] Error generando descripción visual (${videoDescriptionTime}ms):`, descriptionError.message);
        console.warn(`⚠️ [${analysisId}] Stack:`, descriptionError.stack);

        try {
          console.log(`🔄 [${analysisId}] Intentando descripción con Gemini directo...`);
          const processedVideoBuffer = await fs.promises.readFile(videoProcessedPath);
          const videoBase64 = processedVideoBuffer.toString('base64');

          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            }
          });

          const prompt = `Describe EXACTAMENTE lo que ves en este video de tiro de baloncesto. Responde SOLO con JSON:

{
  "description": "Descripción de 2-3 oraciones de lo que REALMENTE ves",
  "details": {
    "aroVisible": true/false,
    "colorRemera": "color EXACTO o 'no visible'",
    "colorPantalon": "color EXACTO o 'no visible'",
    "entorno": "gimnasio/cancha exterior/otro/indeterminado",
    "iluminacion": "natural/artificial/mixta/no se puede determinar",
    "calidadVideo": "excelente/buena/regular/mala/no se puede determinar",
    "otrosDetalles": "otros detalles que REALMENTE ves"
  },
  "isRealVideo": true
}`;

          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                mimeType: 'video/mp4',
                data: videoBase64
              }
            }
          ]);

          const responseText = result.response.text();
          const cleanJson = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          videoDescription = JSON.parse(cleanJson);

          console.log(`✅ [${analysisId}] Descripción generada con Gemini directo`);
        } catch (fallbackError: any) {
          console.warn(`⚠️ [${analysisId}] Fallback también falló:`, fallbackError.message);
          videoDescription = {
            description: 'No se pudo generar descripción visual del video.',
            details: {
              aroVisible: false,
              entorno: 'indeterminado',
            },
            isRealVideo: true,
            disabled: true,
          };
        }
      }
    } else {
      videoDescription = {
        description: 'Verificación visual deshabilitada temporalmente.',
        details: {
          aroVisible: false,
          entorno: 'indeterminado',
          iluminacion: 'no se puede determinar',
          calidadVideo: 'no se puede determinar',
          otrosDetalles: 'Verificación pendiente: reactivar cuando esté disponible la clave de Gemini.',
        },
        isRealVideo: true,
        disabled: true,
      };
      console.log(`ℹ️ [${analysisId}] Verificación visual deshabilitada por configuración.`);
    }
    
    // Serializar JSON para el prompt (fuente primaria)
    const biomechJsonString = JSON.stringify({
      efficiencyIndex: effectiveEfficiencyIndex,
      sequence: biomechOutput.sequence,
      timing: biomechOutput.timing,
      metrics: {
        ...biomechOutput.metrics,
        fluidityScore: analysisComplete ? biomechOutput.metrics.fluidityScore : null,
        energyLeakPct: analysisComplete ? biomechOutput.metrics.energyLeakPct : null,
      },
      analysisComplete,
      segmentsDetected,
    }, null, 2);
    
    // Formatear datos biomecánicos como string legible para el prompt (contexto)
    const biomechDataString = `
Eficiencia (gated): ${effectiveEfficiencyIndex}/100
Cobertura de segmentos: ${segmentsDetected} detectados de 6 (análisis completo: ${analysisComplete ? 'sí' : 'no'})

Secuencia de activación:
${biomechOutput.sequence.map(s => 
  `  - ${s.segment}: activación a ${s.onsetMs !== null && s.onsetMs !== undefined ? `${s.onsetMs}ms` : 'N/A'}, orden ${s.order || 'N/A'}, estado: ${s.status}${s.delayMs ? `, retraso: ${s.delayMs}ms` : ''}${s.peakVelMs ? `, pico de velocidad: ${s.peakVelMs}ms` : ''}`
).join('\n')}

Timing:
  - Set-point: ${biomechOutput.timing.setPointMs || 'No detectado'}ms (score: ${biomechOutput.metrics.setPointScore}/100)
  - Release: ${biomechOutput.timing.releaseMs || 'No detectado'}ms (${biomechOutput.timing.releaseVsLegsMs || 'N/A'}ms después de t0)

Métricas:
  - Fluidez: ${analysisComplete && effectiveFluidity !== null ? `${effectiveFluidity}/100` : 'No se reporta (análisis incompleto)'}
  - Pérdidas de energía: ${analysisComplete && effectiveEnergy !== null ? `${effectiveEnergy}%` : 'No se reporta (análisis incompleto)'}
  - Retraso en secuencia: ${biomechOutput.metrics.sequenceDelayMs}ms
`;
    
    // Hash del input para trazabilidad
    const inputHash = createHash('md5')
      .update(JSON.stringify({ biomech: biomechOutput, videoUrl }))
      .digest('hex')
      .substring(0, 8);
    
    console.log(`📊 [${analysisId}] Datos biomecánicos formateados:`, {
      inputHash,
      sequenceLength: biomechOutput.sequence.length,
      jsonDataLength: biomechJsonString.length,
      formattedDataLength: biomechDataString.length,
    });
    
    // Función helper para validar y post-procesar feedback
    const validateAndPostProcess = (output: any): any => {
      if (!output?.feedback) return null;
      
      // Post-procesamiento: normalizar y completar
      const feedback = {
        errors: Array.isArray(output.feedback.errors) ? output.feedback.errors.filter((e: string) => e?.trim()).map((e: string) => e.trim().substring(0, 500)) : [],
        recommendations: Array.isArray(output.feedback.recommendations) ? output.feedback.recommendations.filter((r: string) => r?.trim()).map((r: string) => r.trim().substring(0, 500)) : [],
        strengths: Array.isArray(output.feedback.strengths) ? output.feedback.strengths.filter((s: string) => s?.trim()).map((s: string) => s.trim().substring(0, 500)) : [],
        coachMessages: Array.isArray(output.feedback.coachMessages) ? output.feedback.coachMessages.filter((m: string) => m?.trim()).map((m: string) => m.trim().substring(0, 500)) : [],
      };
      
      // Eliminar duplicados
      feedback.errors = Array.from(new Set(feedback.errors));
      feedback.recommendations = Array.from(new Set(feedback.recommendations));
      feedback.strengths = Array.from(new Set(feedback.strengths));
      feedback.coachMessages = Array.from(new Set(feedback.coachMessages));
      
      // Validar regla mínima: al menos un ítem
      const totalItems = feedback.errors.length + feedback.recommendations.length + feedback.strengths.length + feedback.coachMessages.length;
      if (totalItems === 0) {
        return null; // No cumple regla mínima
      }
      
      return {
        feedback,
        labels: Array.isArray(output.labels) ? Array.from(new Set(output.labels.filter((l: string) => l?.trim()))) : [],
      };
    };
    
    // Función para intentar generar feedback con reintento
    const tryGenerateFeedback = async (isRetry: boolean = false): Promise<any> => {
      // Filtrar valores null para el prompt (el LLM no necesita nulls)
      const biomechForPrompt = {
        efficiencyIndex: effectiveEfficiencyIndex,
        sequence: biomechOutput.sequence.map(s => ({
          ...s,
          onsetMs: s.onsetMs ?? undefined,
          order: s.order ?? undefined,
        })),
        timing: biomechOutput.timing,
        metrics: {
          ...biomechOutput.metrics,
          fluidityScore: analysisComplete && effectiveFluidity !== null ? effectiveFluidity : 0,
          energyLeakPct: analysisComplete && effectiveEnergy !== null ? effectiveEnergy : 0,
        },
        analysisComplete,
        segmentsDetected,
        formattedData: biomechDataString,
        jsonData: biomechJsonString,
      };
      
      const promptInput = {
        videoUrl,
        biomech: biomechForPrompt,
      };
      
      if (isRetry) {
        // Agregar instrucción de reparación
        (promptInput as any).repairInstruction = 'Tu salida anterior no cumplió el esquema. Completa como mínimo 1 recomendación basada en la secuencia detectada. Usa exclusivamente los datos numéricos provistos en el JSON.';
      }
      
      const result = await biomechanicalCoachingPrompt(promptInput);
      const validated = validateAndPostProcess(result.output);
      
      if (validated) {
        // Validar con Zod
        const zodResult = LlmCoachingOutputSchema.safeParse(validated);
        if (zodResult.success) {
          return zodResult.data;
        } else {
          console.warn(`⚠️ [${analysisId}] Validación Zod falló:`, zodResult.error.errors);
          return null;
        }
      }
      
      return null;
    };
    
    let coachingOutput: any = null;
    let coachingStartTime = Date.now();
    
    try {
      // Primer intento
      coachingOutput = await tryGenerateFeedback(false);
      
      // Si falla validación, reintentar una vez
      if (!coachingOutput) {
        console.warn(`⚠️ [${analysisId}] Primer intento falló validación, reintentando...`);
        coachingOutput = await tryGenerateFeedback(true);
      }
      
      const coachingTime = Date.now() - coachingStartTime;
      
      if (coachingOutput) {
        console.log(`✅ [${analysisId}] Feedback generado (${coachingTime}ms):`, {
          inputHash,
          errors: coachingOutput.feedback.errors.length,
          recommendations: coachingOutput.feedback.recommendations.length,
          strengths: coachingOutput.feedback.strengths.length,
          coachMessages: coachingOutput.feedback.coachMessages.length,
          labels: coachingOutput.labels?.length || 0,
        });
      } else {
        throw new Error('Validación falló después de reintento');
      }
    } catch (coachingError: any) {
      const coachingTime = Date.now() - coachingStartTime;
      console.error(`❌ [${analysisId}] Error en coaching prompt (${coachingTime}ms):`, coachingError.message);
      console.log(`🔄 [${analysisId}] Usando fallback rule-based...`);
      
      // FALLBACK: Generar feedback rule-based
      const ruleBasedFeedback = generateRuleBasedFeedback(biomechOutput);
      coachingOutput = {
        feedback: ruleBasedFeedback.feedback,
        labels: ruleBasedFeedback.labels,
        _source: 'rule-based', // Marca para logging
      };
      
      console.log(`✅ [${analysisId}] Feedback rule-based generado:`, {
        inputHash,
        errors: coachingOutput.feedback.errors.length,
        recommendations: coachingOutput.feedback.recommendations.length,
        strengths: coachingOutput.feedback.strengths.length,
        coachMessages: coachingOutput.feedback.coachMessages.length,
        labels: coachingOutput.labels.length,
        source: 'rule-based',
      });
    }
    
    // GARANTIZAR: Nunca devolver feedback vacío
    if (!coachingOutput || !coachingOutput.feedback || (
      coachingOutput.feedback.errors.length === 0 &&
      coachingOutput.feedback.recommendations.length === 0 &&
      coachingOutput.feedback.strengths.length === 0 &&
      coachingOutput.feedback.coachMessages.length === 0
    )) {
      console.warn(`⚠️ [${analysisId}] Feedback vacío detectado, generando fallback rule-based...`);
      const fallbackFeedback = generateRuleBasedFeedback(biomechOutput);
      coachingOutput = {
        feedback: fallbackFeedback.feedback,
        labels: fallbackFeedback.labels,
        _source: 'rule-based-fallback',
      };
    }
    
    // GARANTIZAR: Secuencia siempre completa (6 segmentos)
    if (biomechOutput.sequence.length < 6) {
      console.warn(`⚠️ [${analysisId}] Secuencia incompleta (${biomechOutput.sequence.length} segmentos), aplicando backfill...`);
      const EXPECTED = ['piernas', 'cadera', 'tronco', 'brazo', 'muñeca', 'dedos'] as const;
      const bySeg = Object.fromEntries(biomechOutput.sequence.map(s => [s.segment, s]));
      biomechOutput.sequence = EXPECTED.map(seg => {
        const existing = bySeg[seg];
        if (existing) return existing;
        return {
          segment: seg,
          onsetMs: null,
          order: seg === 'piernas' ? 1 : seg === 'cadera' ? 2 : seg === 'tronco' ? 3 : seg === 'brazo' ? 4 : seg === 'muñeca' ? 5 : 6,
          status: 'no_detectado' as const,
          delayMs: undefined,
        };
      });
    }
    
    // 6. CREAR TIMELINE EN FIRESTORE
    const timeline: Timeline = {
      videoUrl,
      durationMs: 15000, // 15 segundos limitado
      fps,
      keyframes: autoKeyframes,
      analysisId,
    };
    
    try {
      if (adminDb) {
        await adminDb.collection('biomech_timelines').doc(analysisId).set({
          ...timeline,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(`✅ [${analysisId}] Timeline guardado en Firestore`);
      } else {
        console.warn(`⚠️ [${analysisId}] Firestore no disponible, timeline no guardado`);
      }
    } catch (timelineError: any) {
      console.warn(`⚠️ [${analysisId}] Error guardando timeline:`, timelineError.message);
      // Continuar sin timeline (no crítico)
    }
    
    // 7. RESPUESTA FINAL
    const processingTime = Date.now() - startTime;
    
    // Calcular tiempos de fases
    const coachingTime = coachingOutput ? (Date.now() - coachingStartTime) : 0;
    const phaseTimes = {
      videoProcessing: videoProcessingTime,
      poseDetection: poseTime,
      biomechAnalysis: biomechTime,
      keyframes: keyframesTime,
      coaching: coachingTime,
      total: processingTime,
    };
    
    const response = {
      success: true,
      message: 'Análisis biomecánico de transferencia energética completado',
      analysisId,
      _trace: {
        inputHash,
        feedbackSource: coachingOutput._source || 'llm',
        phaseTimes,
        keyframesCount: autoKeyframes.length,
        sequenceLength: biomechOutput.sequence.length,
      },
      camera_orientation: poseAnalysis && (poseAnalysis as any).cameraOrientation ? {
        orientation: (poseAnalysis as any).cameraOrientation.orientation,
        confidence: (poseAnalysis as any).cameraOrientation.confidence,
        confidence_score: (poseAnalysis as any).cameraOrientation.confidenceScore,
        reasoning: (poseAnalysis as any).cameraOrientation.reasoning,
        capabilities: (poseAnalysis as any).capabilities,
        metrics: (poseAnalysis as any).cameraOrientation.metrics,
      } : null,
      video_description: videoDescription ? {
        description: videoDescription.description,
        details: videoDescription.details,
        isRealVideo: videoDescription.isRealVideo,
      } : null,
      // Datos deterministas (no inventados por LLM)
      efficiency_index: effectiveEfficiencyIndex,
      analysis_summary: {
        analysis_complete: analysisComplete,
        segments_detected: segmentsDetected,
        banner: honesty.banner,
      },
      activation_sequence: biomechOutput.sequence.map(s => ({
        name: s.segment,
        activation_time: s.onsetMs !== null && s.onsetMs !== undefined ? `${(s.onsetMs / 1000).toFixed(2)}s` : 'N/A',
        activation_time_ms: s.onsetMs ?? null,
        peak_velocity_ms: s.peakVelMs ?? null,
        order: s.order ?? null,
        status: s.status,
        delay_ms: s.delayMs ?? null,
      })),
      timing_analysis: {
        set_point: {
          position: biomechOutput.timing.setPointMs ? 'Detectado' : 'No detectado',
          timestamp: biomechOutput.timing.setPointMs 
            ? `${(biomechOutput.timing.setPointMs / 1000).toFixed(2)}s`
            : 'N/A',
          timestamp_ms: biomechOutput.timing.setPointMs,
          height: 'Calculado',
          status: analysisComplete
            ? (biomechOutput.metrics.setPointScore >= 80 ? 'correcto'
              : biomechOutput.metrics.setPointScore >= 60 ? 'mejorable'
              : 'incorrecto')
            : 'estimado (datos incompletos)',
        },
        release: {
          timestamp: biomechOutput.timing.releaseMs
            ? `${(biomechOutput.timing.releaseMs / 1000).toFixed(2)}s`
            : 'N/A',
          timestamp_ms: biomechOutput.timing.releaseMs,
          timing: biomechOutput.timing.releaseVsLegsMs
            ? `${biomechOutput.timing.releaseVsLegsMs}ms después de t0`
            : 'N/A',
          status: analysisComplete
            ? (biomechOutput.timing.releaseVsLegsMs 
                ? (biomechOutput.timing.releaseVsLegsMs <= 700 ? 'correcto' : 'mejorable')
                : 'mejorable')
            : 'estimado (datos incompletos)',
        },
      },
      // Feedback de coaching (generado por LLM)
      feedback: coachingOutput.feedback,
      labels: coachingOutput.labels || [],
      // Métricas deterministas
      metrics: {
        fluidity_score: effectiveFluidity,
        energy_loss: effectiveEnergy,
        set_point_score: biomechOutput.metrics.setPointScore,
        sequence_delay_ms: biomechOutput.metrics.sequenceDelayMs,
      },
      video_info: {
        original_name: videoFile.name,
        original_size: videoFile.size,
        duration: '15.0s (limitado)',
        fps: 12,
        resolution: '1280x720',
        video_url: videoUrl
      },
      timeline: {
        keyframes_count: autoKeyframes.length,
        timeline_id: analysisId,
        comments_api: `/api/test-biomechanical-transfer/${analysisId}/comments`,
      },
      processing_time: new Date().toISOString(),
      processing_duration_ms: processingTime,
    };
    
    // Logs de auditoría mejorados
    console.log(`✅ [${analysisId}] Análisis completado:`, {
      inputHash,
      duration: `${processingTime}ms`,
      phaseTimes,
      frames: poseAnalysis?.frames.length || 0,
      angles: poseAnalysis?.angles.length || 0,
      efficiency: effectiveEfficiencyIndex,
      keyframes: autoKeyframes.length,
      feedbackItems: {
        errors: coachingOutput.feedback.errors.length,
        recommendations: coachingOutput.feedback.recommendations.length,
        strengths: coachingOutput.feedback.strengths.length,
        coachMessages: coachingOutput.feedback.coachMessages.length,
      },
      feedbackSource: coachingOutput._source || 'llm',
    });
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ [${analysisId}] Error:`, {
      message: error.message,
      duration: `${processingTime}ms`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    return NextResponse.json({
      success: false,
      error: 'Error en análisis biomecánico',
      details: error.message,
      analysisId,
      processing_duration_ms: processingTime,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
    
  } finally {
    // Limpieza de archivos temporales
    console.log(`🧹 [${analysisId}] Limpiando archivos temporales...`);
    for (const cleanupPath of cleanupPaths) {
      try {
        if (await fs.promises.stat(cleanupPath).then(() => true).catch(() => false)) {
          if ((await fs.promises.stat(cleanupPath)).isDirectory()) {
            await fs.promises.rm(cleanupPath, { recursive: true, force: true });
          } else {
            await fs.promises.unlink(cleanupPath);
          }
        }
      } catch (cleanupError) {
        console.warn(`⚠️ [${analysisId}] Error limpiando ${cleanupPath}:`, cleanupError);
      }
    }
    console.log(`✅ [${analysisId}] Limpieza completada`);
  }
}
