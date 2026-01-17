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
    if (startAfterVal) {
      try {
        const docSnap = await adminDb.collection('payments').doc(startAfterVal).get();
        if (docSnap.exists) {
          q = (q as FirebaseFirestore.Query).startAfter(docSnap);
        } else {
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

    const extractPaymentMethod = (data: any): string | undefined => {
      const raw = data?.raw;
      return (
        data?.paymentMethod ||
        raw?.payment_method_id ||
        raw?.payment_method?.id ||
        raw?.payment_method ||
        raw?.payment?.method ||
        raw?.payment?.method_id ||
        raw?.payment_method_type ||
        raw?.payment_method_type_id ||
        raw?.metadata?.paymentMethod ||
        undefined
      );
    };

    const extractMpIds = (data: any): { mpPaymentId?: string; mpPreferenceId?: string } => {
      const raw = data?.raw;
      const mpPaymentId =
        raw?.id ||
        raw?.payment?.id ||
        raw?.payment_id ||
        raw?.paymentId ||
        data?.providerPaymentId ||
        undefined;
      const mpPreferenceId =
        raw?.preference_id ||
        raw?.preferenceId ||
        raw?.metadata?.preferenceId ||
        data?.preferenceId ||
        undefined;
      return {
        mpPaymentId: mpPaymentId ? String(mpPaymentId) : undefined,
        mpPreferenceId: mpPreferenceId ? String(mpPreferenceId) : undefined,
      };
    };

    const userIds = Array.from(new Set(items.map((i: any) => i.userId).filter(Boolean)));
    const coachIds = Array.from(
      new Set(
        items
          .map((i: any) => i.coachId || i?.raw?.metadata?.coachId)
          .filter(Boolean)
      )
    );

    const fetchDocs = async (refs: FirebaseFirestore.DocumentReference[]) => {
      if (!refs.length) return [] as FirebaseFirestore.DocumentSnapshot[];
      return adminDb.getAll(...refs);
    };

    const playerRefs = userIds.map((id) => adminDb.collection('players').doc(id));
    const coachRefs = Array.from(new Set([...userIds, ...coachIds])).map((id) =>
      adminDb.collection('coaches').doc(id)
    );

    const [playerSnaps, coachSnaps] = await Promise.all([
      fetchDocs(playerRefs),
      fetchDocs(coachRefs),
    ]);

    const playerMap = new Map<string, any>();
    playerSnaps.forEach((snap) => {
      if (snap.exists) playerMap.set(snap.id, snap.data());
    });

    const coachMap = new Map<string, any>();
    coachSnaps.forEach((snap) => {
      if (snap.exists) coachMap.set(snap.id, snap.data());
    });

    const enriched = items.map((item: any) => {
      const userName =
        playerMap.get(item.userId)?.name ||
        coachMap.get(item.userId)?.name ||
        item?.raw?.metadata?.playerName ||
        item?.raw?.metadata?.userName;
      const resolvedCoachId = item.coachId || item?.raw?.metadata?.coachId;
      const coachName =
        (resolvedCoachId ? coachMap.get(resolvedCoachId)?.name : undefined) ||
        item?.raw?.metadata?.coachName;
      const mpIds = item.provider === 'mercadopago' ? extractMpIds(item) : {};
      return {
        ...item,
        userName: userName || undefined,
        coachId: resolvedCoachId || item.coachId,
        coachName: coachName || undefined,
        paymentMethod: extractPaymentMethod(item),
        ...mpIds,
      };
    });
    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : undefined;
    return NextResponse.json({ items: enriched, nextCursor });
  } catch (e: any) {
    console.error('admin payments list error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

