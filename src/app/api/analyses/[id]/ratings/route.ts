import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type RatingItem = {
  id: string;
  name: string;
  description: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  rating10?: number;
};

type RatingCategory = {
  category: string;
  items: RatingItem[];
};

const FLUIDEZ_NAME = 'Fluidez / Armonía (transferencia energética)';

function computeFinalScoreWithFluidez(
  categories: RatingCategory[],
  weights: Record<string, number>,
  fluidezScore10?: number
): number {
  // Derivar fluidez 1..10 desde categorías si no viene explícito
  if (typeof fluidezScore10 !== 'number') {
    for (const cat of categories) {
      if (cat.category.trim() === FLUIDEZ_NAME) {
        const special = cat.items?.find((it) => it.name?.trim() === FLUIDEZ_NAME && typeof it.rating10 === 'number');
        if (special && typeof special.rating10 === 'number') {
          fluidezScore10 = special.rating10;
          break;
        }
      }
    }
  }

  // Calcular promedio ponderado del resto de categorías (1..5 → %)
  let totalWeightRest = 0;
  let weightedSumRest = 0;
  for (const cat of categories) {
    if (cat.category.trim() === FLUIDEZ_NAME) continue; // se maneja aparte
    const w = typeof weights[cat.category] === 'number' ? Number(weights[cat.category]) : 1;
    if (!cat.items || cat.items.length === 0) continue;
    const avg = cat.items.reduce((s, it) => s + (Number(it.rating) || 0), 0) / cat.items.length; // 1..5
    weightedSumRest += avg * w;
    totalWeightRest += w;
  }
  let restPercent = 0;
  if (totalWeightRest > 0) {
    const avgRatingRest = weightedSumRest / totalWeightRest; // 1..5
    restPercent = Math.max(0, Math.min(100, (avgRatingRest / 5) * 100));
  }

  // Fluidez 1..10 → %
  const fluidezPercent = typeof fluidezScore10 === 'number' ? Math.max(0, Math.min(100, (fluidezScore10 / 10) * 100)) : 0;

  // Combinación 65% Fluidez + 35% resto
  const finalScore = 0.65 * fluidezPercent + 0.35 * restPercent;
  return Number(finalScore.toFixed(2));
}

async function getScoringWeights(shotType?: string): Promise<Record<string, number>> {
  const st = (shotType || '').toLowerCase();
  const docId = st.includes('tres') ? 'scoringWeights_tres' : st.includes('media') || st.includes('jump') ? 'scoringWeights_media' : st.includes('libre') ? 'scoringWeights_libre' : 'scoringWeights_general';
  const ref = adminDb.collection('config').doc(docId);
  const snap = await ref.get();
  let weights: Record<string, number> = {};
  if (snap.exists) {
    const data = snap.data() || {} as any;
    weights = (data.weights || {}) as Record<string, number>;
  }
  if (!weights || Object.keys(weights).length === 0) {
    const tresRef = adminDb.collection('config').doc('scoringWeights_tres');
    const tresSnap = await tresRef.get();
    if (tresSnap.exists) {
      const data = tresSnap.data() || {} as any;
      weights = (data.weights || {}) as Record<string, number>;
    }
  }
  return weights || {};
}

async function verifyCoachPermission(req: NextRequest, analysisId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false, reason: 'No token' };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) return { ok: false, reason: 'Analysis not found' };
    const analysis = analysisSnap.data() as any;
    const playerId = analysis?.playerId;
    if (!playerId) return { ok: false, reason: 'Player missing' };

    const playerSnap = await adminDb.collection('players').doc(playerId).get();
    const player = playerSnap.exists ? playerSnap.data() as any : null;
    const assignedCoachId = player?.coachId || null;

    if (assignedCoachId && assignedCoachId === uid) return { ok: true };
    return { ok: false, reason: 'Forbidden' };
  } catch (e) {
    console.error('verifyCoachPermission error', e);
    return { ok: false, reason: 'Auth error' };
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const analysisId = params.id;
    if (!adminDb || !adminAuth) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });

    const perm = await verifyCoachPermission(request, analysisId);
    if (!perm.ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = await request.json();
    const categories: RatingCategory[] = Array.isArray(body?.detailedChecklist) ? body.detailedChecklist : [];
    const fluidezScore10: number | undefined = typeof body?.fluidezScore10 === 'number' ? Math.max(1, Math.min(10, Math.round(body.fluidezScore10))) : undefined;
    if (!categories.length) return NextResponse.json({ error: 'detailedChecklist requerido' }, { status: 400 });

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    const shotType = analysisSnap.exists ? (analysisSnap.data() as any)?.shotType : undefined;
    const weights = await getScoringWeights(shotType);
    const score = computeFinalScoreWithFluidez(categories, weights, fluidezScore10);

    const ref = adminDb.collection('analyses').doc(analysisId);
    const updateData: any = { detailedChecklist: categories, score, updatedAt: new Date().toISOString() };
    if (typeof fluidezScore10 === 'number') updateData.fluidezScore10 = fluidezScore10;
    await ref.update(updateData);

    return NextResponse.json({ success: true, score, fluidezScore10 });
  } catch (e) {
    console.error('❌ Error guardando ratings:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


