import { NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await ai.generate([{ text: 'Responde solo con "OK".' }]);
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
