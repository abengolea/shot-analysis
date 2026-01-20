import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { buildScoreMetadata, loadWeightsFromFirestore } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

type ChecklistItem = {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  rating?: number;
  na?: boolean;
  comment?: string;
  timestamp?: string;
  evidencia?: string;
  razon?: string;
  coachComment?: string;
};

type ChecklistCategory = {
  category?: string;
  items?: ChecklistItem[];
};

function normalizeDetailedChecklist(input: ChecklistCategory[]) {
  if (!Array.isArray(input)) return [];
  const toRating = (value: any): number | undefined => {
    if (value === 0) return 0;
    if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
    const rounded = Math.round(value);
    if (rounded <= 0) return 0;
    if (rounded >= 5) return 5;
    return rounded;
  };
  return input.map((cat) => ({
    category: String(cat?.category || 'SIN CATEGORIA'),
    items: Array.isArray(cat?.items)
      ? cat.items.map((it: ChecklistItem) => ({
          id: String(it?.id || ''),
          name: String(it?.name || ''),
          description: String(it?.description || ''),
          status: (it?.status as any) || 'Mejorable',
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
}

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ ok: false, error: 'Admin SDK no inicializado' }, { status: 500 });
    }
    const body = await req.json();
    const analysisId = String(body?.analysisId || '');
    if (!analysisId) {
      return NextResponse.json({ ok: false, error: 'analysisId requerido' }, { status: 400 });
    }

    const ref = adminDb.collection('analyses').doc(analysisId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Análisis no encontrado' }, { status: 404 });
    }

    const data = snap.data() as any;
    const analysisResult = data?.analysisResult || {};
    const detailedChecklist: ChecklistCategory[] = Array.isArray(analysisResult?.detailedChecklist)
      ? analysisResult.detailedChecklist
      : Array.isArray(data?.detailedChecklist)
        ? data.detailedChecklist
        : [];

    if (!detailedChecklist.length) {
      return NextResponse.json({ ok: false, error: 'detailedChecklist vacío' }, { status: 400 });
    }

    const shotType = data?.shotType || analysisResult?.shotType;
    const weights = await loadWeightsFromFirestore(shotType);
    const normalized = normalizeDetailedChecklist(detailedChecklist);
    const scoreMetadata = buildScoreMetadata(normalized as any, shotType, weights);

    await ref.update({
      'analysisResult.scoreMetadata': scoreMetadata,
      'analysisResult.score': scoreMetadata.weightedScore,
      score: scoreMetadata.weightedScore,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, scoreMetadata });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
