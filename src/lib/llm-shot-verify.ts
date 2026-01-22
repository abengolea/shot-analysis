import { ai } from '@/ai/genkit';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';

type GenkitPart =
  | { text: string }
  | { media: { url: string; contentType: string } };

type LlmShotVerification = {
  has_shot_attempt: boolean;
  confidence?: number;
  reasoning?: string;
};

async function fetchVideoBuffer(videoUrl: string): Promise<Buffer | null> {
  try {
    const resp = await fetch(videoUrl);
    if (!resp.ok) return null;
    const ab = await resp.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

export async function verifyHasShotsWithLlmFromVideoUrl(
  videoUrl: string,
  targetFrames = 6
): Promise<LlmShotVerification | null> {
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
  if (!hasKey) return null;
  const videoBuffer = await fetchVideoBuffer(videoUrl);
  if (!videoBuffer || videoBuffer.length === 0) return null;

  const frames = await extractKeyframesFromBuffer(videoBuffer, targetFrames);
  if (!frames || frames.length === 0) return null;

  const parts: GenkitPart[] = [
    {
      text: `Analiza estos keyframes de un video CORTO de básquet.

Tu ÚNICA tarea: confirmar si hay al menos UN intento de tiro visible.
No inventes timestamps. No inventes detalles técnicos.

Responde SOLO JSON con esta forma:
{
  "has_shot_attempt": true|false,
  "confidence": 0.0-1.0,
  "reasoning": "Una frase breve"
}`,
    },
  ];

  frames.forEach((frame, idx) => {
    parts.push({ text: `Frame ${idx}` });
    parts.push({
      media: {
        url: `data:image/jpeg;base64,${frame.imageBuffer.toString('base64')}`,
        contentType: 'image/jpeg',
      },
    });
  });

  const result = await ai.generate(parts);
  const text = (result as any)?.outputText ?? (result as any)?.text ?? '';
  let parsed: LlmShotVerification | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }
  if (!parsed || typeof parsed.has_shot_attempt !== 'boolean') return null;
  return parsed;
}
