import { adminStorage, adminDb } from './firebase-admin';
import { extractKeyframesFromBuffer } from './ffmpeg';

export interface KeyframeExtractionInput {
  analysisId: string;
  videoBuffers: {
    front?: Buffer;
    back?: Buffer;
    left?: Buffer;
    right?: Buffer;
  };
  userId: string;
}

export interface KeyframeUrls {
  front: string[];
  back: string[];
  left: string[];
  right: string[];
}

/**
 * Extrae keyframes de los videos y los sube a Firebase Storage de forma asíncrona
 * Esta función se ejecuta en background y no bloquea el análisis principal
 */
export async function extractAndUploadKeyframesAsync(input: KeyframeExtractionInput): Promise<void> {
  const { analysisId, videoBuffers, userId } = input;
  
  try {
    console.log(`🖼️ [Keyframes] Iniciando extracción para análisis: ${analysisId}`);
    
    const keyframeUrls: KeyframeUrls = {
      front: [],
      back: [],
      left: [],
      right: []
    };
    
    const angles: Array<keyof typeof videoBuffers> = ['front', 'back', 'left', 'right'];
    
    for (const angle of angles) {
      const buffer = videoBuffers[angle];
      if (!buffer || buffer.length === 0) {
        console.log(`⏭️ [Keyframes] Sin video para ángulo: ${angle}`);
        continue;
      }
      
      try {
        console.log(`📸 [Keyframes] Extrayendo 6 frames del ángulo: ${angle}`);
        
        // Extraer 6 keyframes del video
        const frames = await extractKeyframesFromBuffer(buffer, 6);
        console.log(`✅ [Keyframes] Extraídos ${frames.length} frames de ${angle}`);
        
        // Subir cada frame a Storage
        for (const frame of frames) {
          const fileName = `keyframes/${userId}/${analysisId}/${angle}/frame_${frame.index}.jpg`;
          const file = adminStorage.bucket().file(fileName);
          
          await file.save(frame.imageBuffer, {
            metadata: {
              contentType: 'image/jpeg',
              metadata: {
                analysisId,
                angle,
                frameIndex: frame.index.toString(),
                timestamp: frame.timestamp.toString()
              }
            }
          });
          
          // Hacer el archivo público o generar URL firmada
          await file.makePublic();
          const publicUrl = `https://storage.googleapis.com/${adminStorage.bucket().name}/${fileName}`;
          
          keyframeUrls[angle].push(publicUrl);
        }
        
        console.log(`✅ [Keyframes] Subidos ${keyframeUrls[angle].length} frames de ${angle} a Storage`);
      } catch (error) {
        console.error(`❌ [Keyframes] Error procesando ${angle}:`, error);
        // Continuar con los demás ángulos aunque uno falle
      }
    }
    
    // Actualizar Firestore con las URLs de los keyframes
    const totalFrames = Object.values(keyframeUrls).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalFrames > 0) {
      await adminDb.collection('analyses').doc(analysisId).update({
        keyframes: keyframeUrls,
        keyframesExtractedAt: new Date().toISOString()
      });
      
      console.log(`✅ [Keyframes] Guardados ${totalFrames} keyframes en Firestore para ${analysisId}`);
    } else {
      console.log(`⚠️ [Keyframes] No se extrajeron keyframes para ${analysisId}`);
    }
    
  } catch (error) {
    console.error(`❌ [Keyframes] Error general para ${analysisId}:`, error);
    // No lanzar error para no afectar el proceso principal
  }
}

