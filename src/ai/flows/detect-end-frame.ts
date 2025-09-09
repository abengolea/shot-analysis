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

const DetectEndFrameInputSchema = z.object({
  frames: z.array(FrameSchema).min(3).max(16).describe('Chronologically ordered frames with URLs covering from pickup to flight'),
  shotType: z.string().optional().describe('Optional shot type for context'),
});
export type DetectEndFrameInput = z.infer<typeof DetectEndFrameInputSchema>;

const DetectEndFrameOutputSchema = z.object({
  endIndex: z.number().describe('Index of the selected end frame within input.frames'),
  endTimestamp: z.number().describe('Timestamp (seconds) for the selected end frame'),
  confidence: z.number().min(0).max(1).describe('Model confidence in the selection'),
  rationale: z.string().describe('Brief reason for the selection'),
});
export type DetectEndFrameOutput = z.infer<typeof DetectEndFrameOutputSchema>;

// Use multimodal generate with inline image data
export async function detectEndFrame(input: DetectEndFrameInput): Promise<DetectEndFrameOutput> {
  const { frames, shotType } = input;

  const systemText = `TAREA: Elegir el frame de FIN del segmento de análisis del tiro.
Definición de FIN: debe estar DESPUÉS de la liberación de la pelota, cuando la pelota esté EN EL AIRE y haya recorrido AL MENOS LA MITAD del trayecto hacia el aro (mid-flight). Si hay dudas, elige el frame más temprano que cumpla esa condición.
Evitar: elegir frames de antes de la liberación o demasiado cerca del aro (casi entrada).
Responder SOLO JSON.`;

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

  parts.push({ text: 'Devuelve JSON estricto con la forma {"endIndex": number, "endTimestamp": number, "confidence": number, "rationale": string}.' });

  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
  if (!hasKey) {
    console.warn('[detect-end-frame] Sin API key; usando heurística rápida');
    const last = frames[Math.max(0, frames.length - 1)];
    return {
      endIndex: last.index,
      endTimestamp: last.timestamp,
      confidence: 0.1,
      rationale: 'Fallback sin API key',
    };
  }

  const result = await ai.generate({ input: parts });
  const text = (result as any)?.outputText ?? (result as any)?.text ?? '';
  let parsed: DetectEndFrameOutput | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Intento simple de extraer JSON rodeado de texto
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  }
  if (!parsed) {
    throw new Error('Respuesta de IA inválida para detección de fin');
  }
  return parsed;
}

export const detectEndFrameFlow = ai.defineFlow(
  {
    name: 'detectEndFrameFlow',
    inputSchema: DetectEndFrameInputSchema,
    outputSchema: DetectEndFrameOutputSchema,
  },
  async (input) => detectEndFrame(input)
);


