import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

async function requireAdmin(req: NextRequest): Promise<boolean> {
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
    if (!await requireAdmin(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const categories = new Set<string>();
    const batchSize = 200;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
      let query = adminDb.collection('analyses').orderBy('createdAt').limit(batchSize);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snap = await query.get();
      if (snap.empty) break;
      snap.docs.forEach((doc) => {
        const data = doc.data() as any;
        const checklist = Array.isArray(data.detailedChecklist) ? data.detailedChecklist : [];
        for (const cat of checklist) {
          if (cat && typeof cat.category === 'string' && cat.category.trim()) {
            categories.add(cat.category.trim());
          }
        }
      });
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < batchSize) break;
    }

    return NextResponse.json({ ok: true, categories: Array.from(categories).sort() });
  } catch (e) {
    console.error('list-categories error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


