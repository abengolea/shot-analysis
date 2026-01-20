import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { buildAnalysisPrompt, AnalyzeBasketballShotInput } from '@/ai/flows/analyze-basketball-shot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as AnalyzeBasketballShotInput;
    const prompt = await buildAnalysisPrompt(input);
    const result = await ai.generate([{ text: prompt }]);
    const text = (result as any)?.outputText ?? (result as any)?.text ?? '';
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    const stack = typeof e?.stack === 'string'
      ? e.stack.split('\n').slice(0, 6).join('\n')
      : undefined;
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), name: e?.name, stack },
      { status: 500 }
    );
  }
}
