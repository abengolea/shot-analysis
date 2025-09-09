import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'No disponible en producción' }, { status: 403 });
    }
    if (!adminDb || !adminStorage) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });

    const analysisId = params.id;
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

    const toStoragePath = (publicUrl: string | null) => {
      if (!publicUrl) return null;
      const parts = publicUrl.split('/');
      const idx = parts.findIndex((p) => p === 'videos');
      if (idx >= 0 && parts.length >= idx + 3) {
        const userId = parts[idx + 1];
        const fileName = parts[idx + 2];
        return `videos/${userId}/${fileName}`;
      }
      return publicUrl.split('/').slice(-2).join('/');
    };

    const frontPath = toStoragePath(data.videoUrl || null);
    const leftPath = toStoragePath(data.videoLeftUrl || null);
    const rightPath = toStoragePath(data.videoRightUrl || null);
    const backPath = toStoragePath(data.videoBackUrl || null);

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
    console.error('❌ Error rebuild-keyframes (dev):', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


