import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function isAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth!.verifyIdToken(token);
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
    const limitParam = Number(searchParams.get('limit') || 100);
    const limit = Math.min(Math.max(limitParam, 1), 200);

    const snap = await adminDb
      .collection('clubs')
      .limit(limit)
      .get();

    const serializeDate = (v: any): string | undefined => {
      try {
        if (!v) return undefined;
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return new Date(v).toISOString();
        if (typeof v.toDate === 'function') return v.toDate().toISOString();
        if (typeof v._seconds === 'number') {
          const ms = v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6);
          return new Date(ms).toISOString();
        }
        return String(v);
      } catch {
        return undefined;
      }
    };

    const items = snap.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data?.name || '-',
          email: data?.email || '-',
          city: data?.city || '-',
          province: data?.province || '-',
          status: data?.status || 'pending',
          createdAt: serializeDate(data?.createdAt),
          _sortKey: serializeDate(data?.createdAt) || serializeDate(data?.updatedAt) || d.id,
        };
      })
      .sort((a, b) => (b._sortKey || '').localeCompare(a._sortKey || ''));

    const clean = items.map(({ _sortKey, ...rest }) => rest);

    return NextResponse.json({ items: clean });
  } catch (e: any) {
    console.error('admin clubs list error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
