import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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

function computeWeightedScore(categories: any[], weights: Record<string, number>): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const cat of categories || []) {
    const w = typeof weights[cat.category] === 'number' ? Number(weights[cat.category]) : 1;
    if (!cat.items || cat.items.length === 0) continue;
    const avg = cat.items.reduce((s: number, it: any) => s + (Number(it.rating) || 0), 0) / cat.items.length;
    weightedSum += avg * w;
    totalWeight += w;
  }
  if (totalWeight <= 0) return 0;
  const avgRating = weightedSum / totalWeight; // escala 1..5
  const score0to100 = Math.max(0, Math.min(100, (avgRating / 5) * 100));
  return Number(score0to100.toFixed(2));
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const shotType = (searchParams.get('shotType') || '').toLowerCase();

    // Cargar pesos específicos por tipo
    const docId = shotType.includes('tres') ? 'scoringWeights_tres' : shotType.includes('media') || shotType.includes('jump') ? 'scoringWeights_media' : shotType.includes('libre') ? 'scoringWeights_libre' : 'scoringWeights_general';
    const weightsSnap = await adminDb.collection('config').doc(docId).get();
    const weights = (weightsSnap.exists ? (weightsSnap.data() as any)?.weights : {}) || {};

    const batchSize = 200;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let total = 0;

    while (true) {
      let query = adminDb.collection('analyses').orderBy('createdAt').limit(batchSize);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snap = await query.get();
      if (snap.empty) break;
      const batch = adminDb.batch();
      snap.docs.forEach((doc) => {
        const data = doc.data() as any;
        // Filtrar por shotType si corresponde
        if (shotType) {
          const st = (data?.shotType || '').toLowerCase();
          const matches = (shotType.includes('tres') && st.includes('tres')) || (shotType.includes('media') && st.includes('media')) || (shotType.includes('jump') && st.includes('jump')) || (shotType.includes('libre') && st.includes('libre'));
          if (!matches) return;
        }
        const detailedChecklist = Array.isArray(data.detailedChecklist) ? data.detailedChecklist : [];
        const score = computeWeightedScore(detailedChecklist, weights);
        batch.update(doc.ref, { score, updatedAt: new Date().toISOString() });
      });
      await batch.commit();
      total += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < batchSize) break;
    }

    return NextResponse.json({ ok: true, updated: total });
  } catch (e) {
    console.error('Recalculate scores error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


