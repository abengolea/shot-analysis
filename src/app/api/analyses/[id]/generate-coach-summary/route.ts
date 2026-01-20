import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateCoachSummary } from '@/ai/flows/generate-coach-summary';

async function requireCoachOrAdmin(req: NextRequest, analysisId: string): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role !== 'coach' && role !== 'admin') return { ok: false };

    if (role === 'coach') {
      const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
      if (!analysisSnap.exists) return { ok: false };
      const analysis = analysisSnap.data() as any;
      const playerId = analysis?.playerId;
      if (!playerId) return { ok: false };
      const player = await adminDb.collection('players').doc(playerId).get();
      const assignedCoachId = player.exists ? (player.data() as any)?.coachId : null;
      const coachAccess = (analysis?.coachAccess || {}) as Record<string, any>;
      const hasPaidCoachAccess = coachAccess?.[uid]?.status === 'paid';
      if (assignedCoachId !== uid && !hasPaidCoachAccess) return { ok: false };
    }

    return { ok: true, uid };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await requireCoachOrAdmin(req, id);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });

    const body = await req.json();
    const coachFeedback = body?.coachFeedback || {};
    const shotTypeFromBody = typeof body?.shotType === 'string' ? body.shotType : '';

    const analysisSnap = await adminDb.collection('analyses').doc(id).get();
    const analysis = analysisSnap.exists ? (analysisSnap.data() as any) : {};

    const analysisSummary = String(
      analysis?.analysisSummary ||
      analysis?.analysisResult?.analysisSummary ||
      ''
    );
    const detailedChecklist = analysis?.detailedChecklist || analysis?.analysisResult?.detailedChecklist || [];
    const shotType = String(shotTypeFromBody || analysis?.shotType || analysis?.scoreMetadata?.shotTypeKey || '');

    const result = await generateCoachSummary({
      analysisSummary,
      detailedChecklist: JSON.stringify(detailedChecklist),
      coachFeedback: JSON.stringify(coachFeedback),
      shotType,
    });

    if (!result?.summary) {
      return NextResponse.json({ ok: false, error: 'No se pudo generar el resumen' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, summary: result.summary });
  } catch (e) {
    console.error('generate-coach-summary error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
