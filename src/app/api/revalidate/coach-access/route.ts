import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const body = await req.json();
    const analysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : '';
    const coachId = typeof body?.coachId === 'string' ? body.coachId.trim() : '';

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId requerido' }, { status: 400 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }

    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }
    const analysis = analysisSnap.data() as any;
    if (String(analysis?.playerId) !== String(decoded.uid)) {
      return NextResponse.json({ error: 'No autorizado para este análisis' }, { status: 403 });
    }

    const playerId = analysis?.playerId;
    const resolvedCoachId = coachId || analysis?.coachId || null;

    revalidatePath('/coach/dashboard');
    if (playerId) {
      revalidatePath(`/coach/players/${playerId}`);
    }
    revalidatePath(`/analysis/${analysisId}`);

    return NextResponse.json({
      ok: true,
      revalidated: {
        coachDashboard: true,
        coachPlayer: Boolean(playerId),
        analysis: true,
        coachId: resolvedCoachId || undefined,
      },
    });
  } catch (error: any) {
    console.error('Error revalidando panel de coach:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
