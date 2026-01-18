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

const FLUIDEZ_NAME = 'Fluidez / Armonía (transferencia energética)';
const SETPOINT_NAME = 'Set point (inicio del empuje de la pelota)';
const ELBOW_NAME = 'Alineación del codo';
const ELBOW_STABLE_ID = 'angulo_codo_fijo_ascenso';
const ASCENSO_HAND_ID = 'mano_no_dominante_ascenso';
const LIBERACION_HAND_ID = 'mano_no_dominante_liberacion';

function computeFinalScoreWithFluidez(
  categories: Array<{ category: string; items: Array<any> }>,
  weights: Record<string, number>,
  fluidezScore10?: number
): number {
  // Derivar fluidez 1..10 desde categorías si no viene explícito
  if (typeof fluidezScore10 !== 'number') {
    for (const cat of categories || []) {
      if ((cat.category || '').trim() === FLUIDEZ_NAME) {
        const special = (cat.items || []).find((it) => (it.name || '').trim() === FLUIDEZ_NAME && typeof it.rating10 === 'number');
        if (special && typeof special.rating10 === 'number') {
          fluidezScore10 = special.rating10;
          break;
        }
      }
    }
  }

  // Detectar Set Point, Alineación del codo y Ángulo de codo estable y calcular sus % (1..5 → 0..100)
  let setPointPercent = 0;
  let foundSetPoint = false;
  let elbowPercent = 0;
  let foundElbow = false;
  let elbowStablePercent = 0;
  let foundElbowStable = false;
  // Detectar mano no dominante (ascenso y liberación)
  let ascensoHandRating: number | null = null; // 1..5
  let liberacionHandRating: number | null = null; // 1..5
  const categoriesWithoutSetPoint = (categories || []).map((cat) => {
    const items = Array.isArray(cat.items) ? cat.items : [];
    const filtered = items.filter((it) => {
      const isSP = /set\s*point/i.test(it.id || '') || (it.name || '').trim().toLowerCase() === SETPOINT_NAME.toLowerCase();
      if (isSP && !foundSetPoint) {
        const sp = Math.max(1, Math.min(5, Number(it.rating) || 0));
        setPointPercent = (sp / 5) * 100;
        foundSetPoint = true;
        return false; // excluir del resto
      }
      const isElbow = /alineaci[oó]n.*codo|codo.*alineaci[oó]n/i.test(it.name || '') || /alineacion_?codo/i.test(it.id || '');
      if (isElbow && !foundElbow) {
        const el = Math.max(1, Math.min(5, Number(it.rating) || 0));
        elbowPercent = (el / 5) * 100;
        foundElbow = true;
        return false;
      }
      const isElbowStable = (it.id || '').trim() === ELBOW_STABLE_ID || /angulo.*codo.*(estable|fijo)|codo.*(estable|fijo)/i.test(it.name || '');
      if (isElbowStable && !foundElbowStable) {
        const el = Math.max(1, Math.min(5, Number(it.rating) || 0));
        elbowStablePercent = (el / 5) * 100;
        foundElbowStable = true;
        return false;
      }
      // Mano no dominante (ascenso/liberación): no excluir del resto, solo capturar rating
      if ((it.id || '').trim() === ASCENSO_HAND_ID || /mano\s*no\s*dominante.*ascenso/i.test(it.name || '')) {
        ascensoHandRating = Math.max(1, Math.min(5, Number(it.rating) || 0));
      }
      if ((it.id || '').trim() === LIBERACION_HAND_ID || /mano\s*no\s*dominante.*liberaci[oó]n/i.test(it.name || '')) {
        liberacionHandRating = Math.max(1, Math.min(5, Number(it.rating) || 0));
      }
      return true;
    });
    return { ...cat, items: filtered };
  });

  // Calcular promedio ponderado del resto de categorías (1..5 → %), excluyendo Set Point y Fluidez
  let totalWeightRest = 0;
  let weightedSumRest = 0;
  for (const cat of categoriesWithoutSetPoint) {
    if ((cat.category || '').trim() === FLUIDEZ_NAME) continue; // se maneja aparte
    const w = typeof weights[cat.category] === 'number' ? Number(weights[cat.category]) : 1;
    if (!cat.items || cat.items.length === 0) continue;
    const avg = cat.items.reduce((s: number, it: any) => s + (Number(it.rating) || 0), 0) / cat.items.length; // 1..5
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

  // Contribuciones especiales mano no dominante
  const ascensoHandPercent = ascensoHandRating !== null && ascensoHandRating >= 4 ? 2.07 : 0; // 2.18% -> 2.07% prorrateado
  let liberacionHandPercent = 0;
  let penaltyFactor = 1.0;
  if (liberacionHandRating !== null) {
    if (liberacionHandRating >= 4) {
      liberacionHandPercent = 3.1; // 3.26% -> 3.10% prorrateado
    } else if (liberacionHandRating === 2) {
      penaltyFactor = 0.8; // -20%
    } else if (liberacionHandRating === 1) {
      penaltyFactor = 0.7; // -30%
    }
  }

  // Nueva combinación (prorrateo global 0.95 para rubros existentes) + 5% ángulo de codo estable
  // 47.5% Fluidez + 7.86% Set Point + 6.88% Codo + 25.06% resto + 2.07% + 3.10% + 5%
  let finalScore = 0.475 * fluidezPercent
    + 0.0786 * setPointPercent
    + 0.0688 * elbowPercent
    + 0.2506 * restPercent
    + ascensoHandPercent
    + liberacionHandPercent
    + (foundElbowStable ? 0.05 * elbowStablePercent : 0);
  finalScore = finalScore * penaltyFactor;
  return Number(Math.max(0, Math.min(100, finalScore)).toFixed(2));
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
        const fluidezScore10 = typeof data.fluidezScore10 === 'number' ? data.fluidezScore10 : undefined;
        const score = computeFinalScoreWithFluidez(detailedChecklist, weights, fluidezScore10);
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

