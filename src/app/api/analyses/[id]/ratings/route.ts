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
const SETPOINT_NAME = 'Set point (inicio del empuje de la pelota)';
const ELBOW_NAME = 'Alineación del codo';
const ASCENSO_HAND_ID = 'mano_no_dominante_ascenso';
const LIBERACION_HAND_ID = 'mano_no_dominante_liberacion';

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

  // Detectar Set Point y Alineación del codo y calcular sus % (1..5 → 0..100)
  let setPointPercent = 0;
  let foundSetPoint = false;
  let elbowPercent = 0;
  let foundElbow = false;
  // Detectar mano no dominante (ascenso y liberación)
  let ascensoHandRating: number | null = null; // 1..5
  let liberacionHandRating: number | null = null; // 1..5
  const categoriesWithoutSetPoint: RatingCategory[] = categories.map((cat) => {
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
  
  // Contribuciones especiales mano no dominante
  // Ascenso (2%) binario: rating >= 4 => 2%, si no => 0%
  const ascensoHandPercent = ascensoHandRating !== null && ascensoHandRating >= 4 ? 2 : 0;
  // Liberación (3%) y penalización global
  // Estados: >=4 sin empuje (3% y sin penalización), 2 empuje leve (0% + -20%), 1 empuje fuerte (0% + -30%), 3 mejorable (0%, sin penalización)
  let liberacionHandPercent = 0;
  let penaltyFactor = 1.0; // multiplicador final
  if (liberacionHandRating !== null) {
    if (liberacionHandRating >= 4) {
      liberacionHandPercent = 3;
    } else if (liberacionHandRating === 2) {
      liberacionHandPercent = 0;
      penaltyFactor = 0.8; // -20%
    } else if (liberacionHandRating === 1) {
      liberacionHandPercent = 0;
      penaltyFactor = 0.7; // -30%
    } else {
      // rating === 3: mejorable, sin penalización y sin otorgar el 3%
      liberacionHandPercent = 0;
    }
  }

  // Nueva combinación (rebalanceo global 0.95 para rubros existentes) + 2% ascenso + 3% liberación
  // 57% Fluidez + 7.6% Set Point + 6.65% Codo + 23.75% resto + 2% + 3%
  let finalScore = 0.57 * fluidezPercent + 0.076 * setPointPercent + 0.0665 * elbowPercent + 0.2375 * restPercent + ascensoHandPercent + liberacionHandPercent;
  finalScore = finalScore * penaltyFactor;
  return Number(Math.max(0, Math.min(100, finalScore)).toFixed(2));
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

    // Recalcular agregados públicos del jugador para rankings
    const analysisAfter = await ref.get();
    const analysisData = analysisAfter.exists ? (analysisAfter.data() as any) : null;
    const playerId: string | undefined = analysisData?.playerId;
    if (playerId) {
      // Obtener todas las puntuaciones del jugador
      const analysesSnap = await adminDb
        .collection('analyses')
        .where('playerId', '==', playerId)
        .get();

      let count = 0;
      let sum = 0;
      let bestOverall = -1;
      let bestOverallDate: string | undefined = undefined;
      const bestByShot: Record<string, { score: number; date?: string }> = {
        libre: { score: -1 },
        media: { score: -1 },
        tres: { score: -1 },
      };

      for (const d of analysesSnap.docs) {
        const a = d.data() as any;
        const s = typeof a.score === 'number' ? Number(a.score) : NaN;
        if (Number.isNaN(s)) continue;
        count++;
        sum += s;
        const createdAt: string | undefined = typeof a.createdAt === 'string' ? a.createdAt : undefined;
        if (s > bestOverall) {
          bestOverall = s;
          bestOverallDate = createdAt;
        }
        const st = String(a.shotType || '').toLowerCase();
        const key = st.includes('libre') ? 'libre' : (st.includes('media') || st.includes('jump')) ? 'media' : st.includes('tres') ? 'tres' : undefined;
        if (key) {
          if (s > (bestByShot[key].score ?? -1)) {
            bestByShot[key] = { score: s, date: createdAt };
          }
        }
      }

      const avg = count > 0 ? Number((sum / count).toFixed(2)) : undefined;

      // Obtener jugador para calcular categoría por edad
      const playerRef = adminDb.collection('players').doc(playerId);
      const playerSnap = await playerRef.get();
      const playerData = playerSnap.exists ? (playerSnap.data() as any) : {};
      let publicCategory: 'U11' | 'U13' | 'U15' | 'U17' | 'U21' | 'Mayores' | undefined = undefined;
      try {
        const dobVal = playerData?.dob;
        let dob: Date | undefined = undefined;
        if (dobVal && typeof dobVal.toDate === 'function') dob = dobVal.toDate();
        else if (typeof dobVal === 'string') {
          const d = new Date(dobVal);
          if (!Number.isNaN(d.getTime())) dob = d;
        } else if (dobVal instanceof Date) {
          dob = dobVal;
        }
        if (dob) {
          const now = new Date();
          let age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
          if (age <= 11) publicCategory = 'U11';
          else if (age <= 13) publicCategory = 'U13';
          else if (age <= 15) publicCategory = 'U15';
          else if (age <= 17) publicCategory = 'U17';
          else if (age <= 21) publicCategory = 'U21';
          else publicCategory = 'Mayores';
        }
      } catch {}

      const updatePlayerData: any = {
        publicUpdatedAt: new Date().toISOString(),
      };
      if (typeof bestOverall === 'number' && bestOverall >= 0) updatePlayerData.publicHighestScore = bestOverall;
      if (typeof avg === 'number') updatePlayerData.publicGeneralAverageScore = avg;
      updatePlayerData.publicBestByShot = {
        libre: bestByShot.libre.score >= 0 ? bestByShot.libre.score : undefined,
        media: bestByShot.media.score >= 0 ? bestByShot.media.score : undefined,
        tres: bestByShot.tres.score >= 0 ? bestByShot.tres.score : undefined,
      };
      updatePlayerData.publicBestDates = {
        overall: bestOverallDate,
        libre: bestByShot.libre.date,
        media: bestByShot.media.date,
        tres: bestByShot.tres.date,
      };
      if (publicCategory) updatePlayerData.publicCategory = publicCategory;

      await playerRef.set(updatePlayerData, { merge: true });
    }

    return NextResponse.json({ success: true, score, fluidezScore10 });
  } catch (e) {
    console.error('❌ Error guardando ratings:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


