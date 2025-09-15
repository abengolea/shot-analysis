import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function isAdmin(req: NextRequest): Promise<boolean> {
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

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    if (!(await isAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get('limit') || 50);
    const limit = Math.min(Math.max(limitParam, 1), 200);
    const status = searchParams.get('status') || undefined; // approved|pending|rejected
    const startAfterVal = searchParams.get('startAfter') || undefined;

    let q: FirebaseFirestore.Query = adminDb.collection('payments') as any;
    if (status) q = q.where('status', '==', status);
    q = q.orderBy('createdAt', 'desc').limit(limit);
    if (startAfterVal) q = q.startAfter(startAfterVal);

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const nextCursor = items.length ? items[items.length - 1]?.createdAt : undefined;
    return NextResponse.json({ items, nextCursor });
  } catch (e: any) {
    console.error('admin payments list error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}


