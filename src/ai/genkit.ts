import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { config as loadEnv } from 'dotenv';

// Cargar variables desde .env y .env.local (fallback explícito en Windows)
try {
  loadEnv();
  loadEnv({ path: '.env.local', override: true });
} catch {}

// Soportar nombres alternativos si el .env tiene sufijo _KEY por error y evitar bloqueos
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  (process.env as any).GEMINI_API_KEY_KEY ||
  (process.env as any).GOOGLE_API_KEY_KEY ||
  (process.env as any).GOOGLE_GENAI_API_KEY_KEY;

if (!apiKey) {
  console.warn('[Genkit] No se encontró GEMINI_API_KEY/GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY en variables de entorno.');
} else {
  const masked = apiKey.length > 8 ? apiKey.slice(0, 4) + '***' + apiKey.slice(-4) : '***';
  console.log(`[Genkit] API key detectada (longitud=${apiKey.length}): ${masked}`);
}

const googlePlugin = apiKey ? googleAI({ apiKey }) : googleAI();

export const ai = genkit({
  plugins: [googlePlugin],
  model: 'googleai/gemini-2.0-flash',
});
