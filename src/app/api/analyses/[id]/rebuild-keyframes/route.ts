import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';

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
    if (!adminDb || !adminStorage) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });

    const perm = await verifyCoachPermission(request, analysisId);
    if (!perm.ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const snap = await analysisRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'analysis no encontrado' }, { status: 404 });
    const data = snap.data() as any;
    const bucket = adminStorage.bucket();

    const uploadExtracted = async (filePath: string, angleKey: 'front'|'left'|'right'|'back', count: number) => {
      try {
        const file = bucket.file(filePath);
        const [buf] = await file.download();
        const extracted = await extractKeyframesFromBuffer(buf, count);
        const urls: string[] = [];
        for (const kf of extracted) {
          const kfName = `rebuild_${angleKey}_${kf.index}_${Date.now()}.jpg`;
          const storagePath = `keyframes/${data.playerId || 'unknown'}/${analysisId}/${kfName}`;
          await bucket.file(storagePath).save(kf.imageBuffer, { metadata: { contentType: 'image/jpeg' } });
          await bucket.file(storagePath).makePublic();
          urls.push(`https://storage.googleapis.com/${process.env.FIREBASE_ADMIN_STORAGE_BUCKET}/${storagePath}`);
        }
        return urls;
      } catch (e) {
        console.warn(`⚠️ No se pudo extraer para ${angleKey} desde ${filePath}`, e);
        return [] as string[];
      }
    };

    // Construir rutas de archivos desde las URLs públicas conocidas
    const frontUrl: string | null = data.videoUrl || null;
    const leftUrl: string | null = data.videoLeftUrl || null;
    const rightUrl: string | null = data.videoRightUrl || null;
    const backUrl: string | null = data.videoBackUrl || null;

    const toStoragePath = (publicUrl: string | null) => {
      if (!publicUrl) return null;
      // Esperamos formato https://storage.googleapis.com/<bucket>/videos/<userId>/<file>
      const parts = publicUrl.split('/');
      const idx = parts.findIndex((p) => p === 'videos');
      if (idx >= 0 && parts.length >= idx + 3) {
        const userId = parts[idx + 1];
        const fileName = parts[idx + 2];
        return `videos/${userId}/${fileName}`;
      }
      // fallback: intentar último segmento
      return publicUrl.split('/').slice(-2).join('/');
    };

    const frontPath = toStoragePath(frontUrl);
    const leftPath = toStoragePath(leftUrl);
    const rightPath = toStoragePath(rightUrl);
    const backPath = toStoragePath(backUrl);

    const [frontK, leftK, rightK, backK] = await Promise.all([
      frontPath ? uploadExtracted(frontPath, 'front', 16) : Promise.resolve([]),
      leftPath ? uploadExtracted(leftPath, 'left', 12) : Promise.resolve([]),
      rightPath ? uploadExtracted(rightPath, 'right', 12) : Promise.resolve([]),
      backPath ? uploadExtracted(backPath, 'back', 12) : Promise.resolve([]),
    ]);

    const keyframes = { front: frontK, left: leftK, right: rightK, back: backK };
    await analysisRef.update({ keyframes, updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true, keyframes });
  } catch (e) {
    console.error('❌ Error rebuild-keyframes:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

