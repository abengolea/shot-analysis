import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { rewriteCoachComment } from '@/ai/flows/rewrite-coach-comment';

async function requireCoachOrAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role !== 'coach' && role !== 'admin') return { ok: false };
    return { ok: true, uid };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCoachOrAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });

    const body = await req.json();
    const text = String(body?.text || '').trim();
    if (!text) return NextResponse.json({ ok: false, error: 'Texto requerido' }, { status: 400 });

    const result = await rewriteCoachComment({ text });
    if (!result?.improved) {
      return NextResponse.json({ ok: false, error: 'No se pudo mejorar el texto' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, improved: result.improved });
  } catch (e) {
    console.error('rewrite coach comment error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
