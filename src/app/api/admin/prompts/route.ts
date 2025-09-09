import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function docIdForShotType(shotType?: string): string {
  const st = (shotType || '').toLowerCase();
  if (st.includes('tres')) return 'prompts_tres';
  if (st.includes('media') || st.includes('jump')) return 'prompts_media';
  if (st.includes('libre')) return 'prompts_libre';
  return 'prompts_general';
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
    const data = snap.exists ? snap.data() : { config: {} };
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error('GET prompts error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const shotType = searchParams.get('shotType') || undefined;
    const body = await req.json();
    const config = (body?.config && typeof body.config === 'object') ? body.config : {};
    // Asegurar estructura conocida si se envían guías por categoría
    if (config && typeof config === 'object') {
      if (config.categoryGuides && typeof config.categoryGuides === 'object') {
        for (const key of Object.keys(config.categoryGuides)) {
          const val = config.categoryGuides[key];
          if (!val || typeof val !== 'object') {
            delete config.categoryGuides[key];
            continue;
          }
          if (val.resources && Array.isArray(val.resources)) {
            config.categoryGuides[key].resources = val.resources.filter((u: any) => typeof u === 'string' && !!u.trim());
          }
        }
      }
      if (Array.isArray(config.resources)) {
        config.resources = config.resources.filter((u: any) => typeof u === 'string' && !!u.trim());
      }
    }
    await adminDb.collection('config').doc(docIdForShotType(shotType)).set({ config, updatedAt: new Date().toISOString(), shotType: shotType || 'general' }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST prompts error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


