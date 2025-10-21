import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

async function getAuth(request: NextRequest): Promise<{ ok: true; uid: string; isAdmin: boolean } | { ok: false; status: number; message: string }> {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return { ok: false, status: 401, message: 'Authorization Bearer token requerido' };
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return { ok: true, uid, isAdmin: role === 'admin' };
  } catch (e: any) {
    return { ok: false, status: 401, message: 'Token inválido' };
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const who = await getAuth(request);
    if (!who.ok) return NextResponse.json({ error: who.message }, { status: who.status });

    const nowIso = new Date().toISOString();
    let updated = 0;

    if (who.isAdmin) {
      const qs = await adminDb.collection('tickets').where('unreadForAdmin', '>', 0).limit(1000).get();
      const batch = adminDb.batch();
      qs.forEach((docRef) => {
        batch.set(docRef.ref, { unreadForAdmin: 0, updatedAt: nowIso }, { merge: true });
        updated += 1;
      });
      if (updated > 0) await batch.commit();
    } else {
      const qs = await adminDb
        .collection('tickets')
        .where('userId', '==', who.uid)
        .where('unreadForUser', '>', 0)
        .limit(1000)
        .get();
      const batch = adminDb.batch();
      qs.forEach((docRef) => {
        batch.set(docRef.ref, { unreadForUser: 0, updatedAt: nowIso }, { merge: true });
        updated += 1;
      });
      if (updated > 0) await batch.commit();
    }

    return NextResponse.json({ ok: true, updated, remaining: 0 });
  } catch (e: any) {
    console.error('tickets mark-read POST error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

