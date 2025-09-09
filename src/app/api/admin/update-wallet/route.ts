import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!adminDb) return NextResponse.json({ ok: false, error: 'Admin SDK no inicializado' }, { status: 500 });
    const form = await req.formData();
    const userId = String(form.get('userId') || '');
    const credits = Number(form.get('credits') || 0);
    const freeAnalysesUsed = Number(form.get('freeAnalysesUsed') || 0);
    const redirectTo = String(form.get('redirectTo') || '');
    if (!userId) return NextResponse.json({ ok: false, error: 'userId requerido' }, { status: 400 });
    const nowIso = new Date().toISOString();
    await adminDb.collection('wallets').doc(userId).set({ userId, credits, freeAnalysesUsed, updatedAt: nowIso }, { merge: true });
    if (redirectTo) {
      const url = new URL(redirectTo, req.url);
      return NextResponse.redirect(url, { status: 303 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('API update-wallet error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


