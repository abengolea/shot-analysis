import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';

function manualParseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  });
  return out;
}

export function ensureEnvLoaded(): void {
  // First, try dotenv for standard .env then .env.local
  try { dotenvConfig(); } catch {}
  try { dotenvConfig({ path: '.env.local', override: true }); } catch {}

  const keys = ['GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_GENAI_API_KEY'];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length === 0) return;

  // Fallback: manually parse .env.local if present (handles uncommon encodings)
  try {
    if (fs.existsSync('.env.local')) {
      const buf = fs.readFileSync('.env.local');
      // Try UTF-8 decode; strip BOM if present
      let text = buf.toString('utf8');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const parsed = manualParseEnv(text);
      keys.forEach((k) => {
        if (!process.env[k] && parsed[k]) process.env[k] = parsed[k];
      });
    }
  } catch {}
}


