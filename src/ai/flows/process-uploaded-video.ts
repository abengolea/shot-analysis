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
import { adminDb } from '@/lib/firebase';
import type { Player } from '@/lib/types';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

if (!adminDb) {
  throw new Error(
    'Admin DB not initialized. Make sure FIREBASE_SERVICE_ACCOUNT is set.'
  );
}

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
    const pendingDocRef = doc(adminDb, 'pending_analyses', docId);
    const pendingDocSnap = await getDoc(pendingDocRef);

    if (!pendingDocSnap.exists()) {
      console.error(`Pending analysis document not found: ${docId}`);
      // Maybe it was already processed, or it's an upload we don't care about.
      return;
    }
    const pendingData = pendingDocSnap.data();

    // 3. Retrieve player data
    const playerDocRef = doc(adminDb, 'players', userId);
    const playerDocSnap = await getDoc(playerDocRef);

    if (!playerDocSnap.exists()) {
      console.error(`Player not found: ${userId}`);
      return;
    }
    const player = playerDocSnap.data() as Player;

    // 4. Prepare input for the analysis flow
    const ageCategory =
      player.ageGroup === 'Amateur'
        ? 'Amateur adulto'
        : (`Sub-${player.ageGroup.replace('U', '')}` as any);

    const aiInput = {
      videoUrl: videoUrl, // Use the GCS URI
      ageCategory: ageCategory,
      playerLevel: player.playerLevel,
      shotType: pendingData.shotType,
    };

    console.log('Calling analyzeBasketballShot flow with input:', aiInput);

    // 5. Run the analysis
    const analysisResult: AnalyzeBasketballShotOutput =
      await analyzeBasketballShot(aiInput);

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

    const newAnalysisRef = doc(adminDb, 'analyses', docId);
    await setDoc(newAnalysisRef, finalAnalysisData);

    console.log(`Analysis saved successfully for doc: ${docId}`);

    // 7. Clean up the pending document
    await deleteDoc(pendingDocRef);
    console.log(`Pending document deleted: ${docId}`);
  }
);
