import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(_req: NextRequest) {
  try {
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


