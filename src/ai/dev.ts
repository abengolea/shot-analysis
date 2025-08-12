import { config } from 'dotenv';
config();

import '@/ai/flows/content-moderation.ts';
import '@/ai/flows/generate-personalized-drills.ts';
import '@/ai/flows/analyze-basketball-shot.ts';