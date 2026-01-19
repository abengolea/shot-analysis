import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';

type KeyframeAnnotation = {
  id?: string;
  analysisId: string;
  keyframeUrl: string;
  angle?: 'front' | 'back' | 'left' | 'right';
  index?: number;
  overlayUrl: string; // URL en storage (png con transparencia)
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
    const name = (decoded as any)?.name || undefined;

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) return { ok: false, reason: 'Analysis not found' };
    const analysis = analysisSnap.data() as any;
    const playerId = analysis?.playerId;
    if (!playerId) return { ok: false, reason: 'Player missing' };

    const playerSnap = await adminDb.collection('players').doc(playerId).get();
    const player = playerSnap.exists ? (playerSnap.data() as any) : null;
    const assignedCoachId = player?.coachId || null;

    if (assignedCoachId && assignedCoachId === uid) return { ok: true, uid, name };
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

    const ref = adminDb.collection('analyses').doc(analysisId).collection('keyframeAnnotations');
    let q = ref.orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (keyframeUrl) q = q.where('keyframeUrl', '==', keyframeUrl);
    const snap = await q.get();
    const items: KeyframeAnnotation[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ annotations: items });
  } catch (e) {
    console.error('❌ Error listando anotaciones:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: analysisId } = await params;
    if (!adminDb || !adminAuth || !adminStorage) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });

    const perm = await verifyCoachPermission(request, analysisId);
    if (!perm.ok || !perm.uid) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = await request.json();
    const keyframeUrl = String(body?.keyframeUrl || '');
    const angle = body?.angle as KeyframeAnnotation['angle'] | undefined;
    const index = typeof body?.index === 'number' ? Number(body.index) : undefined;
    const overlayDataUrl = String(body?.overlayDataUrl || ''); // data:image/png;base64,....
    if (!keyframeUrl || !overlayDataUrl.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ error: 'keyframeUrl y overlay PNG base64 requeridos' }, { status: 400 });
    }

    // Guardar overlay en Storage
    const base64 = overlayDataUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    const bucket = adminStorage.bucket();
    const fileName = `overlay_${Date.now()}.png`;
    const storagePath = `keyframe-overlays/${perm.uid}/${analysisId}/${fileName}`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { metadata: { contentType: 'image/png' } });
    await fileRef.makePublic();
    const overlayUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const payload: KeyframeAnnotation = {
      analysisId,
      keyframeUrl,
      angle,
      index,
      overlayUrl,
      coachId: perm.uid,
      coachName: perm.name,
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb.collection('analyses').doc(analysisId).collection('keyframeAnnotations').add(payload);
    return NextResponse.json({ success: true, id: ref.id, overlayUrl });
  } catch (e) {
    console.error('❌ Error guardando anotación:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


