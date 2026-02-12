import { NextRequest, NextResponse } from 'next/server';
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
    const env = process.env || {} as Record<string, string | undefined>;
    const keys = {
      GEMINI_API_KEY: Boolean(env.GEMINI_API_KEY),
      GOOGLE_API_KEY: Boolean(env.GOOGLE_API_KEY),
      GOOGLE_GENAI_API_KEY: Boolean(env.GOOGLE_GENAI_API_KEY),
      NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL || '',
      BACKEND_HINT: process.env.K_SERVICE || process.env.FUNCTION_TARGET || 'unknown',
    };
    return NextResponse.json({ ok: true, keys });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}


