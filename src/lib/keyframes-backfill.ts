import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { extractKeyframesFromBuffer } from '@/lib/ffmpeg';

type KeyframesInput = {
  analysisId: string;
  playerId?: string | null;
  videoUrl?: string | null;
  videoFrontUrl?: string | null;
  videoLeftUrl?: string | null;
  videoRightUrl?: string | null;
  videoBackUrl?: string | null;
};

const isEmptyKeyframes = (keyframes: any) => {
  if (!keyframes || typeof keyframes !== 'object') return true;
  const all = [
    ...(keyframes.front || []),
    ...(keyframes.back || []),
    ...(keyframes.left || []),
    ...(keyframes.right || []),
  ];
  return all.length === 0;
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

export const scheduleKeyframesExtraction = (params: KeyframesInput) => {
  const { analysisId, playerId, videoUrl, videoFrontUrl, videoLeftUrl, videoRightUrl, videoBackUrl } = params;
  if (!analysisId || !adminDb || !adminStorage) return;
  const bucket = adminStorage.bucket();

  const uploadExtracted = async (
    source: { storagePath?: string | null; httpUrl?: string | null },
    angleKey: 'front' | 'left' | 'right' | 'back',
    count: number
  ) => {
    const urls: string[] = [];
    try {
      let videoBuffer: Buffer | null = null;
      if (source.storagePath) {
        try {
          const file = bucket.file(source.storagePath);
          const [buf] = await file.download();
          videoBuffer = buf;
        } catch {
          // fallback a HTTP si falla descarga directa
        }
      }
      if (!videoBuffer && source.httpUrl && /^https?:\/\//i.test(source.httpUrl)) {
        const resp = await fetch(source.httpUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const ab = await resp.arrayBuffer();
        videoBuffer = Buffer.from(ab);
      }
      if (!videoBuffer) return urls;

      const extracted = await extractKeyframesFromBuffer(videoBuffer, count);
      for (const kf of extracted) {
        const kfName = `rebuild_${angleKey}_${kf.index}_${Date.now()}.jpg`;
        const storagePath = `keyframes/${playerId || 'unknown'}/${analysisId}/${kfName}`;
        await bucket.file(storagePath).save(kf.imageBuffer, { metadata: { contentType: 'image/jpeg' } });
        await bucket.file(storagePath).makePublic();
        urls.push(`https://storage.googleapis.com/${process.env.FIREBASE_ADMIN_STORAGE_BUCKET}/${storagePath}`);
      }
    } catch (e) {
      console.warn(`⚠️ No se pudo extraer keyframes para ${angleKey}`, e);
    }
    return urls;
  };

  const run = async () => {
    try {
      const frontPath = toStoragePath(videoFrontUrl || videoUrl || null);
      const leftPath = toStoragePath(videoLeftUrl || null);
      const rightPath = toStoragePath(videoRightUrl || null);
      const backPath = toStoragePath(videoBackUrl || null);

      const [frontK, leftK, rightK, backK] = await Promise.all([
        uploadExtracted({ storagePath: frontPath, httpUrl: videoFrontUrl || videoUrl || null }, 'front', 16),
        uploadExtracted({ storagePath: leftPath, httpUrl: videoLeftUrl || null }, 'left', 12),
        uploadExtracted({ storagePath: rightPath, httpUrl: videoRightUrl || null }, 'right', 12),
        uploadExtracted({ storagePath: backPath, httpUrl: videoBackUrl || null }, 'back', 12),
      ]);

      const keyframes = { front: frontK, left: leftK, right: rightK, back: backK };
      await adminDb.collection('analyses').doc(analysisId).update({
        keyframes,
        keyframesStatus: 'ready',
        keyframesUpdatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('❌ Error generando keyframes async:', e);
      await adminDb.collection('analyses').doc(analysisId).update({
        keyframesStatus: 'error',
        keyframesUpdatedAt: new Date().toISOString(),
      });
    }
  };

  setTimeout(() => {
    void run();
  }, 0);
};

export const backfillKeyframesForAnalyses = async (analyses: Array<any>, limit = 3) => {
  if (!adminDb || !adminStorage || !Array.isArray(analyses)) return 0;
  let scheduled = 0;
  for (const analysis of analyses) {
    if (scheduled >= limit) break;
    if (!analysis?.id) continue;
    if (!analysis.videoUrl && !analysis.videoFrontUrl && !analysis.videoBackUrl) continue;
    if (analysis.keyframesStatus === 'pending' || analysis.keyframesStatus === 'ready') continue;
    if (!isEmptyKeyframes(analysis.keyframes)) continue;

    await adminDb.collection('analyses').doc(analysis.id).update({
      keyframesStatus: 'pending',
      keyframesUpdatedAt: new Date().toISOString(),
    });

    scheduleKeyframesExtraction({
      analysisId: analysis.id,
      playerId: analysis.playerId,
      videoUrl: analysis.videoUrl || null,
      videoFrontUrl: analysis.videoFrontUrl || null,
      videoLeftUrl: analysis.videoLeftUrl || null,
      videoRightUrl: analysis.videoRightUrl || null,
      videoBackUrl: analysis.videoBackUrl || null,
    });

    scheduled += 1;
  }
  return scheduled;
};
