import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return role === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
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


