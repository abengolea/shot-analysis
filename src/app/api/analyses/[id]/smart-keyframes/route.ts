import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type SmartKeyframe = {
  index: number;
  timestamp: number;
  description: string;
  importance: number;
  phase: 'preparation' | 'loading' | 'release' | 'follow-through' | 'landing';
  imageBuffer: string;
};

type SmartKeyframeResponse = {
  front: SmartKeyframe[];
  back: SmartKeyframe[];
  left: SmartKeyframe[];
  right: SmartKeyframe[];
};

async function verifyAnalysisAccess(req: NextRequest, analysisId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (!adminDb || !adminAuth) return { ok: false, reason: 'Admin SDK not ready' };
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return { ok: false, reason: 'No token' };
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const coachData = coachSnap.exists ? (coachSnap.data() as any) : null;
    const playerData = playerSnap.exists ? (playerSnap.data() as any) : null;
    const role = coachData?.role || playerData?.role;
    if (!coachSnap.exists && !playerSnap.exists) {
      return { ok: false, reason: 'Forbidden' };
    }

    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) return { ok: false, reason: 'Analysis not found' };
    const analysis = analysisSnap.data() as any;
    const analysisPlayerId = analysis?.playerId;
    const coachAccess = analysis?.coachAccess || {};
    const coachAccessForUser = coachAccess?.[uid];

    const isAdmin = role === 'admin';
    const isOwnerPlayer = playerSnap.exists && analysisPlayerId && String(analysisPlayerId) === String(uid);
    const hasPaidCoachAccess = coachSnap.exists && coachAccessForUser?.status === 'paid';
    if (!isAdmin && !isOwnerPlayer && !hasPaidCoachAccess) {
      return { ok: false, reason: 'Forbidden' };
    }

    return { ok: true };
  } catch (e) {
    console.error('verifyAnalysisAccess error', e);
    return { ok: false, reason: 'Auth error' };
  }
}

const emptyResponse = (): SmartKeyframeResponse => ({
  front: [],
  back: [],
  left: [],
  right: [],
});

const normalizeFrame = (data: any): SmartKeyframe | null => {
  if (!data) return null;
  const imageBuffer = typeof data.imageData === 'string'
    ? data.imageData
    : typeof data.imageBuffer === 'string'
      ? data.imageBuffer
      : '';
  if (!imageBuffer) return null;
  return {
    index: typeof data.index === 'number' ? data.index : 0,
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
    description: typeof data.description === 'string' ? data.description : '',
    importance: typeof data.importance === 'number' ? data.importance : 0,
    phase: (data.phase as SmartKeyframe['phase']) || 'preparation',
    imageBuffer,
  };
};

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }

    const analysisId = params.id;
    if (!analysisId) {
      return NextResponse.json({ error: 'ID de análisis requerido' }, { status: 400 });
    }

    const access = await verifyAnalysisAccess(request, analysisId);
    if (!access.ok) {
      return NextResponse.json({ error: access.reason || 'No autorizado' }, { status: 403 });
    }

    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }

    const analysis = analysisSnap.data() as any;
    const angles: Array<keyof SmartKeyframeResponse> = ['front', 'back', 'left', 'right'];

    const angleResults = await Promise.all(
      angles.map(async (angle) => {
        try {
          const framesSnap = await adminDb
            .collection('analyses')
            .doc(analysisId)
            .collection('keyframes')
            .doc(angle)
            .collection('frames')
            .orderBy('index', 'asc')
            .get();
          const frames = framesSnap.docs
            .map((doc) => normalizeFrame(doc.data()))
            .filter((f): f is SmartKeyframe => Boolean(f));
          return [angle, frames] as const;
        } catch (e) {
          console.warn(`⚠️ No se pudieron leer smart keyframes de ${angle}`, e);
          return [angle, [] as SmartKeyframe[]] as const;
        }
      })
    );

    const response: SmartKeyframeResponse = emptyResponse();
    angleResults.forEach(([angle, frames]) => {
      response[angle] = frames;
    });

    const anyFromSubcollections = angleResults.some(([, frames]) => frames.length > 0);
    if (!anyFromSubcollections) {
      const stored = analysis?.smartKeyframes;
      if (stored && typeof stored === 'object') {
        const hydrated: SmartKeyframeResponse = emptyResponse();
        angles.forEach((angle) => {
          const fromDoc = Array.isArray(stored?.[angle]) ? stored[angle] : [];
          hydrated[angle] = fromDoc
            .map((frame: any) => normalizeFrame(frame))
            .filter((f): f is SmartKeyframe => Boolean(f));
        });
        const anyStored = angles.some((angle) => hydrated[angle].length > 0);
        if (anyStored) {
          return NextResponse.json(hydrated);
        }
      }

      return NextResponse.json({ error: 'No hay smart keyframes' }, { status: 404 });
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error('❌ Error obteniendo smart keyframes:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
