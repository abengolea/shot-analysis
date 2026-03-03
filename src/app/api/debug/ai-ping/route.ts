import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { requireAdminRequest } from '@/lib/api-admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (!auth.ok) return auth.response;
  if (!checkRateLimit(`debug:${auth.uid}`)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
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
