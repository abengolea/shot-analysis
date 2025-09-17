import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { analyzeBasketballShot } from '@/ai/flows/analyze-basketball-shot';

async function requireAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });

    const analysisSnap = await adminDb.collection('analyses').doc(id).get();
    if (!analysisSnap.exists) return NextResponse.json({ ok: false, error: 'Análisis no encontrado' }, { status: 404 });
    const analysis = analysisSnap.data() as any;

    // Obtener datos del jugador
    const playerSnap = await adminDb.collection('players').doc(String(analysis.playerId || '')).get();
    const player = playerSnap.exists ? (playerSnap.data() as any) : {};
    const ageCategory = mapAgeGroupToCategory(player?.ageGroup);
    const playerLevel = player?.playerLevel || 'Principiante';

    // Video prioritario
    const videoUrl: string | undefined = analysis.videoBackUrl || analysis.videoUrl || analysis.videoFrontUrl || analysis.videoLeftUrl || analysis.videoRightUrl;
    if (!videoUrl) return NextResponse.json({ ok: false, error: 'Este análisis no tiene URL de video' }, { status: 400 });

    // Construir availableKeyframes placeholder si no hay metadatos
    const availableKeyframes = Array.from({ length: 16 }).map((_, i) => ({ index: i, timestamp: i * 0.5, description: `Frame ${i}` }));

    // Cargar feedback del admin (si existe) para guiar el prompt
    let promptConfig: any = undefined;
    try {
      const fbSnap = await adminDb.collection('analyses').doc(id).collection('admin_feedback').doc('latest').get();
      if (fbSnap.exists) {
        const fb = fbSnap.data() as any;
        const issuesText = Array.isArray(fb.issues)
          ? fb.issues.map((it: any) => `- ${String(it.id)}${it.rating ? ` (rating ${it.rating})` : ''}${it.severity ? ` [${it.severity}]` : ''}${it.commentForAI ? `: ${it.commentForAI}` : ''}`).join('\n')
          : '';
        const intro: string = [
          fb.commentForAI ? `Notas del admin: ${fb.commentForAI}` : '',
          issuesText ? `Ítems observados:\n${issuesText}` : '',
        ].filter(Boolean).join('\n\n');
        promptConfig = { intro };
      }
    } catch {}

    // Ejecutar IA
    const aiResult = await analyzeBasketballShot({
      videoUrl,
      shotType: String(analysis.shotType || 'tres'),
      ageCategory: ageCategory as any,
      playerLevel: String(playerLevel),
      availableKeyframes,
      promptConfig,
    });

    // Calcular score 0..100 a partir del promedio 1..5
    const allRatings: number[] = (aiResult.detailedChecklist || [])
      .flatMap((c: any) => c.items || [])
      .map((it: any) => (typeof it.rating === 'number' ? it.rating : null))
      .filter((v: any) => typeof v === 'number');
    const avgRating: number | null = allRatings.length > 0 ? (allRatings.reduce((a:number,b:number)=>a+b,0)/allRatings.length) : null;
    const score: number | null = avgRating != null ? Math.round(Math.max(0, Math.min(100, (avgRating / 5) * 100))) : null;

    await adminDb.collection('analyses').doc(id).set({
      analysisResult: aiResult,
      detailedChecklist: aiResult.detailedChecklist || [],
      score,
      scoreLabel: score != null ? (score>=90?'Excelente':score>=80?'Correcto':score>=60?'Mejorable':score>=40?'Incorrecto leve':'Incorrecto') : null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ ok: true, aiResult, score });
  } catch (e) {
    console.error('reanalyze error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


