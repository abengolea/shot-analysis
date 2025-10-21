import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type UpdatePayload = {
  action: 'reorder' | 'delete';
  angle: 'front' | 'back' | 'left' | 'right';
  order?: number[]; // nuevo orden de índices basado en el array actual
  index?: number;   // índice a eliminar
};

async function verifyCoachPermission(req: NextRequest, analysisId: string): Promise<{ ok: boolean; uid?: string; reason?: string }> {
  try {
    if (!adminDb || !adminAuth) return { ok: false, reason: 'Admin SDK not ready' };
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
    const player = playerSnap.exists ? (playerSnap.data() as any) : null;
    const assignedCoachId = player?.coachId || null;

    if (assignedCoachId && assignedCoachId === uid) return { ok: true, uid };
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

    const body = await request.json() as UpdatePayload;
    const angle = body?.angle;
    if (!angle || !['front','back','left','right'].includes(angle)) {
      return NextResponse.json({ error: 'angle inválido' }, { status: 400 });
    }

    const ref = adminDb.collection('analyses').doc(analysisId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'analysis no encontrado' }, { status: 404 });
    const data = snap.data() as any;
    const keyframes = (data?.keyframes || { front: [], back: [], left: [], right: [] }) as Record<string, string[]>;
    const arr = Array.isArray(keyframes[angle]) ? [...keyframes[angle]] : [];

    if (body.action === 'reorder') {
      const order = Array.isArray(body.order) ? body.order : null;
      if (!order || order.length !== arr.length) {
        return NextResponse.json({ error: 'order inválido' }, { status: 400 });
      }
      const newArr = order.map((i) => arr[i]).filter((v) => typeof v === 'string');
      keyframes[angle] = newArr;
    } else if (body.action === 'delete') {
      const idx = typeof body.index === 'number' ? body.index : -1;
      if (idx < 0 || idx >= arr.length) {
        return NextResponse.json({ error: 'index inválido' }, { status: 400 });
      }
      arr.splice(idx, 1);
      keyframes[angle] = arr;
    } else {
      return NextResponse.json({ error: 'action inválida' }, { status: 400 });
    }

    await ref.update({ keyframes, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, keyframes });
  } catch (e) {
    console.error('❌ Error actualizando keyframes:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

