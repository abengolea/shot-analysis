import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id: analysisId } = await params;

    const body = await req.json();
    const category: string = String(body?.category || '');
    const itemId: string = String(body?.itemId || '');
    const itemName: string = String(body?.itemName || '');
    const rating: number | null = (typeof body?.rating === 'number') ? body.rating : null;
    const status: string | undefined = body?.status ? String(body.status) : undefined;
    const comment: string = String(body?.comment || '');
    const attachments: string[] = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!analysisId || !category || !itemId) {
      return NextResponse.json({ ok: false, error: 'Parámetros requeridos: analysisId, category, itemId' }, { status: 400 });
    }

    // Leer datos del análisis para enriquecer el ejemplo
    const aSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!aSnap.exists) return NextResponse.json({ ok: false, error: 'Análisis no encontrado' }, { status: 404 });
    const aData = aSnap.data() as any;

    const doc = {
      analysisId,
      playerId: String(aData?.playerId || ''),
      shotType: aData?.shotType || null,
      createdAt: new Date().toISOString(),
      createdBy: auth.uid,
      taxonomyVersion: 'v1',
      approved: true,
      category,
      itemId,
      itemName: itemName || itemId,
      rating: rating != null ? Number(rating) : null,
      status: status || null,
      comment,
      attachments,
    };

    const ref = await adminDb.collection('training_examples').add(doc);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e) {
    console.error('training-examples POST error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


