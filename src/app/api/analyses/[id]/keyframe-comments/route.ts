import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// Configurar límite de body size para esta ruta
export const runtime = 'nodejs';
export const maxDuration = 30;

type KeyframeComment = {
  id?: string;
  analysisId: string;
  keyframeUrl: string;
  angle?: 'front' | 'back' | 'left' | 'right';
  index?: number;
  comment: string;
  coachId: string;
  coachName?: string;
  createdAt: string;
};

async function verifyCoachPermission(req: NextRequest, analysisId: string): Promise<{ ok: boolean; uid?: string; name?: string; reason?: string }> {
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

    if (assignedCoachId && assignedCoachId === uid) {
      // Obtener nombre del coach desde la colección coaches
      let coachName: string | undefined;
      try {
        const coachSnap = await adminDb.collection('coaches').doc(uid).get();
        if (coachSnap.exists) {
          const coachData = coachSnap.data() as any;
          coachName = coachData?.name || (decoded as any)?.name || undefined;
        } else {
          coachName = (decoded as any)?.name || undefined;
        }
      } catch (e) {
        console.error('Error obteniendo nombre del coach:', e);
        coachName = (decoded as any)?.name || undefined;
      }
      return { ok: true, uid, name: coachName };
    }
    return { ok: false, reason: 'Forbidden' };
  } catch (e) {
    console.error('verifyCoachPermission error', e);
    return { ok: false, reason: 'Auth error' };
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    const { id: analysisId } = await params;
    const { searchParams } = new URL(request.url);
    const keyframeUrl = searchParams.get('keyframeUrl');

    const ref = adminDb.collection('analyses').doc(analysisId).collection('keyframeComments');
    let q = ref.orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (keyframeUrl) {
      q = q.where('keyframeUrl', '==', keyframeUrl);
    }
    const snap = await q.get();
    const items: KeyframeComment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ comments: items });
  } catch (e) {
    console.error('❌ Error listando comentarios de keyframe:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function listComments(analysisId: string, keyframeUrl?: string) {
  if (!adminDb) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
  
  const ref = adminDb.collection('analyses').doc(analysisId).collection('keyframeComments');
  let q = ref.orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
  if (keyframeUrl) {
    q = q.where('keyframeUrl', '==', keyframeUrl);
  }
  const snap = await q.get();
  const items: KeyframeComment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ comments: items });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: analysisId } = await params;
    const body = await request.json();
    
    // Si action es 'list', manejar como petición de listado (sin autenticación requerida)
    if (body?.action === 'list') {
      const keyframeUrl = String(body?.keyframeUrl || '');
      return await listComments(analysisId, keyframeUrl || undefined);
    }
    
    // Si no, manejar como creación de comentario (requiere autenticación)
    if (!adminDb || !adminAuth) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });

    const perm = await verifyCoachPermission(request, analysisId);
    if (!perm.ok || !perm.uid) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const keyframeUrl = String(body?.keyframeUrl || '');
    const comment = String(body?.comment || '').trim();
    const angle = body?.angle as KeyframeComment['angle'] | undefined;
    const index = typeof body?.index === 'number' ? Number(body.index) : undefined;
    const coachName = String(body?.coachName || '').trim() || undefined;
    if (!keyframeUrl || !comment) return NextResponse.json({ error: 'keyframeUrl y comment son requeridos' }, { status: 400 });

    const payload: any = {
      analysisId,
      keyframeUrl,
      comment,
      coachId: perm.uid,
      createdAt: new Date().toISOString(),
    };
    
    // Solo agregar campos opcionales si tienen valor (Firestore no acepta undefined)
    if (angle) payload.angle = angle;
    if (typeof index === 'number') payload.index = index;
    // Usar el nombre del coach de verifyCoachPermission o el del body, priorizando el de verifyCoachPermission
    const finalCoachName = perm.name || coachName;
    if (finalCoachName) payload.coachName = finalCoachName;
    
    const ref = await adminDb.collection('analyses').doc(analysisId).collection('keyframeComments').add(payload);
    return NextResponse.json({ success: true, id: ref.id });
  } catch (e) {
    console.error('❌ Error en POST keyframe-comments:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

