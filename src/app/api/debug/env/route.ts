export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/api-admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (!auth.ok) return auth.response;
  if (!checkRateLimit(`debug:${auth.uid}`)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const g1 = process.env.GOOGLE_API_KEY || '';
  const g2 = process.env.GEMINI_API_KEY || '';
  const g3 = process.env.GOOGLE_GENAI_API_KEY || '';
  const mask = (v: string) => (v ? `${v.slice(0, 4)}...${v.slice(-4)} (len:${v.length})` : '');
  return NextResponse.json({
    hasEnvLocal: true,
    GOOGLE_API_KEY: g1 ? mask(g1) : null,
    GEMINI_API_KEY: g2 ? mask(g2) : null,
    GOOGLE_GENAI_API_KEY: g3 ? mask(g3) : null,
    cwd: process.cwd(),
  });
}


