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

export interface AIKeyframeExtractionInput {
  analysisId: string;
  videoBuffers: {
    front?: Buffer;
    back?: Buffer;
    left?: Buffer;
    right?: Buffer;
  };
  userId: string;
  selectedKeyframes?: {
    front?: number[];
    back?: number[];
    left?: number[];
    right?: number[];
  };
  aiKeyframes?: {
    front?: Array<{ index: number; timestamp: number; description: string; imageBuffer: Buffer }>;
    back?: Array<{ index: number; timestamp: number; description: string; imageBuffer: Buffer }>;
    left?: Array<{ index: number; timestamp: number; description: string; imageBuffer: Buffer }>;
    right?: Array<{ index: number; timestamp: number; description: string; imageBuffer: Buffer }>;
  };
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
        console.log(`🔍 [Keyframes] VideoBuffers disponibles:`, {
      front: videoBuffers.front ? `${(videoBuffers.front.length / 1024 / 1024).toFixed(2)}MB` : 'No disponible',
      back: videoBuffers.back ? `${(videoBuffers.back.length / 1024 / 1024).toFixed(2)}MB` : 'No disponible',
      left: videoBuffers.left ? `${(videoBuffers.left.length / 1024 / 1024).toFixed(2)}MB` : 'No disponible',
      right: videoBuffers.right ? `${(videoBuffers.right.length / 1024 / 1024).toFixed(2)}MB` : 'No disponible'
    });
    
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
                // Extraer 6 keyframes del video
        const frames = await extractKeyframesFromBuffer(buffer, 6);
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
      
          } else {
          }
    
  } catch (error) {
    console.error(`❌ [Keyframes] Error general para ${analysisId}:`, error);
    // No lanzar error para no afectar el proceso principal
  }
}

/**
 * Extrae keyframes seleccionados por IA y los sube a Firebase Storage
 * Esta función usa los keyframes ya extraídos por la IA para el análisis
 */
export async function extractAndUploadAIKeyframesAsync(input: AIKeyframeExtractionInput): Promise<void> {
  const { analysisId, videoBuffers, userId, selectedKeyframes, aiKeyframes } = input;
  
  try {
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
        console.log(`⏭️ [AI Keyframes] Sin video para ángulo: ${angle}`);
        continue;
      }
      
      try {
        // Si tenemos keyframes de IA para este ángulo, usarlos
        const angleAIKeyframes = aiKeyframes?.[angle];
        const angleSelectedIndices = selectedKeyframes?.[angle] || [0, 1, 2, 3, 4, 5]; // Fallback a primeros 6
        
        if (angleAIKeyframes && angleAIKeyframes.length > 0) {
                    console.log(`🤖 [AI Keyframes] Keyframes disponibles para ${angle}:`, angleAIKeyframes.length);
          
          // Filtrar solo los keyframes seleccionados por IA
          const selectedAIKeyframes = angleSelectedIndices
            .map(index => angleAIKeyframes[index])
            .filter(Boolean); // Filtrar índices inválidos
          
                    for (const keyframe of selectedAIKeyframes) {
            if (!keyframe || !keyframe.imageBuffer) {
              console.warn(`⚠️ [AI Keyframes] Keyframe inválido para ${angle}, saltando...`);
              continue;
            }
            
            const filePath = `analyses/${userId}/${analysisId}/keyframes/${angle}_${keyframe.index}.jpg`;
            const fileRef = adminStorage.bucket().file(filePath);
            
            await fileRef.save(keyframe.imageBuffer, {
              metadata: {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000', // Cache por 1 año
              },
            });
            
            const [url] = await fileRef.getSignedUrl({
              action: 'read',
              expires: '03-09-2491', // Expira en el futuro lejano
            });
            
            keyframeUrls[angle].push(url);
            console.log(`✅ [AI Keyframes] Subido keyframe ${keyframe.index} (${keyframe.timestamp.toFixed(2)}s) para ${angle}`);
          }
        } else {
          // Fallback: usar extracción tradicional
                    const extractedFrames = await extractKeyframesFromBuffer(buffer, 6);
          
          for (const frame of extractedFrames) {
            const filePath = `analyses/${userId}/${analysisId}/keyframes/${angle}_${frame.index}.jpg`;
            const fileRef = adminStorage.bucket().file(filePath);
            
            await fileRef.save(frame.imageBuffer, {
              metadata: {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000',
              },
            });
            
            const [url] = await fileRef.getSignedUrl({
              action: 'read',
              expires: '03-09-2491',
            });
            
            keyframeUrls[angle].push(url);
          }
        }
        
              } catch (error) {
        console.error(`❌ [AI Keyframes] Error procesando ${angle}:`, error);
      }
    }
    
    // Actualizar el documento de análisis en Firestore con las URLs de los keyframes
    await adminDb.collection('analyses').doc(analysisId).update({
      keyframes: keyframeUrls,
      keyframesMetadata: {
        extractionMethod: 'ai-selected',
        selectedByAI: true,
        totalKeyframes: Object.values(keyframeUrls).flat().length,
        extractionTimestamp: new Date().toISOString()
      },
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`✅ [AI Keyframes] Guardados ${Object.values(keyframeUrls).flat().length} keyframes seleccionados por IA en Firestore para ${analysisId}`);
  } catch (error) {
    console.error(`❌ [AI Keyframes] Error en extracción asíncrona con IA:`, error);
  }
}

