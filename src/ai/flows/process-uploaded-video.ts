'use server';

/**
 * @fileOverview This file defines a Genkit flow for processing uploaded videos.
 * It is triggered by a Cloud Function when a new video is finalized in Storage.
 * It retrieves video metadata from Firestore, runs the analysis, and saves the results.
 *
 * @exports processUploadedVideo - The main function to trigger the processing flow.
 * @exports ProcessUploadedVideoInput - The input type for the processUploadedVideo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  analyzeBasketballShot,
  AnalyzeBasketballShotOutput,
} from './analyze-basketball-shot';
import {
  validateBasketballContent,
  ValidateBasketballContentOutput,
} from './validate-basketball-content';
import { analyzeVideoFrames } from './analyze-video-frames';
import { adminDb } from '@/lib/firebase-admin';
import type { Player } from '@/lib/types';
import { extractAndUploadSmartKeyframesAsync } from '@/lib/smart-keyframes';
// Usar Admin SDK (adminDb) directamente; no importar helpers del SDK cliente

// Nota: no lanzar error a nivel de módulo para no romper SSR; validamos en tiempo de ejecución

const ProcessUploadedVideoInputSchema = z.object({
  videoUrl: z
    .string()
    .describe('The GCS URI of the uploaded video (gs://...).'),
  filePath: z.string().describe('The full path of the file in the bucket.'),
});
export type ProcessUploadedVideoInput = z.infer<
  typeof ProcessUploadedVideoInputSchema
>;

export async function processUploadedVideo(
  input: ProcessUploadedVideoInput
): Promise<void> {
  return await processUploadedVideoFlow(input);
}

const processUploadedVideoFlow = ai.defineFlow(
  {
    name: 'processUploadedVideoFlow',
    inputSchema: ProcessUploadedVideoInputSchema,
    outputSchema: z.void(),
  },
  async ({ videoUrl, filePath }) => {
    if (!adminDb) {
      console.error('Admin DB not initialized. Set FIREBASE_ADMIN_* env vars.');
      return;
    }
    console.log(`Starting processing for video: ${videoUrl}`);
    // 1. Extract metadata from the file path
    // The path is `videos/${userId}/${Date.now()}-${file.name}`
    // The docId in pending_analyses is `${Date.now()}-${file.name}` without extension
    const pathParts = filePath.split('/');
    const userId = pathParts[1];
    const fileName = pathParts[2];
    const docId = fileName.substring(0, fileName.lastIndexOf('.'));

    if (!userId || !docId) {
      console.error('Could not extract userId or docId from path:', filePath);
      return;
    }

    // 2. Retrieve the pending analysis document from Firestore
    const pendingDocRef = adminDb.collection('pending_analyses').doc(docId);
    const pendingDocSnap = await pendingDocRef.get();

    if (!pendingDocSnap.exists) {
      console.error(`Pending analysis document not found: ${docId}`);
      // Maybe it was already processed, or it's an upload we don't care about.
      return;
    }
    const pendingData = pendingDocSnap.data() as any | undefined;
    if (!pendingData) {
      console.error('Pending data is empty for:', docId);
      return;
    }

    // 3. Retrieve player data
    const playerDocRef = adminDb.collection('players').doc(userId);
    const playerDocSnap = await playerDocRef.get();

    if (!playerDocSnap.exists) {
      console.error(`Player not found: ${userId}`);
      return;
    }
    const player = playerDocSnap.data() as Player;

    // 4. Prepare input for the analysis flow
    const ageGroup = player.ageGroup || 'Amateur';
    const ageCategory =
      ageGroup === 'Amateur'
        ? 'Amateur adulto'
        : (`Sub-${String(ageGroup).replace('U', '')}` as any);

    // 4.5. VALIDAR CONTENIDO DEL VIDEO ANTES DEL ANÁLISIS
        // Descargar el video desde GCS para análisis
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const bucketName = 'shot-analysis-storage';
    const storageFileName = filePath.replace('videos/', '');
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(storageFileName);
    
    // Descargar video a buffer
    const [videoBuffer] = await file.download();
    
    // Usar análisis real de frames (no solo URL)
    const contentValidation = await analyzeVideoFrames({
      videoBuffer: videoBuffer,
      framesPerSecond: 1
    });

    console.log('Resultado de validación:', contentValidation);

    if (!contentValidation.isBasketballContent || contentValidation.recommendation === 'REJECT') {
      console.error(`Video rechazado - No es contenido de baloncesto: ${contentValidation.reason}`);
      
      // Crear mensaje más específico para el usuario
      let userMessage = 'El video subido no corresponde a un lanzamiento de baloncesto.';
      if (contentValidation.nonBasketballIndicators && contentValidation.nonBasketballIndicators.length > 0) {
        userMessage += ` Se detectó: ${contentValidation.nonBasketballIndicators.join(', ')}.`;
      }
      userMessage += ' Por favor, sube un video que muestre claramente un jugador ejecutando un tiro al aro.';
      
      // Guardar análisis de rechazo
      const rejectedAnalysisData = {
        playerId: userId,
        createdAt: new Date().toISOString(),
        videoUrl,
        shotType: pendingData.shotType,
        status: 'rejected',
        rejectionReason: userMessage,
        validationResult: contentValidation,
        analysisSummary: 'Video rechazado: No contiene contenido válido de baloncesto.',
        strengths: [],
        weaknesses: [],
        recommendations: [
          'Sube un video que muestre claramente un tiro de baloncesto.',
          'Asegúrate de que el video incluya: canasta, balón, y movimiento de tiro.',
          'Evita videos de fiestas, otros deportes, o actividades no relacionadas con baloncesto.'
        ],
        selectedKeyframes: [],
        keyframeAnalysis: 'No aplicable - Video rechazado.',
        detailedChecklist: [],
      };

      const rejectedAnalysisRef = adminDb.collection('analyses').doc(docId);
      await rejectedAnalysisRef.set(rejectedAnalysisData);
      
      // Limpiar documento pendiente
      await pendingDocRef.delete();
            return;
    }

    if (contentValidation.recommendation === 'REVIEW') {
      console.warn(`Video requiere revisión manual: ${contentValidation.reason}`);
      // Marcar para revisión manual (podrías crear una cola de revisión)
    }

    // 4.6. Load admin prompt config for this shot type (if any)
    let promptConfig: any | undefined = undefined;
    try {
      // Helper function to get config doc ID with env prefix support
      const getConfigDocId = (shotType: string) => {
        const st = shotType.toLowerCase();
        const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
        const prefix = process.env.NEXT_PUBLIC_USE_ENV_PREFIX === 'true' ? `${env}_` : '';
        
        if (st.includes('tres')) return `${prefix}prompts_tres`;
        if (st.includes('media') || st.includes('jump')) return `${prefix}prompts_media`;
        if (st.includes('libre')) return `${prefix}prompts_libre`;
        return `${prefix}prompts_general`;
      };
      
      const cfgRef = adminDb.collection('config').doc(getConfigDocId(pendingData.shotType || ''));
      const cfgSnap = await cfgRef.get();
      const cfgData = cfgSnap.exists ? (cfgSnap.data() as any) : undefined;
      promptConfig = cfgData?.config;
    } catch (e) {
      console.warn('Could not load prompt config', e);
    }

    const aiInput = {
      videoUrl: videoUrl, // Use the GCS URI
      ageCategory: ageCategory,
      playerLevel: player.playerLevel || 'Intermedio',
      shotType: pendingData.shotType,
      availableKeyframes: [],
      promptConfig,
    };

    console.log('Calling analyzeBasketballShot flow with input:', aiInput);

    // 5. Run the analysis
    let analysisResult: AnalyzeBasketballShotOutput;
    try {
      analysisResult = await analyzeBasketballShot(aiInput);
    } catch (e: any) {
      console.error('Error en análisis de IA:', e?.message || e);
      
      // Guardar análisis de error
      const errorAnalysisData = {
        playerId: userId,
        createdAt: new Date().toISOString(),
        videoUrl,
        shotType: pendingData.shotType,
        status: 'error',
        errorMessage: e?.message || 'Error desconocido en análisis de IA',
        analysisSummary: 'Error en el análisis: No se pudo procesar el video con IA.',
        strengths: [],
        weaknesses: [],
        recommendations: ['Error técnico. Contacta al soporte si persiste.'],
        selectedKeyframes: [],
        keyframeAnalysis: 'No aplicable - Error en análisis.',
        detailedChecklist: [],
      };

      const errorAnalysisRef = adminDb.collection('analyses').doc(docId);
      await errorAnalysisRef.set(errorAnalysisData);
      
      // Limpiar documento pendiente
      await pendingDocRef.delete();
      console.log(`Análisis con error guardado: ${docId}`);
      return;
    }

    // 6. Save the final analysis to the 'analyses' collection
    const finalAnalysisData = {
      playerId: userId,
      createdAt: new Date().toISOString(),
      videoUrl, // Save the GCS path
      ...analysisResult,
      shotType: pendingData.shotType,
      // You might want a public URL here too, which can be generated.
      // For now, GCS path is enough for backend processing.
    };

    const newAnalysisRef = adminDb.collection('analyses').doc(docId);
    await newAnalysisRef.set(finalAnalysisData);

    console.log(`Analysis saved successfully for doc: ${docId}`);

    // 7. Extraer keyframes inteligentes (SÍNCRONO para asegurar que se generen)
    console.log('🔍 [Smart Keyframes] Iniciando extracción síncrona...');
    console.log('🔍 [Smart Keyframes] Video buffer size:', videoBuffer?.length || 0);
    console.log('🔍 [Smart Keyframes] Analysis ID:', docId);
    console.log('🔍 [Smart Keyframes] User ID:', userId);
    
    if (!videoBuffer || videoBuffer.length === 0) {
      console.error('❌ [Smart Keyframes] Video buffer está vacío, no se pueden extraer keyframes');
    } else {
      try {
        // Preparar buffers de video para keyframes
        const videoBuffers = {
          back: videoBuffer, // El video principal (back)
          front: undefined,
          left: undefined,
          right: undefined
        };
        
        // Extraer keyframes de forma síncrona
        await extractAndUploadSmartKeyframesAsync({
          analysisId: docId,
          videoBuffers,
          userId
        });
        
        console.log('✅ [Smart Keyframes] Extracción completada exitosamente');
        
        // Verificar si se guardaron
        const verificationDoc = await adminDb.collection('analyses').doc(docId).get();
        const verificationData = verificationDoc.data();
        if (verificationData?.smartKeyframes) {
          const total = Object.values(verificationData.smartKeyframes).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
          console.log(`✅ [Smart Keyframes] Verificación: ${total} keyframes guardados en DB`);
        } else {
          console.error('❌ [Smart Keyframes] Verificación: NO se guardaron keyframes en DB');
        }
      } catch (err) {
        console.error('❌ [Smart Keyframes] Error en extracción síncrona:', err);
        console.error('❌ [Smart Keyframes] Stack trace:', err instanceof Error ? err.stack : 'No stack');
        // No fallar el análisis completo si fallan los keyframes
      }
    }

    // 8. Clean up the pending document
    await pendingDocRef.delete();
    console.log(`Pending document deleted: ${docId}`);
  }
);
