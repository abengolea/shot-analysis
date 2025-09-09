import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function docIdForShotType(shotType?: string): string {
  const st = (shotType || '').toLowerCase();
  if (st.includes('tres')) return 'scoringWeights_tres';
  if (st.includes('media') || st.includes('jump')) return 'scoringWeights_media';
  if (st.includes('libre')) return 'scoringWeights_libre';
  return 'scoringWeights_general';
}

async function requireAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shotType = searchParams.get('shotType') || undefined;
    const ref = adminDb.collection('config').doc(docIdForShotType(shotType));
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : { weights: {} };
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error('GET scoring-weights error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const shotType = searchParams.get('shotType') || undefined;
    const body = await req.json();
    const weights = (body?.weights && typeof body.weights === 'object') ? body.weights : {};
    await adminDb.collection('config').doc(docIdForShotType(shotType)).set({ weights, updatedAt: new Date().toISOString(), shotType: shotType || 'general' }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST scoring-weights error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


