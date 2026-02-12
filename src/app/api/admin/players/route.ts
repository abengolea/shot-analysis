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
    const searchQuery = (searchParams.get('q') || '').trim();
    const clubFilter = (searchParams.get('club') || '').trim();
    const limitParam = Number(searchParams.get('limit') || 50);
    const limit = Math.min(Math.max(limitParam, 1), 200);
    const startAfterVal = searchParams.get('startAfter') || undefined;

    if (clubFilter) {
      const clubSnap = await adminDb.collection('players').where('club', '==', clubFilter).limit(limit).get();
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
      const serializeDoc = (d: FirebaseFirestore.DocumentSnapshot) => {
        const data = d.data() as any;
        return { id: d.id, ...data, createdAt: serializeDate(data?.createdAt), updatedAt: serializeDate(data?.updatedAt) };
      };
      let items = clubSnap.docs.map((d) => serializeDoc(d));
      items.sort((a: any, b: any) => {
        const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bMs - aMs;
      });
      if (searchQuery) {
        const n = searchQuery.toLowerCase();
        items = items.filter((p: any) =>
          String(p.id).toLowerCase().includes(n) ||
          String(p.email || '').toLowerCase().includes(n) ||
          String(p.name || '').toLowerCase().includes(n)
        );
      }
      return NextResponse.json({ items, nextCursor: undefined });
    }

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

    const serializeDoc = (d: FirebaseFirestore.DocumentSnapshot) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        createdAt: serializeDate(data?.createdAt),
        updatedAt: serializeDate(data?.updatedAt),
      };
    };

    if (searchQuery) {
      const items: any[] = [];
      const seen = new Set<string>();
      const normalized = searchQuery.toLowerCase();

      const docSnap = await adminDb.collection('players').doc(searchQuery).get();
      if (docSnap.exists) {
        items.push(serializeDoc(docSnap));
        seen.add(docSnap.id);
      }

      if (searchQuery.includes('@')) {
        const emailQuery = searchQuery.toLowerCase();
        const emailSnap = await adminDb.collection('players').where('email', '==', emailQuery).limit(10).get();
        for (const d of emailSnap.docs) {
          if (!seen.has(d.id)) {
            items.push(serializeDoc(d));
            seen.add(d.id);
          }
        }
        if (emailQuery !== searchQuery) {
          const altEmailSnap = await adminDb.collection('players').where('email', '==', searchQuery).limit(10).get();
          for (const d of altEmailSnap.docs) {
            if (!seen.has(d.id)) {
              items.push(serializeDoc(d));
              seen.add(d.id);
            }
          }
        }

        if (!seen.size) {
          try {
            const user = await adminAuth.getUserByEmail(searchQuery);
            if (user?.uid) {
              const byUidSnap = await adminDb.collection('players').doc(user.uid).get();
              if (byUidSnap.exists && !seen.has(byUidSnap.id)) {
                items.push(serializeDoc(byUidSnap));
                seen.add(byUidSnap.id);
              }
            }
          } catch {
            // noop
          }
        }
      }

      // Búsqueda amplia por substring (nombre/email/id) recorriendo la colección
      const matchesQuery = (doc: FirebaseFirestore.DocumentSnapshot): boolean => {
        const data = doc.data() as any;
        const haystack = [
          doc.id,
          data?.email,
          data?.name,
          data?.displayName,
        ]
          .filter(Boolean)
          .map((v: any) => String(v).toLowerCase());
        return haystack.some((v: string) => v.includes(normalized));
      };

      let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined = undefined;
      const batchSize = 500;
      while (true) {
        let scanQuery: FirebaseFirestore.Query = adminDb
          .collection('players')
          .orderBy('createdAt', 'desc')
          .limit(batchSize) as any;
        if (lastDoc) {
          scanQuery = (scanQuery as FirebaseFirestore.Query).startAfter(lastDoc);
        }
        const scanSnap = await scanQuery.get();
        if (scanSnap.empty) break;
        for (const d of scanSnap.docs) {
          if (!seen.has(d.id) && matchesQuery(d)) {
            items.push(serializeDoc(d));
            seen.add(d.id);
          }
        }
        lastDoc = scanSnap.docs[scanSnap.docs.length - 1];
        if (scanSnap.docs.length < batchSize) break;
      }

      return NextResponse.json({ items, nextCursor: undefined });
    }

    const items = snap.docs.map((d) => serializeDoc(d));

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : undefined;
    return NextResponse.json({ items, nextCursor });
  } catch (e: any) {
    console.error('admin players list error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}


