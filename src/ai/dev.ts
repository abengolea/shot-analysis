import { config } from 'dotenv';
config();

import '@/ai/flows/content-moderation.ts';
import '@/ai/flows/generate-personalized-drills.ts';
import '@/ai/flows/analyze-basketball-shot.ts';
import '@/ai/flows/analyze-basketball-pose.ts';
import '@/ai/flows/validate-basketball-content.ts';
import '@/ai/flows/analyze-video-content.ts';
import '@/ai/flows/analyze-video-frames.ts';
import '@/ai/flows/process-uploaded-video.ts';

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { processUploadedVideo } from '@/ai/flows/process-uploaded-video';

// This is an auto-generated file, do not edit manually.
// You can edit the files in the src/ai/ directory to customize your AI flows.

// This is the entrypoint for the Genkit dev server.
// Exportar flows explícitamente para dev si la CLI lo requiere (evitar import de 'genkit/dev')
export { analyzeBasketballShot } from '@/ai/flows/analyze-basketball-shot';
export { analyzeBasketballPose } from '@/ai/flows/analyze-basketball-pose';
export { moderateContent as contentModeration } from '@/ai/flows/content-moderation';
export { validateBasketballContent } from '@/ai/flows/validate-basketball-content';
export { analyzeVideoContent } from '@/ai/flows/analyze-video-content';
export { analyzeVideoFrames } from '@/ai/flows/analyze-video-frames';
export { generatePersonalizedDrills } from '@/ai/flows/generate-personalized-drills';
export { processUploadedVideo as processUploadedVideoFlowEntry } from '@/ai/flows/process-uploaded-video';

// This is the entrypoint for your App Hosting flows.
// You can edit this file to add or remove flows.
export const processuploadedvideo = onObjectFinalized(
  {
    bucket: 'shotanalisys.firebasestorage.app',
    cpu: 2,
    memory: '4GiB',
    timeoutSeconds: 540,
  },
  async (event) => {
    const fileBucket = event.data.bucket; // The Storage bucket that contains the file.
    const filePath = event.data.name; // File path in the bucket.
    const contentType = event.data.contentType; // File content type.

    // Exit if this is triggered on a file that is not a video.
    if (!contentType?.startsWith('video/')) {
      console.log('This is not a video.');
      return;
    }

    if (!filePath.startsWith('videos/')) {
        console.log(`Not a video upload: ${filePath}`);
        return;
    }
    
    console.log(`Processing video: ${filePath}`);
    
    try {
        await processUploadedVideo({ videoUrl: `gs://${fileBucket}/${filePath}`, filePath });
    } catch (e) {
        console.error("Error processing video", e);
    }
  }
);
