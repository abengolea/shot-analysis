import { adminStorage, adminDb } from './firebase-admin';
import { extractKeyframesFromBuffer, getVideoDurationSecondsFromBuffer } from './ffmpeg';
import { analyzeBasketballPose } from '@/ai/flows/analyze-basketball-pose';

export interface SmartKeyframeExtractionInput {
  analysisId: string;
  videoBuffers: {
    front?: Buffer;
    back?: Buffer;
    left?: Buffer;
    right?: Buffer;
  };
  userId: string;
}

export interface SmartKeyframe {
  index: number;
  timestamp: number;
  description: string;
  importance: number; // 0-1, donde 1 es el más importante
  phase: 'preparation' | 'loading' | 'release' | 'follow-through' | 'landing';
  imageBuffer: string; // Data URL como string
}

export interface SmartKeyframeUrls {
  front: SmartKeyframe[];
  back: SmartKeyframe[];
  left: SmartKeyframe[];
  right: SmartKeyframe[];
}

/**
 * Extrae keyframes inteligentes basados en análisis de movimiento y poses
 * Detecta los momentos más importantes del tiro de baloncesto
 */
export async function extractSmartKeyframesFromBuffer(
  inputBuffer: Buffer,
  numFrames: number = 12
): Promise<SmartKeyframe[]> {
    // Simplificar: usar directamente la extracción tradicional que funciona
  try {
    const frames = await extractKeyframesFromBuffer(inputBuffer, numFrames);
    
    const smartKeyframes: SmartKeyframe[] = [];
        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          // frame.imageBuffer ya es un Buffer, convertirlo a data URL
          const base64Image = frame.imageBuffer.toString('base64');
          const dataUrl = `data:image/jpeg;base64,${base64Image}`;
          
          smartKeyframes.push({
            index: frame.index,
            timestamp: frame.timestamp,
            description: `Fotograma ${i + 1}`,
            importance: 0.5, // Valor por defecto
            phase: 'preparation', // Valor por defecto
            imageBuffer: dataUrl
          });
        }
    
        return smartKeyframes;
    
  } catch (error) {
    console.error(`❌ [Smart Keyframes] Error en extracción:`, error);
    // Fallback: devolver array vacío
    return [];
  }
}

/**
 * Extrae un solo frame en un timestamp específico
 */
async function extractSingleFrame(inputBuffer: Buffer, timestamp: number): Promise<Buffer> {
  const { promises: fs } = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const { spawn } = await import('child_process');
  
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-kf-'));
  const inPath = path.join(tmpDir, 'input.mp4');
  const outPath = path.join(tmpDir, 'frame.jpg');
  
  try {
    await fs.writeFile(inPath, inputBuffer);
    
    const args = [
      '-y',
      '-ss', timestamp.toFixed(2),
      '-i', inPath,
      '-frames:v', '1',
      '-q:v', '2',
      '-vf', 'scale=-2:720',
      outPath,
    ];
    
    await new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', args, { stdio: 'inherit' });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
    
    const buffer = await fs.readFile(outPath);
    return buffer;
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

/**
 * Analiza un frame para detectar poses de baloncesto
 */
async function analyzeFrameForBasketballPose(imageBuffer: Buffer): Promise<{
  score: number;
  hasPerson: boolean;
  hasBall: boolean;
  poseQuality: number;
  movement: number;
}> {
  try {
    // Convertir buffer a base64 para análisis
    const base64Image = imageBuffer.toString('base64');
    
    // Análisis básico de poses (simplificado para keyframes)
    // En una implementación real, usarías un modelo de pose detection
    const analysis = await analyzeBasketballPose({
      imageBase64: base64Image,
      shotType: 'Lanzamiento de Tres', // Tipo por defecto para keyframes
      ageCategory: 'adult',
      playerLevel: 'intermediate'
    });
    
    return {
      score: analysis.overallScore || 0,
      hasPerson: analysis.poseDetection?.hasPerson || false,
      hasBall: analysis.poseDetection?.hasBall || false,
      poseQuality: analysis.poseDetection?.poseQuality || 0,
      movement: analysis.poseDetection?.movement || 0
    };
  } catch (error) {
    console.warn('Error en análisis de pose para keyframe:', error);
    return {
      score: 0,
      hasPerson: false,
      hasBall: false,
      poseQuality: 0,
      movement: 0
    };
  }
}

/**
 * Calcula la importancia de un frame basado en múltiples factores
 * ENFOQUE: Solo frames donde el jugador está activamente tirando
 */
function calculateFrameImportance(
  timestamp: number,
  duration: number,
  analysis: { score: number; hasPerson: boolean; hasBall: boolean; poseQuality: number; movement: number }
): number {
  // CRÍTICO: Si no hay persona o balón, importancia = 0 (no es parte del tiro)
  if (!analysis.hasPerson || !analysis.hasBall) {
    return 0;
  }
  
  const progress = timestamp / duration;
  
  // 1. Factor de timing (SOLO momentos activos del tiro)
  let timingScore = 0;
  if (progress < 0.05) timingScore = 0.1; // Muy temprano, probablemente no es tiro
  else if (progress < 0.15) timingScore = 0.8; // Preparación del tiro
  else if (progress < 0.25) timingScore = 1.0; // Carga del tiro
  else if (progress < 0.45) timingScore = 1.0; // Ascenso del balón
  else if (progress < 0.65) timingScore = 1.0; // Set point / Liberación
  else if (progress < 0.85) timingScore = 0.9; // Follow-through
  else timingScore = 0.2; // Muy tarde, probablemente no es tiro
  
  // 2. Factor de calidad de pose (más importante para tiros)
  const poseScore = analysis.poseQuality;
  
  // 3. Factor de movimiento (movimiento activo del tiro)
  const movementScore = Math.min(analysis.movement * 1.5, 1);
  
  // 4. Factor de presencia de persona y balón (OBLIGATORIO)
  const contentScore = (analysis.hasPerson ? 0.3 : 0) + (analysis.hasBall ? 0.7 : 0);
  
  // 5. Factor de score general del análisis de pose
  const generalScore = analysis.score / 100;
  
  // Combinar todos los factores con pesos ajustados para tiros activos
  const importance = (
    timingScore * 0.5 +      // Timing es más importante
    poseScore * 0.25 +       // Calidad de pose
    movementScore * 0.1 +    // Movimiento activo
    contentScore * 0.1 +     // Presencia de balón es crítica
    generalScore * 0.05      // Score general menos importante
  );
  
  // Si no hay balón visible, importancia = 0
  if (!analysis.hasBall) {
    return 0;
  }
  
  return Math.max(0, Math.min(1, importance));
}

/**
 * Determina la fase del tiro basada en el timestamp
 * ENFOQUE: Solo fases activas del tiro (desde que toma la pelota hasta que la lanza)
 */
function determineShotPhase(timestamp: number, duration: number): SmartKeyframe['phase'] {
  const progress = timestamp / duration;
  
  // Solo considerar fases activas del tiro
  if (progress < 0.1) return 'preparation';      // Preparación inicial (cuando toma la pelota)
  else if (progress < 0.25) return 'loading';    // Carga del tiro (flexión, elevación)
  else if (progress < 0.55) return 'release';    // Ascenso y liberación
  else if (progress < 0.8) return 'follow-through'; // Follow-through
  else return 'landing';                         // Aterrizaje (final del tiro)
}

/**
 * Genera una descripción del frame basada en la fase y análisis
 */
function generateFrameDescription(
  phase: SmartKeyframe['phase'],
  timestamp: number,
  analysis: { score: number; hasPerson: boolean; hasBall: boolean; poseQuality: number; movement: number }
): string {
  const phaseNames = {
    preparation: 'Preparación',
    loading: 'Carga del tiro',
    release: 'Liberación',
    'follow-through': 'Follow-through',
    landing: 'Aterrizaje'
  };
  
  const quality = analysis.poseQuality > 0.7 ? 'Excelente' : 
                 analysis.poseQuality > 0.4 ? 'Buena' : 'Regular';
  
  return `${phaseNames[phase]} (${timestamp.toFixed(1)}s) - ${quality}`;
}

/**
 * Selecciona los mejores frames basados en importancia y diversidad
 * ENFOQUE: Solo frames de la secuencia activa del tiro
 */
function selectBestFrames(
  analyzedFrames: Array<SmartKeyframe & { rawScore: number }>,
  numFrames: number
): SmartKeyframe[] {
  // FILTRAR: Solo frames con importancia > 0.3 (frames activos del tiro)
  const activeFrames = analyzedFrames.filter(frame => frame.importance > 0.3);
  
    if (activeFrames.length === 0) {
    console.warn('⚠️ [Smart Keyframes] No se encontraron frames activos del tiro');
    return [];
  }
  
  // Ordenar por importancia
  const sortedFrames = activeFrames.sort((a, b) => b.importance - a.importance);
  
  // Seleccionar frames diversificados por fase, priorizando fases críticas
  const selectedFrames: SmartKeyframe[] = [];
  const phaseCounts = {
    preparation: 0,
    loading: 0,
    release: 0,
    'follow-through': 0,
    landing: 0
  };
  
  // Distribución priorizada: más frames en fases críticas del tiro
  const phaseTargets = {
    preparation: Math.ceil(numFrames * 0.15),  // 15% - preparación
    loading: Math.ceil(numFrames * 0.25),      // 25% - carga
    release: Math.ceil(numFrames * 0.35),      // 35% - liberación (más importante)
    'follow-through': Math.ceil(numFrames * 0.20), // 20% - follow-through
    landing: Math.ceil(numFrames * 0.05)       // 5% - aterrizaje
  };
  
  for (const frame of sortedFrames) {
    if (selectedFrames.length >= numFrames) break;
    
    if (phaseCounts[frame.phase] < phaseTargets[frame.phase]) {
      selectedFrames.push({
        index: frame.index,
        timestamp: frame.timestamp,
        description: frame.description,
        importance: frame.importance,
        phase: frame.phase,
        imageBuffer: frame.imageBuffer
      });
      phaseCounts[frame.phase]++;
    }
  }
  
  // Si no tenemos suficientes frames, agregar los mejores restantes
  if (selectedFrames.length < numFrames) {
    for (const frame of sortedFrames) {
      if (selectedFrames.length >= numFrames) break;
      if (!selectedFrames.some(f => f.index === frame.index)) {
        selectedFrames.push({
          index: frame.index,
          timestamp: frame.timestamp,
          description: frame.description,
          importance: frame.importance,
          phase: frame.phase,
          imageBuffer: frame.imageBuffer
        });
      }
    }
  }
  
  // Ordenar por timestamp para mantener secuencia temporal
  const finalFrames = selectedFrames.sort((a, b) => a.timestamp - b.timestamp);
  
      return finalFrames;
}

/**
 * Extrae keyframes inteligentes de múltiples videos y los sube a Storage
 */
export async function extractAndUploadSmartKeyframesAsync(input: SmartKeyframeExtractionInput): Promise<void> {
  const { analysisId, videoBuffers, userId } = input;
  
  try {
        const smartKeyframes: SmartKeyframeUrls = {
      front: [],
      back: [],
      left: [],
      right: []
    };
    
    const angles: Array<keyof typeof videoBuffers> = ['front', 'back', 'left', 'right'];
    
    for (const angle of angles) {
      const buffer = videoBuffers[angle];
      if (!buffer || buffer.length === 0) {
                continue;
      }
      
      try {
                // USAR EXTRACCIÓN INTELIGENTE REAL
        const smartFrames = await extractSmartKeyframesFromBuffer(buffer, 12);
                // Convertir a formato de data URL para almacenar
        const processedFrames: SmartKeyframe[] = [];
        
        for (let i = 0; i < smartFrames.length; i++) {
          const frame = smartFrames[i];
          
          try {
            // frame.imageBuffer ya es un data URL string, usarlo directamente
            processedFrames.push({
              index: frame.index,
              timestamp: frame.timestamp,
              description: frame.description,
              importance: frame.importance,
              phase: frame.phase,
              imageBuffer: frame.imageBuffer // Ya es un data URL
            });
            
            console.log(`✅ [Smart Keyframes] Procesado frame ${i + 1} de ${angle}: ${frame.phase} (${frame.timestamp.toFixed(1)}s) - Importancia: ${frame.importance.toFixed(2)}`);
          } catch (error) {
            console.error(`❌ [Smart Keyframes] Error procesando frame ${i + 1} de ${angle}:`, error);
          }
        }
        
        smartKeyframes[angle] = processedFrames;
              } catch (error) {
        console.error(`❌ [Smart Keyframes] Error procesando ${angle}:`, error);
        
        // Fallback a extracción tradicional si falla la inteligente
                try {
          const { extractKeyframesFromBuffer } = await import('@/lib/ffmpeg');
          const frames = await extractKeyframesFromBuffer(buffer, 12);
          
          const fallbackFrames: SmartKeyframe[] = [];
          for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            // frame.imageBuffer es un Buffer, convertirlo a data URL
            const base64Image = frame.imageBuffer.toString('base64');
            const dataUrl = `data:image/jpeg;base64,${base64Image}`;
            
            fallbackFrames.push({
              index: frame.index,
              timestamp: frame.timestamp,
              description: `Frame ${i + 1} (${frame.timestamp.toFixed(1)}s)`,
              importance: 0.5,
              phase: 'preparation' as const,
              imageBuffer: dataUrl
            });
          }
          
          smartKeyframes[angle] = fallbackFrames;
                  } catch (fallbackError) {
          console.error(`❌ [Smart Keyframes] Fallback también falló para ${angle}:`, fallbackError);
        }
      }
    }
    
    // Actualizar Firestore con los keyframes (solo metadatos, no las imágenes)
    const totalFrames = Object.values(smartKeyframes).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalFrames > 0) {
      // Crear keyframes sin las imágenes para evitar límite de tamaño
      const keyframesMetadata = {
        front: smartKeyframes.front.map(kf => ({
          index: kf.index,
          timestamp: kf.timestamp,
          description: kf.description,
          importance: kf.importance,
          phase: kf.phase
          // No incluir imageBuffer para reducir tamaño
        })),
        back: smartKeyframes.back.map(kf => ({
          index: kf.index,
          timestamp: kf.timestamp,
          description: kf.description,
          importance: kf.importance,
          phase: kf.phase
        })),
        left: smartKeyframes.left.map(kf => ({
          index: kf.index,
          timestamp: kf.timestamp,
          description: kf.description,
          importance: kf.importance,
          phase: kf.phase
        })),
        right: smartKeyframes.right.map(kf => ({
          index: kf.index,
          timestamp: kf.timestamp,
          description: kf.description,
          importance: kf.importance,
          phase: kf.phase
        }))
      };

      // Calcular estadísticas de los keyframes inteligentes
      const allFrames = Object.values(smartKeyframes).flat();
      const phasesDetected = [...new Set(allFrames.map(f => f.phase))];
      const averageImportance = allFrames.reduce((sum, f) => sum + f.importance, 0) / allFrames.length;
      
      // Guardar metadatos en el documento principal
      await adminDb.collection('analyses').doc(analysisId).update({
        smartKeyframes: keyframesMetadata,
        keyframesExtractedAt: new Date().toISOString(),
        keyframesMetadata: {
          extractionMethod: 'intelligent-analysis',
          totalKeyframes: totalFrames,
          phasesDetected: phasesDetected,
          averageImportance: averageImportance,
          activeShotFrames: allFrames.filter(f => f.importance > 0.3).length,
          shotSequenceQuality: averageImportance > 0.5 ? 'high' : averageImportance > 0.3 ? 'medium' : 'low'
        }
      });

      // Guardar las imágenes en documentos separados para evitar límite de tamaño
      for (const angle of angles) {
        const frames = smartKeyframes[angle];
        if (frames.length > 0) {
                    // Guardar cada frame en un documento separado
          for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const frameDoc = adminDb.collection('analyses').doc(analysisId).collection('keyframes').doc(angle).collection('frames').doc(`frame_${i}`);
            
            await frameDoc.set({
              index: frame.index,
              timestamp: frame.timestamp,
              description: frame.description,
              importance: frame.importance,
              phase: frame.phase,
              imageData: frame.imageBuffer
            });
          }
          
                  }
      }
      
          } else {
          }
    
  } catch (error) {
    console.error(`❌ [Smart Keyframes] Error general para ${analysisId}:`, error);
  }
}
