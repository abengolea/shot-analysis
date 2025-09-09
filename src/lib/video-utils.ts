import { promises as fs } from 'fs';
import path from 'path';

export interface KeyframeInfo {
  timestamp: number;
  frameNumber: number;
  description: string;
}

export interface ExtractedKeyframes {
  front: string[];
  back: string[];
  left: string[];
  right: string[];
}

/**
 * Genera keyframes simulados basados en el video
 * Esta es una solución temporal hasta implementar extracción real
 */
export async function generateVideoKeyframes(
  videoUrl: string,
  analysisId: string
): Promise<ExtractedKeyframes> {
  try {
    console.log('🎬 Generando keyframes simulados para:', videoUrl);
    
    // Crear keyframes simulados con diferentes momentos del tiro
    const keyframeMoments = [
      { time: '00:00:01', description: 'Inicio del movimiento' },
      { time: '00:00:02', description: 'Preparación del tiro' },
      { time: '00:00:03', description: 'Elevación de la pelota' },
      { time: '00:00:04', description: 'Punto de liberación' },
      { time: '00:00:05', description: 'Seguimiento del movimiento' }
    ];
    
    // Generar URLs únicas para cada keyframe
    const baseUrl = `https://storage.googleapis.com/${process.env.FIREBASE_ADMIN_STORAGE_BUCKET}/keyframes`;
    const userId = 'temp'; // Se reemplazará con el ID real del usuario
    
    const extractedFrames: string[] = [];
    
    for (let i = 0; i < keyframeMoments.length; i++) {
      const moment = keyframeMoments[i];
      const fileName = `keyframe_${i}_${Date.now()}.jpg`;
      const keyframeUrl = `${baseUrl}/${userId}/${analysisId}/${fileName}`;
      
      extractedFrames.push(keyframeUrl);
      console.log(`✅ Keyframe ${i + 1} generado: ${moment.description}`);
    }
    
    // Simular 4 ángulos (por ahora todos iguales)
    const keyframes: ExtractedKeyframes = {
      front: extractedFrames.slice(0, 3),
      back: extractedFrames.slice(0, 3),
      left: extractedFrames.slice(0, 3),
      right: extractedFrames.slice(0, 3)
    };
    
    console.log('🎯 Keyframes simulados generados exitosamente:', keyframes);
    return keyframes;
    
  } catch (error) {
    console.error('❌ Error generando keyframes simulados:', error);
    throw new Error(`Error generando keyframes: ${error}`);
  }
}

/**
 * Función placeholder para futura implementación con FFmpeg
 * Por ahora retorna keyframes simulados
 */
export async function extractVideoKeyframes(
  videoPath: string,
  outputDir: string
): Promise<ExtractedKeyframes> {
  console.log('⚠️ FFmpeg no disponible, usando keyframes simulados');
  
  // Generar keyframes simulados como fallback
  const analysisId = path.basename(outputDir).replace('keyframes_', '');
  return generateVideoKeyframes('placeholder', analysisId);
}

/**
 * Convierte un archivo local a base64
 */
export async function fileToBase64(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return fileBuffer.toString('base64');
  } catch (error) {
    console.error('❌ Error convirtiendo archivo a base64:', error);
    throw error;
  }
}

/**
 * Limpia archivos temporales
 */
export async function cleanupTempFiles(files: string[]): Promise<void> {
  try {
    for (const file of files) {
      try {
        await fs.unlink(file);
        console.log(`🗑️ Archivo temporal eliminado: ${file}`);
      } catch (unlinkError) {
        console.log(`⚠️ No se pudo eliminar archivo temporal: ${file}`);
      }
    }
  } catch (error) {
    console.error('❌ Error limpiando archivos temporales:', error);
  }
}

/**
 * Función para generar keyframes reales en el futuro
 * Esta función se puede implementar cuando tengamos acceso a FFmpeg
 */
export async function generateRealKeyframes(
  videoBuffer: Buffer,
  analysisId: string
): Promise<ExtractedKeyframes> {
  console.log('🚧 Función de keyframes reales no implementada aún');
  console.log('📝 Por ahora se usan keyframes simulados');
  
  // Retornar keyframes simulados como fallback
  return generateVideoKeyframes('placeholder', analysisId);
}
