import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// POST /api/profile/ranking-settings
// Body: { publicRankingOptIn?: boolean, publicAlias?: string, publicShowCountry?: boolean, publicShowClub?: boolean }
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const body = await request.json();
    const payload: any = {};
    if (typeof body.publicRankingOptIn === 'boolean') payload.publicRankingOptIn = body.publicRankingOptIn;
    if (typeof body.publicAlias === 'string') payload.publicAlias = String(body.publicAlias).slice(0, 60);
    if (typeof body.publicShowCountry === 'boolean') payload.publicShowCountry = body.publicShowCountry;
    if (typeof body.publicShowClub === 'boolean') payload.publicShowClub = body.publicShowClub;
    payload.updatedAt = new Date().toISOString();

    const playerRef = adminDb.collection('players').doc(uid);
    await playerRef.set(payload, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error en ranking-settings:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


