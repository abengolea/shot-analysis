import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function requireAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const snap = await adminDb.collection('analyses').doc(id).collection('admin_feedback').doc('latest').get();
    if (!snap.exists) return NextResponse.json({ feedback: null });
    return NextResponse.json({ feedback: { id: snap.id, ...snap.data() } });
  } catch (e) {
    console.error('GET admin-feedback error', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });

    const body = await req.json();
    const now = new Date().toISOString();
    const ref = adminDb.collection('analyses').doc(id).collection('admin_feedback').doc('latest');
    const prev = await ref.get();
    const data = {
      analysisId: id,
      playerId: String(body?.playerId || ''),
      taxonomyVersion: 'v1' as const,
      visibility: 'admin_only' as const,
      issues: Array.isArray(body?.issues) ? body.issues : [],
      corrections: body?.corrections || undefined,
      commentForAI: typeof body?.commentForAI === 'string' ? body.commentForAI : undefined,
      status: body?.status === 'listo' ? 'listo' : 'borrador',
      createdAt: prev.exists ? (prev.data() as any)?.createdAt || now : now,
      createdBy: (prev.exists ? (prev.data() as any)?.createdBy : auth.uid) || auth.uid,
      updatedAt: now,
    };
    await ref.set(data, { merge: true });
    // Denormalizar estado en el documento principal para facilitar filtros
    try {
      await adminDb.collection('analyses').doc(id).set({
        adminReviewStatus: data.status === 'listo' ? 'listo' : 'pendiente',
        lastAdminFeedbackAt: now,
      }, { merge: true });
    } catch (e) {
      console.warn('No se pudo actualizar adminReviewStatus en analysis:', e);
    }
    return NextResponse.json({ ok: true, feedback: { id: 'latest', ...data } });
  } catch (e) {
    console.error('POST admin-feedback error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


