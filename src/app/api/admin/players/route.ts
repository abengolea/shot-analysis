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
    const startAfterVal = searchParams.get('startAfter') || undefined;

    let q: FirebaseFirestore.Query = adminDb.collection('players').orderBy('createdAt', 'desc').limit(limit) as any;
    if (startAfterVal) {
      try {
        // Prefer startAfter by document snapshot (robust when createdAt types vary)
        const docSnap = await adminDb.collection('players').doc(startAfterVal).get();
        if (docSnap.exists) {
          q = (q as FirebaseFirestore.Query).startAfter(docSnap);
        } else {
          // Fallback: try to use the raw value (createdAt) if provided
          q = (q as FirebaseFirestore.Query).startAfter(startAfterVal);
        }
      } catch {
        q = (q as FirebaseFirestore.Query).startAfter(startAfterVal);
      }
    }

    const snap = await q.get();
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

    const items = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        createdAt: serializeDate(data?.createdAt),
        updatedAt: serializeDate(data?.updatedAt),
      };
    });

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : undefined;
    return NextResponse.json({ items, nextCursor });
  } catch (e: any) {
    console.error('admin players list error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}


