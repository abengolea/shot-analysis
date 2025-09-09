'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FrameSchema = z.object({
  index: z.number().describe('Index of the frame in the sequence'),
  timestamp: z.number().describe('Timestamp in seconds of this frame'),
  // Accept data URLs from the client; URL is optional (server-side may already host them)
  dataUrl: z.string().describe('data:image/jpeg;base64,...'),
  url: z.string().optional().describe('Optional public URL to the frame'),
  description: z.string().optional().describe('Optional short description'),
});

const DetectStartFrameInputSchema = z.object({
  frames: z.array(FrameSchema).min(2).max(16).describe('Chronologically ordered frames with URLs'),
  shotType: z.string().optional().describe('Optional shot type for context'),
});
export type DetectStartFrameInput = z.infer<typeof DetectStartFrameInputSchema>;

const DetectStartFrameOutputSchema = z.object({
  startIndex: z.number().describe('Index of the selected start frame within input.frames'),
  startTimestamp: z.number().describe('Timestamp (seconds) for the selected start frame'),
  confidence: z.number().min(0).max(1).describe('Model confidence in the selection'),
  rationale: z.string().describe('Brief reason for the selection'),
});
export type DetectStartFrameOutput = z.infer<typeof DetectStartFrameOutputSchema>;

// Use multimodal generate with inline image data
export async function detectStartFrame(input: DetectStartFrameInput): Promise<DetectStartFrameOutput> {
  const { frames, shotType } = input;

  const systemText = `TAREA: Elegir el PRIMER frame de "toma de pelota" en un lanzamiento de básquet.
Definición: pelota controlada (ambas manos o mano de tiro + guía), altura baja (cintura/cadera/ombligo), codos bajos.
Reglas: earliest-first si hay dudas; si el siguiente está más alto, elegir el anterior. Evitar pecho/mentón. Responder SOLO JSON.`;

  const parts: any[] = [
    { text: systemText },
    { text: shotType ? `Tipo de lanzamiento (contexto): ${shotType}` : 'Sin tipo de lanzamiento específico' },
  ];

  frames.forEach((f) => {
    // Extract base64
    let base64 = '';
    if (f.dataUrl && typeof f.dataUrl === 'string') {
      const idx = f.dataUrl.indexOf(',');
      base64 = idx >= 0 ? f.dataUrl.slice(idx + 1) : f.dataUrl;
    }
    if (base64) {
      parts.push({ text: `Frame index=${f.index} ts=${f.timestamp.toFixed(3)}s` });
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
    }
  });

  parts.push({ text: 'Devuelve JSON estricto con la forma {"startIndex": number, "startTimestamp": number, "confidence": number, "rationale": string}.' });

  // Guardar si falta API key para evitar romper el flujo
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
  if (!hasKey) {
    console.warn('[detect-start-frame] Sin API key; usando heurística rápida');
    const first = frames[0];
    return {
      startIndex: first.index,
      startTimestamp: first.timestamp,
      confidence: 0.1,
      rationale: 'Fallback sin API key',
    };
  }

  const result = await ai.generate({ input: parts });
  const text = (result as any)?.outputText ?? (result as any)?.text ?? '';
  let parsed: DetectStartFrameOutput | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Intento simple de extraer JSON rodeado de texto
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }
  if (!parsed) {
    throw new Error('Respuesta de IA inválida para detección de inicio');
  }
  return parsed;
}

export const detectStartFrameFlow = ai.defineFlow(
  {
    name: 'detectStartFrameFlow',
    inputSchema: DetectStartFrameInputSchema,
    outputSchema: DetectStartFrameOutputSchema,
  },
  async (input) => detectStartFrame(input)
);


