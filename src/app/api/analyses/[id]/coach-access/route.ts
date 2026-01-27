import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { hasPaidCoachAccessToPlayer } from '@/lib/coach-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { id: analysisId } = await params;
    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }

    const analysis = analysisSnap.data() as any;
    const playerId = analysis?.playerId;
    const coachAccess = analysis?.coachAccess || {};
    const access = coachAccess?.[uid];

    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const role = coachSnap.exists
      ? (coachSnap.data() as any)?.role
      : playerSnap.exists
        ? (playerSnap.data() as any)?.role
        : null;

    if (role === 'admin') {
      return NextResponse.json({ hasCoachAccess: true });
    }
    if (role !== 'coach') {
      return NextResponse.json({ hasCoachAccess: false });
    }

    const hasDirectAccess =
      access?.status === 'paid' || (analysis?.coachId && String(analysis.coachId) === String(uid));
    const hasPlayerAccess = playerId
      ? await hasPaidCoachAccessToPlayer({
          adminDb,
          coachId: uid,
          playerId: String(playerId),
        })
      : false;

    return NextResponse.json({ hasCoachAccess: Boolean(hasDirectAccess || hasPlayerAccess) });
  } catch (e) {
    console.error('Error verificando acceso de coach:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
