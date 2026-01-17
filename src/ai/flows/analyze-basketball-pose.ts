'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Schema para los 22 parámetros técnicos del baloncesto
const BasketballMetricsSchema = z.object({
  // PREPARACIÓN (6 parámetros)
  footAlignment: z.number().describe('Alineación de pies en grados (-90 a 90)'),
  bodyAlignment: z.number().describe('Alineación del cuerpo en grados (-90 a 90)'),
  wristLoaded: z.boolean().describe('Muñeca cargada (flexionada hacia atrás)'),
  kneeFlexion: z.number().min(0).max(180).describe('Flexión de rodillas en grados (objetivo: 45-70°)'),
  shouldersRelaxed: z.boolean().describe('Hombros relajados (sin tensión excesiva)'),
  visualFocus: z.boolean().describe('Enfoque visual en el aro'),

  // ASCENSO (6 parámetros)
  nonDominantHandPosition: z.number().describe('Posición de mano no dominante (0-100%)'),
  elbowsCloseToBody: z.boolean().describe('Codos cerca del cuerpo'),
  ballStraightUp: z.boolean().describe('Subida recta del balón'),
  ballTrajectoryToSetPoint: z.number().describe('Trayectoria del balón hasta set point (0-100%)'),
  setPointHeight: z.number().describe('Altura del set point en metros'),
  shotTiming: z.number().describe('Tiempo de lanzamiento en milisegundos'),

  // FLUIDEZ (2 parámetros)
  singleMotion: z.boolean().describe('Tiro en un solo tiempo (continuo)'),
  legSync: z.number().describe('Sincronía con piernas (0-100%)'),

  // LIBERACIÓN (4 parámetros)
  nonDominantHandRelease: z.boolean().describe('Mano no dominante se suelta antes'),
  fullArmExtension: z.number().describe('Extensión completa del brazo en grados'),
  ballBackspin: z.boolean().describe('Giro de la pelota (backspin)'),
  releaseAngle: z.number().min(0).max(90).describe('Ángulo de salida en grados (objetivo: 45-52°)'),

  // SEGUIMIENTO (4 parámetros)
  balanceMaintenance: z.boolean().describe('Mantenimiento del equilibrio post-tiro'),
  landingBalance: z.number().describe('Equilibrio en aterrizaje (0-100%)'),
  followThroughDuration: z.number().describe('Duración del follow-through en milisegundos'),
  repetitiveConsistency: z.number().describe('Consistencia repetitiva (0-100%)')
});

const PoseAnalysisInputSchema = z.object({
  videoBuffer: z.instanceof(Buffer).describe('Buffer del video a analizar'),
  videoUrl: z.string().describe('URL del video (para logging)'),
  shotType: z.string().optional().describe('Tipo de tiro esperado'),
  ageCategory: z.string().optional().describe('Categoría de edad del jugador')
});

const PoseAnalysisOutputSchema = z.object({
  success: z.boolean().describe('Si el análisis fue exitoso'),
  metrics: BasketballMetricsSchema.optional().describe('Métricas técnicas del lanzamiento'),
  keyframePoses: z.array(z.object({
    timestamp: z.number().describe('Timestamp del keyframe'),
    poseKeypoints: z.array(z.object({
      x: z.number(),
      y: z.number(),
      confidence: z.number()
    })).describe('Puntos clave de pose detectados'),
    ballPosition: z.object({
      x: z.number(),
      y: z.number(),
      confidence: z.number()
    }).optional().describe('Posición del balón detectada')
  })).describe('Poses detectadas en keyframes'),
  analysisSummary: z.string().describe('Resumen del análisis técnico'),
  technicalRecommendations: z.array(z.string()).describe('Recomendaciones técnicas específicas'),
  overallScore: z.number().min(0).max(100).describe('Puntuación general del lanzamiento'),
  error: z.string().optional().describe('Error si el análisis falló')
});

export type PoseAnalysisInput = z.infer<typeof PoseAnalysisInputSchema>;
export type PoseAnalysisOutput = z.infer<typeof PoseAnalysisOutputSchema>;
export type BasketballMetrics = z.infer<typeof BasketballMetricsSchema>;

/**
 * Analiza un video de lanzamiento de baloncesto usando OpenPose
 * para extraer métricas técnicas precisas
 */
export async function analyzeBasketballPose(
  input: PoseAnalysisInput
): Promise<PoseAnalysisOutput> {
  try {
        // Crear directorio temporal para procesamiento
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openpose-'));
    const inputVideoPath = path.join(tempDir, 'input.mp4');
    const outputDir = path.join(tempDir, 'output');

    try {
      // Guardar video en archivo temporal
      await fs.writeFile(inputVideoPath, input.videoBuffer);
      await fs.mkdir(outputDir, { recursive: true });

      // Ejecutar OpenPose
      const poseData = await runOpenPose(inputVideoPath, outputDir);
      
      if (!poseData.success) {
        return {
          success: false,
          keyframePoses: [],
          analysisSummary: 'Error al ejecutar OpenPose',
          technicalRecommendations: [],
          overallScore: 0,
          error: poseData.error
        };
      }

      // Analizar las poses detectadas para extraer métricas técnicas
      const metrics = await extractBasketballMetrics(poseData.keyframes);
      
      // Generar recomendaciones técnicas
      const recommendations = generateTechnicalRecommendations(metrics);
      
      // Calcular puntuación general
      const score = calculateOverallScore(metrics);

      // Generar resumen del análisis
      const summary = generateAnalysisSummary(metrics, score);

      console.log('[analyzeBasketballPose] Análisis completado exitosamente');

      return {
        success: true,
        metrics,
        keyframePoses: poseData.keyframes,
        analysisSummary: summary,
        technicalRecommendations: recommendations,
        overallScore: score
      };

    } finally {
      // Limpiar archivos temporales
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('[analyzeBasketballPose] Error limpiando archivos temporales:', cleanupError);
      }
    }

  } catch (error: any) {
    console.error('[analyzeBasketballPose] Error en análisis:', error?.message || error);
    console.error('[analyzeBasketballPose] Stack:', error?.stack);

    return {
      success: false,
      keyframePoses: [],
      analysisSummary: 'Error técnico en el análisis de pose',
      technicalRecommendations: [],
      overallScore: 0,
      error: error?.message || 'Error desconocido'
    };
  }
}

/**
 * Ejecuta OpenPose en el video y extrae datos de pose
 */
async function runOpenPose(inputVideoPath: string, outputDir: string): Promise<{
  success: boolean;
  keyframes: any[];
  error?: string;
}> {
  return new Promise((resolve) => {
    // Comando OpenPose (ajustar según instalación)
    const openposeCommand = process.platform === 'win32' ? 
      'OpenPoseDemo.exe' : 
      './build/examples/openpose/openpose.bin';

    const args = [
      '--video', inputVideoPath,
      '--write_json', outputDir,
      '--display', '0',
      '--render_pose', '0',
      '--num_gpu', '1',
      '--num_gpu_start', '0'
    ];

    console.log('[runOpenPose] Ejecutando:', openposeCommand, args.join(' '));

    const childProcess = spawn(openposeCommand, args);

    let errorOutput = '';

    childProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      console.log('[runOpenPose] stderr:', data.toString());
    });

    childProcess.stdout.on('data', (data: Buffer) => {
      console.log('[runOpenPose] stdout:', data.toString());
    });

    childProcess.on('close', async (code: number | null) => {
      console.log('[runOpenPose] Proceso terminado con código:', code);

      if (code !== 0) {
        resolve({
          success: false,
          keyframes: [],
          error: `OpenPose falló con código ${code ?? 'desconocido'}: ${errorOutput}`
        });
        return;
      }

      try {
        // Leer archivos JSON generados por OpenPose
        const keyframes = await parseOpenPoseOutput(outputDir);
        resolve({
          success: true,
          keyframes
        });
      } catch (parseError: any) {
        resolve({
          success: false,
          keyframes: [],
          error: `Error parseando output de OpenPose: ${parseError.message}`
        });
      }
    });

    // Timeout de 5 minutos
    setTimeout(() => {
      childProcess.kill();
      resolve({
        success: false,
        keyframes: [],
        error: 'Timeout ejecutando OpenPose'
      });
    }, 300000);
  });
}

/**
 * Parsea los archivos JSON generados por OpenPose
 */
async function parseOpenPoseOutput(outputDir: string): Promise<any[]> {
  const files = await fs.readdir(outputDir);
  const jsonFiles = files.filter(f => f.endsWith('.json')).sort();

  const keyframes = [];

  for (const file of jsonFiles) {
    try {
      const filePath = path.join(outputDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Extraer timestamp del nombre del archivo
      const timestamp = parseFloat(file.replace('_keypoints.json', '')) || 0;
      
      keyframes.push({
        timestamp,
        poseKeypoints: data.people[0]?.pose_keypoints_2d || [],
        ballPosition: detectBallPosition(data) // Implementar detección de balón
      });
    } catch (error) {
      console.warn('[parseOpenPoseOutput] Error parseando archivo:', file, error);
    }
  }

  return keyframes;
}

/**
 * Detecta la posición del balón en los datos de OpenPose
 * (implementación simplificada - en producción usar YOLO)
 */
function detectBallPosition(data: any): { x: number; y: number; confidence: number } | undefined {
  // Implementación simplificada - en producción usar YOLO para detectar balón
  // Por ahora retornamos undefined
  return undefined;
}

/**
 * Extrae métricas técnicas del baloncesto de los datos de pose
 */
async function extractBasketballMetrics(keyframes: any[]): Promise<BasketballMetrics> {
  // Implementación de extracción de métricas
  // Este es un ejemplo simplificado - en producción sería mucho más complejo
  
  const metrics: BasketballMetrics = {
    // PREPARACIÓN
    footAlignment: 0, // Calcular desde puntos de pies
    bodyAlignment: 0, // Calcular desde hombros/caderas
    wristLoaded: false, // Detectar flexión de muñeca
    kneeFlexion: 0, // Calcular ángulo de rodillas
    shouldersRelaxed: true, // Analizar posición de hombros
    visualFocus: false, // Detectar dirección de mirada

    // ASCENSO
    nonDominantHandPosition: 0, // Posición de mano no dominante
    elbowsCloseToBody: false, // Distancia codos-cuerpo
    ballStraightUp: false, // Trayectoria del balón
    ballTrajectoryToSetPoint: 0, // Trayectoria hasta set point
    setPointHeight: 0, // Altura del set point
    shotTiming: 0, // Timing del lanzamiento

    // FLUIDEZ
    singleMotion: false, // Continuidad del movimiento
    legSync: 0, // Sincronía piernas-brazos

    // LIBERACIÓN
    nonDominantHandRelease: false, // Timing de liberación
    fullArmExtension: 0, // Extensión del brazo
    ballBackspin: false, // Detección de backspin
    releaseAngle: 0, // Ángulo de salida

    // SEGUIMIENTO
    balanceMaintenance: false, // Equilibrio post-tiro
    landingBalance: 0, // Equilibrio en aterrizaje
    followThroughDuration: 0, // Duración follow-through
    repetitiveConsistency: 0 // Consistencia
  };

  // TODO: Implementar lógica real de extracción de métricas
  // usando los keyframes de OpenPose

  return metrics;
}

/**
 * Genera recomendaciones técnicas basadas en las métricas
 */
function generateTechnicalRecommendations(metrics: BasketballMetrics): string[] {
  const recommendations: string[] = [];

  // Ejemplos de recomendaciones basadas en métricas
  if (metrics.kneeFlexion < 45) {
    recommendations.push('Aumentar la flexión de rodillas para generar más potencia');
  }
  
  if (metrics.releaseAngle < 45) {
    recommendations.push('Mejorar el ángulo de salida para mayor precisión');
  }

  if (!metrics.singleMotion) {
    recommendations.push('Trabajar en la fluidez del movimiento para un tiro más consistente');
  }

  return recommendations;
}

/**
 * Calcula la puntuación general del lanzamiento
 */
function calculateOverallScore(metrics: BasketballMetrics): number {
  // Implementación simplificada - en producción sería más compleja
  let score = 50; // Puntuación base

  // Ajustar basado en métricas específicas
  if (metrics.kneeFlexion >= 45 && metrics.kneeFlexion <= 70) score += 10;
  if (metrics.releaseAngle >= 45 && metrics.releaseAngle <= 52) score += 10;
  if (metrics.singleMotion) score += 10;
  if (metrics.fullArmExtension > 150) score += 10;
  if (metrics.balanceMaintenance) score += 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * Genera resumen del análisis técnico
 */
function generateAnalysisSummary(metrics: BasketballMetrics, score: number): string {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Analizar fortalezas y debilidades
  if (metrics.kneeFlexion >= 45 && metrics.kneeFlexion <= 70) {
    strengths.push('excelente flexión de rodillas');
  } else {
    weaknesses.push('flexión de rodillas necesita ajuste');
  }

  if (metrics.releaseAngle >= 45 && metrics.releaseAngle <= 52) {
    strengths.push('buen ángulo de salida');
  } else {
    weaknesses.push('ángulo de salida fuera del rango óptimo');
  }

  const summary = `Análisis técnico completado con puntuación de ${score}/100. `;
  const strengthsText = strengths.length > 0 ? `Fortalezas: ${strengths.join(', ')}. ` : '';
  const weaknessesText = weaknesses.length > 0 ? `Áreas de mejora: ${weaknesses.join(', ')}. ` : '';

  return summary + strengthsText + weaknessesText;
}
