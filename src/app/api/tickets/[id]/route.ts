import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

async function getAuthUid(request: NextRequest): Promise<{ ok: true; uid: string } | { ok: false; status: number; message: string }> {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return { ok: false, status: 401, message: 'Authorization Bearer token requerido' };
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid };
  } catch (e: any) {
    return { ok: false, status: 401, message: 'Token inválido' };
  }
}

async function isAdminUid(uid: string): Promise<boolean> {
  try {
    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return role === 'admin';
  } catch { return false; }
}

// GET detalle del ticket
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const { id: ticketId } = await params;
    const doc = await adminDb.collection('tickets').doc(ticketId).get();
    if (!doc.exists) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ id: doc.id, ...(doc.data() as any) });
  } catch (e: any) {
    console.error('ticket detail GET error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

// PATCH actualizar status/priority/assignee (solo admin)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const who = await getAuthUid(request);
    if (!who.ok) return NextResponse.json({ error: who.message }, { status: who.status });
    const isAdmin = await isAdminUid(who.uid);
    if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 });

    const { id: ticketId } = await params;
    const body = await request.json();
    const updates: Record<string, any> = {};
    const allowed = ['status', 'priority', 'adminAssigneeId'] as const;
    for (const k of allowed) {
      if (k in body) updates[k] = body[k];
    }
    updates.updatedAt = new Date().toISOString();

    await adminDb.collection('tickets').doc(ticketId).set(updates, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('ticket PATCH error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

