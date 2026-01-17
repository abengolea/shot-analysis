import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: analysisId } = await params;
    if (!adminDb || !adminStorage) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    const body = await request.json();
    const angle = String(body?.angle || 'front') as 'front'|'back'|'left'|'right';
    const frames = Array.isArray(body?.frames) ? body.frames as Array<{ dataUrl: string; timestamp?: number; description?: string }> : [];
    if (!frames.length) return NextResponse.json({ error: 'frames requeridos' }, { status: 400 });

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const snap = await analysisRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'analysis no encontrado' }, { status: 404 });
    const data = snap.data() as any;
    const playerId = data?.playerId || 'unknown';

    const bucket = adminStorage.bucket();
    const urls: string[] = [];
    let idx = 0;
    for (const f of frames) {
      try {
        const b64 = (f.dataUrl || '').split(',')[1];
        if (!b64) continue;
        const buf = Buffer.from(b64, 'base64');
        const name = `client_${angle}_${Date.now()}_${idx++}.jpg`;
        const storagePath = `keyframes/${playerId}/${analysisId}/${name}`;
        await bucket.file(storagePath).save(buf, { metadata: { contentType: 'image/jpeg' } });
        await bucket.file(storagePath).makePublic();
        urls.push(`https://storage.googleapis.com/${process.env.FIREBASE_ADMIN_STORAGE_BUCKET}/${storagePath}`);
      } catch {}
    }

    const prev = (data?.keyframes || { front: [], back: [], left: [], right: [] }) as Record<string,string[]>;
    const merged = { ...prev, [angle]: [ ...(prev[angle] || []), ...urls ] };
    await analysisRef.update({ keyframes: merged, updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true, keyframes: merged });
  } catch (e) {
    console.error('upload keyframes error', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

