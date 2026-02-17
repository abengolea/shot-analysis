import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';

async function requireCoachOrAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'coach' || role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150 MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCoachOrAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id: analysisId } = await params;
    if (!adminStorage || !adminDb) return NextResponse.json({ error: 'Storage no inicializado' }, { status: 500 });

    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    if (!file || !(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ ok: false, error: 'No se recibió ningún video' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: 'El video supera el tamaño máximo permitido (150 MB)' }, { status: 400 });
    }

    // Validar duración en servidor (aproximada por tamaño si no tenemos ffprobe)
    // Por ahora confiamos en la validación del cliente; se puede añadir ffprobe después

    const bucket = adminStorage.bucket();
    const timestamp = Date.now();
    const ext = (file.type || '').includes('webm') ? 'webm' : 'mp4';
    const storagePath = `coach-feedback-videos/${analysisId}/${auth.uid}-${timestamp}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type || 'video/mp4',
        metadata: {
          analysisId,
          coachId: auth.uid,
          uploadedAt: new Date().toISOString(),
        },
      },
    });
    await fileRef.makePublic();
    const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const feedbackRef = adminDb.collection('analyses').doc(analysisId).collection('coach_feedback').doc(auth.uid);
    const prev = await feedbackRef.get();
    const nowIso = new Date().toISOString();
    const payload: Record<string, unknown> = {
      coachFeedbackVideoUrl: url,
      updatedAt: nowIso,
      createdAt: prev.exists ? (prev.data() as any)?.createdAt || nowIso : nowIso,
      createdBy: prev.exists ? (prev.data() as any)?.createdBy || auth.uid : auth.uid,
    };
    let coachName = '';
    try {
      const coachSnap = await adminDb.collection('coaches').doc(auth.uid).get();
      const coachData = coachSnap.exists ? (coachSnap.data() as any) : null;
      coachName = typeof coachData?.name === 'string' ? coachData.name.trim() : '';
    } catch {}
    if (coachName) (payload as any).coachName = coachName;
    await feedbackRef.set(payload, { merge: true });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error('coach-feedback-video POST error', e);
    return NextResponse.json({ ok: false, error: 'Error al subir el video' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCoachOrAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id: analysisId } = await params;
    if (!adminStorage || !adminDb) return NextResponse.json({ error: 'Storage no inicializado' }, { status: 500 });

    const feedbackRef = adminDb.collection('analyses').doc(analysisId).collection('coach_feedback').doc(auth.uid);
    const snap = await feedbackRef.get();
    const data = snap.exists ? (snap.data() as any) : null;
    const existingUrl = typeof data?.coachFeedbackVideoUrl === 'string' ? data.coachFeedbackVideoUrl : '';

    if (existingUrl) {
      try {
        const match = existingUrl.match(/storage\.googleapis\.com\/[^/]+\/(.+)$/);
        if (match) {
          const storagePath = decodeURIComponent(match[1]);
          await adminStorage.bucket().file(storagePath).delete({ ignoreNotFound: true });
        }
      } catch (e) {
        console.warn('No se pudo borrar el archivo de storage:', e);
      }
    }

    const nowIso = new Date().toISOString();
    await feedbackRef.set({ coachFeedbackVideoUrl: null, updatedAt: nowIso }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('coach-feedback-video DELETE error', e);
    return NextResponse.json({ ok: false, error: 'Error al eliminar el video' }, { status: 500 });
  }
}
