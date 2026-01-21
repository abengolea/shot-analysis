import { adminDb } from '@/lib/firebase-admin';
import { analyzeBasketballShot, detectShots } from '@/ai/flows/analyze-basketball-shot';
import { buildEconomyEvidenceFromVideoUrl } from '@/lib/economy-evidence';
import { buildScoreMetadata, loadWeightsFromFirestore } from '@/lib/scoring';
import { generateAnalysisSummary } from '@/lib/ai-summary';
import type { ChecklistCategory, DetailedChecklistItem } from '@/lib/types';

type ReanalyzeOptions = {
  analysisId: string;
  promptConfig?: any;
  reason?: string;
};

type ReanalyzeResult = {
  ok: boolean;
  error?: string;
  analysisResult?: any;
  score?: number | null;
};

function mapAgeGroupToCategory(ageGroup: string | undefined): string {
  switch (ageGroup) {
    case 'U10': return 'Sub-10';
    case 'U13': return 'Sub-13';
    case 'U15': return 'Sub-15';
    case 'U18': return 'Sub-18';
    case 'Amateur': return 'Amateur adulto';
    case 'SemiPro': return 'Profesional';
    case 'Pro': return 'Profesional';
    default: return 'Amateur adulto';
  }
}

function buildFallbackKeyframes() {
  return Array.from({ length: 16 }).map((_, i) => ({
    index: i,
    timestamp: i * 0.5,
    description: `Frame ${i}`,
  }));
}

const normalizeDetailedChecklist = (input: any[]): ChecklistCategory[] => {
  if (!Array.isArray(input)) return [];
  const toRating = (value: any): DetailedChecklistItem['rating'] => {
    if (value === 0) return 0;
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
    const rounded = Math.round(value);
    if (rounded <= 0) return 0;
    if (rounded >= 5) return 5;
    return rounded as 1 | 2 | 3 | 4;
  };
  return input.map((cat) => ({
    category: String(cat?.category || 'SIN CATEGORIA'),
    items: Array.isArray(cat?.items)
      ? cat.items.map((it: any) => ({
          id: String(it?.id || ''),
          name: String(it?.name || ''),
          description: String(it?.description || ''),
          status: (it?.status as DetailedChecklistItem['status']) || 'Mejorable',
          rating: toRating(it?.rating),
          na: Boolean(it?.na),
          comment: String(it?.comment || ''),
          timestamp: typeof it?.timestamp === 'string' ? it.timestamp : undefined,
          evidencia: typeof it?.evidencia === 'string' ? it.evidencia : undefined,
          razon: typeof it?.razon === 'string' ? it.razon : undefined,
          coachComment: typeof it?.coachComment === 'string' ? it.coachComment : undefined,
        }))
      : [],
  }));
};

export async function reanalyzeAnalysis({
  analysisId,
  promptConfig,
  reason = 'manual',
}: ReanalyzeOptions): Promise<ReanalyzeResult> {
  try {
    if (!adminDb) return { ok: false, error: 'Admin SDK no inicializado' };
    if (!analysisId) return { ok: false, error: 'ID requerido' };

    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) return { ok: false, error: 'Análisis no encontrado' };
    const analysis = analysisSnap.data() as any;

    const playerSnap = await adminDb.collection('players').doc(String(analysis.playerId || '')).get();
    const player = playerSnap.exists ? (playerSnap.data() as any) : {};
    const ageCategory = mapAgeGroupToCategory(player?.ageGroup);
    const playerLevel = player?.playerLevel || 'Principiante';

    const videoUrl: string | undefined =
      analysis.videoBackUrl || analysis.videoUrl || analysis.videoFrontUrl || analysis.videoLeftUrl || analysis.videoRightUrl;
    if (!videoUrl) return { ok: false, error: 'Este análisis no tiene URL de video' };

    let availableKeyframes: Array<{ index: number; timestamp: number; description: string }> = [];
    try {
      const evidence = await buildEconomyEvidenceFromVideoUrl(videoUrl, { targetFrames: 8 });
      availableKeyframes = Array.isArray(evidence?.availableKeyframes) ? evidence.availableKeyframes : [];
    } catch {}
    if (!Array.isArray(availableKeyframes) || availableKeyframes.length === 0) {
      availableKeyframes = buildFallbackKeyframes();
    }

    let skipDomainCheck = false;
    let detectedShotsCount: number | undefined = undefined;
    try {
      const primaryDetection = await detectShots({
        videoUrl,
        shotType: String(analysis.shotType || 'tres'),
        ageCategory: ageCategory as any,
        playerLevel: String(playerLevel),
        availableKeyframes: [],
      });
      const count = typeof primaryDetection?.shots_count === 'number'
        ? primaryDetection.shots_count
        : Array.isArray(primaryDetection?.shots)
          ? primaryDetection.shots.length
          : 0;
      skipDomainCheck = count > 0;
      detectedShotsCount = count || undefined;
    } catch {}

    let shotFramesForPrompt: Array<{ idx: number; start_ms: number; release_ms: number; frames: string[] }> = [];
    let shotFramesSource: string | undefined = undefined;
    try {
      if (analysis.shotFramesUrl) {
        const resp = await fetch(String(analysis.shotFramesUrl));
        if (resp.ok) {
          const data = (await resp.json()) as { source?: string; shots?: Array<any> };
          if (Array.isArray(data?.shots)) {
            shotFramesSource = typeof data?.source === 'string' ? data.source : undefined;
            shotFramesForPrompt = data.shots
              .slice(0, 2)
              .map((shot) => {
                const rawFrames = Array.isArray(shot?.frames) ? shot.frames : [];
                const frames = rawFrames
                  .map((frame: any) => {
                    if (typeof frame === 'string') return frame;
                    if (frame && typeof frame.dataUrl === 'string') return frame.dataUrl;
                    return '';
                  })
                  .filter((frame: string) => frame.startsWith('data:image'))
                  .slice(0, 3);
                return {
                  idx: Number(shot?.idx || 0),
                  start_ms: Number(shot?.start_ms || 0),
                  release_ms: Number(shot?.release_ms || 0),
                  frames,
                };
              })
              .filter((shot) => shot.frames.length > 0);
          }
        }
      }
    } catch {}

    const aiResult = await analyzeBasketballShot({
      videoUrl,
      shotType: String(analysis.shotType || 'tres'),
      ageCategory: ageCategory as any,
      playerLevel: String(playerLevel),
      availableKeyframes,
      promptConfig,
      ...(skipDomainCheck ? { skipDomainCheck: true } : {}),
      ...(typeof detectedShotsCount === 'number' ? { detectedShotsCount } : {}),
      ...(shotFramesForPrompt.length > 0
        ? { shotFrames: { sourceAngle: shotFramesSource, shots: shotFramesForPrompt } }
        : {}),
    });

    const detectionByLabel: Array<{ label: string; url: string; result: any }> = [];
    try {
      const sources = [
        { label: 'back', url: analysis.videoBackUrl },
        { label: 'front', url: analysis.videoFrontUrl },
        { label: 'left', url: analysis.videoLeftUrl },
        { label: 'right', url: analysis.videoRightUrl },
      ].filter((s): s is { label: string; url: string } => Boolean(s.url));
      for (const source of sources) {
        const result = await detectShots({
          videoUrl: source.url,
          shotType: String(analysis.shotType || 'tres'),
          ageCategory: ageCategory as any,
          playerLevel: String(playerLevel),
          availableKeyframes: [],
        });
        detectionByLabel.push({ label: source.label, url: source.url, result });
      }
    } catch (e) {
      console.warn('reanalyzeAnalysis detectShots falló', e);
    }

    const detailedChecklist = Array.isArray(aiResult?.detailedChecklist) ? aiResult.detailedChecklist : [];
    let scoreMetadata = undefined;
    if (detailedChecklist.length > 0) {
      const weights = await loadWeightsFromFirestore(String(analysis.shotType || 'tres'));
      const normalizedChecklist = normalizeDetailedChecklist(detailedChecklist);
      scoreMetadata = buildScoreMetadata(normalizedChecklist, String(analysis.shotType || 'tres'), weights);
    }

    let analysisResultWithScore = scoreMetadata
      ? { ...aiResult, scoreMetadata }
      : aiResult;

    if (detectionByLabel.length > 0 && analysisResultWithScore?.verificacion_inicial) {
      let totalShots = 0;
      const tirosIndividuales: Array<{ numero: number; timestamp: string; descripcion: string }> = [];
      const shotsByLabel: Array<{ label: string; count: number }> = [];
      let seq = 1;
      for (const det of detectionByLabel) {
        const shots = Array.isArray(det?.result?.shots) ? det.result.shots : [];
        const shotsCount = typeof det?.result?.shots_count === 'number'
          ? det.result.shots_count
          : shots.length;
        totalShots += shotsCount;
        shotsByLabel.push({ label: det.label, count: shotsCount });
        shots.forEach((shot: any, idx: number) => {
          const startMs = Number(shot?.start_ms || 0);
          const releaseMs = Number(shot?.release_ms || 0);
          const startLabel = `${(startMs / 1000).toFixed(2)}s`;
          const releaseLabel = `${(releaseMs / 1000).toFixed(2)}s`;
          const notes = Array.isArray(shot?.notes) ? shot.notes.filter(Boolean) : [];
          tirosIndividuales.push({
            numero: seq++,
            timestamp: `${det.label} ${startLabel}-${releaseLabel}`,
            descripcion: `${det.label}: ${notes.length > 0 ? notes.join('; ') : 'Tiro detectado'}`,
          });
        });
      }

      const verif = analysisResultWithScore.verificacion_inicial;
      const breakdown = shotsByLabel.map((item) => `${item.label}: ${item.count}`).join(', ');
      const contexto = [
        verif?.duracion_video ? `Duración ${verif.duracion_video}` : null,
        verif?.mano_tiro ? `mano ${verif.mano_tiro}` : null,
        verif?.angulo_camara ? `ángulo ${verif.angulo_camara}` : null,
        Array.isArray(verif?.elementos_entorno) && verif.elementos_entorno.length > 0
          ? `entorno: ${verif.elementos_entorno.join(', ')}`
          : null,
      ].filter(Boolean).join(', ');
      const resumenFallback = [
        `Se analizaron ${totalShots} tiros detectados en ${shotsByLabel.length} videos (${breakdown}).`,
        contexto ? `Contexto observado: ${contexto}.` : null,
        analysisResultWithScore?.analysisSummary ? `Observaciones de la IA: ${analysisResultWithScore.analysisSummary}` : null,
      ].filter(Boolean).join(' ');

      const resumenAi = await generateAnalysisSummary({
        baseSummary: analysisResultWithScore?.analysisSummary,
        verificacion_inicial: analysisResultWithScore?.verificacion_inicial,
        strengths: analysisResultWithScore?.strengths,
        weaknesses: analysisResultWithScore?.weaknesses,
        recommendations: analysisResultWithScore?.recommendations,
        resumen_evaluacion: analysisResultWithScore?.resumen_evaluacion,
        shots: { total: totalShots, byLabel: shotsByLabel },
      });
      const resumen = resumenAi || resumenFallback;

      analysisResultWithScore = {
        ...analysisResultWithScore,
        verificacion_inicial: {
          ...analysisResultWithScore.verificacion_inicial,
          tiros_detectados: totalShots,
          deteccion_ia: {
            angulo_detectado: detectionByLabel.length > 1 ? 'multi' : (analysisResultWithScore.verificacion_inicial?.angulo_camara || 'desconocido'),
            estrategia_usada: detectionByLabel.length > 1 ? 'detectShots.multi' : 'detectShots',
            tiros_individuales: tirosIndividuales,
            total_tiros: totalShots,
          },
        },
        analysisSummary: resumen,
      };
    }

    const allRatings: number[] = (aiResult.detailedChecklist || [])
      .flatMap((c: any) => c.items || [])
      .map((it: any) => (typeof it.rating === 'number' ? it.rating : null))
      .filter((v: any) => typeof v === 'number');
    const avgRating: number | null = allRatings.length > 0 ? (allRatings.reduce((a:number,b:number)=>a+b,0)/allRatings.length) : null;
    const score: number | null = avgRating != null ? Math.round(Math.max(0, Math.min(100, (avgRating / 5) * 100))) : null;

    await adminDb.collection('analyses').doc(analysisId).set({
      analysisResult: analysisResultWithScore,
      detailedChecklist: aiResult.detailedChecklist || [],
      score,
      scoreLabel: score != null ? (score>=90?'Excelente':score>=80?'Correcto':score>=60?'Mejorable':score>=40?'Incorrecto leve':'Incorrecto') : null,
      analysisReanalyzedAt: new Date().toISOString(),
      analysisReanalyzedReason: reason,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return { ok: true, analysisResult: analysisResultWithScore, score };
  } catch (e: any) {
    console.error('reanalyzeAnalysis error', e);
    return { ok: false, error: e?.message || 'Error interno' };
  }
}
