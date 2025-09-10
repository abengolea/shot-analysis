import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { ITEM_WEIGHTS_TRES } from '@/lib/scoring';

type RatingItem = {
  id: string;
  name: string;
  description: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  rating10?: number;
  na?: boolean;
};

type RatingCategory = {
  category: string;
  items: RatingItem[];
};

const FLUIDEZ_NAME = 'Fluidez';
const SETPOINT_NAME = 'Set point (inicio del empuje de la pelota)';
const ASCENSO_HAND_ID = 'mano_no_dominante_ascenso';
const LIBERACION_HAND_ID = 'mano_no_dominante_liberacion';

// Pesos exactos por ítem del checklist de Tiro de Tres (default). Suman 103.
const DEFAULT_ITEM_WEIGHTS_TRES: Record<string, number> = {
  // Fluidez (50%)
  tiro_un_solo_tiempo: 25,
  sincronia_piernas: 25,
  // Preparación (17%)
  alineacion_pies: 2,
  alineacion_cuerpo: 2,
  muneca_cargada: 4,
  flexion_rodillas: 4,
  hombros_relajados: 3,
  enfoque_visual: 2,
  // Ascenso (17%)
  mano_no_dominante_ascenso: 3,
  codos_cerca_cuerpo: 2,
  trayectoria_hasta_set_point: 3,
  subida_recta_balon: 3,
  set_point: 2,
  tiempo_lanzamiento: 4,
  // Liberación (10%)
  mano_no_dominante_liberacion: 2,
  extension_completa_brazo: 4,
  giro_pelota: 2,
  angulo_salida: 2,
  // Seguimiento (9%)
  mantenimiento_equilibrio: 2,
  equilibrio_aterrizaje: 1,
  duracion_follow_through: 1,
  consistencia_repetitiva: 5,
};

function computeFinalScoreExactWeights(
  categories: RatingCategory[],
  firestoreWeights?: Record<string, number>
): number {
  // Preferir pesos de Firestore si tienen claves de ítems; si no, usar default de Tiro de Tres
  // Aplanar ítems
  const allItems: RatingItem[] = categories.flatMap((cat) => Array.isArray(cat.items) ? cat.items : []);
  const presentItemIds = new Set(allItems.map((it) => (it.id || '').trim().toLowerCase()).filter(Boolean));

  const candidateWeights = firestoreWeights && Object.keys(firestoreWeights).length > 0 ? firestoreWeights : ITEM_WEIGHTS_TRES;
  const candidateKeys = Object.keys(candidateWeights).map((k) => k.trim().toLowerCase());
  const hasAnyMatch = candidateKeys.some((k) => presentItemIds.has(k));
  const finalWeightsSource = hasAnyMatch ? candidateWeights : ITEM_WEIGHTS_TRES;

  const itemWeights: Record<string, number> = {};
  Object.keys(finalWeightsSource).forEach((k) => { itemWeights[k.trim().toLowerCase()] = Number(finalWeightsSource[k]); });

  // Recorrer el universo de ítems esperados (por claves de pesos)
  let numerator = 0;
  let denom = 0;

  const mapStatusToRating = (status?: string): number | null => {
    if (!status) return null;
    if (status === 'Incorrecto') return 1;
    if (status === 'Incorrecto leve') return 2;
    if (status === 'Mejorable') return 3;
    if (status === 'Correcto') return 4;
    if (status === 'Excelente') return 5;
    return null;
  };

  const findItemById = (key: string): RatingItem | undefined => {
    const lower = key.toLowerCase();
    return allItems.find((it) => (it.id || '').trim().toLowerCase() === lower);
  };

  for (const key of Object.keys(itemWeights)) {
    const w = itemWeights[key];
    const it = findItemById(key);
    if (!it) continue; // faltante => excluido (no penaliza)
    if ((it as any).na === true) continue; // N/A => excluido
    const ratingRaw = typeof it.rating === 'number' ? it.rating : mapStatusToRating((it as any).status as any);
    if (ratingRaw == null) continue;
    const rating = Math.max(1, Math.min(5, Number(ratingRaw)));
    const percent = (rating / 5) * 100;
    numerator += w * percent;
    denom += w;
  }

  if (denom <= 0) return 0;
  const finalScore = numerator / denom;
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
    const score = computeFinalScoreExactWeights(categories, weights);

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


