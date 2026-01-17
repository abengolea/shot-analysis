import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function isAdmin(req: NextRequest): Promise<{ uid: string } | null> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists
      ? (coachSnap.data() as any)?.role
      : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return role === 'admin' ? { uid } : null;
  } catch {
    return null;
  }
}

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

async function recalcCoachRating(coachId: string) {
  const reviewsSnap = await adminDb.collection('coach_reviews').where('coachId', '==', coachId).get();
  const visible = reviewsSnap.docs
    .map((doc) => doc.data() as any)
    .filter((r) => r && r.hidden !== true && typeof r.rating === 'number');
  const count = visible.length;
  const avg = count
    ? Number((visible.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count).toFixed(2))
    : 0;
  await adminDb.collection('coaches').doc(coachId).set(
    {
      rating: avg,
      reviews: count,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const admin = await isAdmin(req);
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get('limit') || 50);
    const limit = Math.min(Math.max(limitParam, 1), 200);
    const startAfterVal = searchParams.get('startAfter') || undefined;
    const onlyHidden = searchParams.get('hidden') === '1';

    let q: FirebaseFirestore.Query = adminDb
      .collection('coach_reviews')
      .orderBy('createdAt', 'desc')
      .limit(limit) as any;
    if (onlyHidden) {
      q = (q as FirebaseFirestore.Query).where('hidden', '==', true);
    }
    if (startAfterVal) {
      try {
        const docSnap = await adminDb.collection('coach_reviews').doc(startAfterVal).get();
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
    const items = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        createdAt: serializeDate(data?.createdAt),
        updatedAt: serializeDate(data?.updatedAt),
        editedAt: serializeDate(data?.editedAt),
        hiddenAt: serializeDate(data?.hiddenAt),
      };
    });

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : undefined;
    return NextResponse.json({ items, nextCursor });
  } catch (e: any) {
    console.error('admin coach reviews list error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const admin = await isAdmin(req);
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = await req.json();
    const reviewId = typeof body?.id === 'string' ? body.id.trim() : '';
    const ratingRaw = body?.rating;
    const commentRaw = typeof body?.comment === 'string' ? body.comment.trim() : undefined;
    const hiddenRaw = body?.hidden;
    if (!reviewId) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const updates: Record<string, any> = {};
    if (ratingRaw !== undefined) {
      const rating = Number(ratingRaw);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'rating debe ser un entero entre 1 y 5.' }, { status: 400 });
      }
      updates.rating = rating;
    }
    if (commentRaw !== undefined) {
      if (commentRaw.length > 2000) {
        return NextResponse.json({ error: 'El comentario es demasiado largo.' }, { status: 400 });
      }
      updates.comment = commentRaw;
    }
    if (hiddenRaw !== undefined) {
      updates.hidden = !!hiddenRaw;
      updates.hiddenAt = !!hiddenRaw ? new Date().toISOString() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
    }

    updates.updatedAt = new Date().toISOString();
    updates.editedAt = new Date().toISOString();
    updates.editedBy = admin.uid;

    const reviewRef = adminDb.collection('coach_reviews').doc(reviewId);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
      return NextResponse.json({ error: 'Reseña no encontrada.' }, { status: 404 });
    }
    const reviewData = reviewSnap.data() as any;
    await reviewRef.set(updates, { merge: true });

    if (reviewData?.coachId) {
      await recalcCoachRating(String(reviewData.coachId));
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('admin coach reviews update error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
