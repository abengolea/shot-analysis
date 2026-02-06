import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const MP_AUTH_URL = 'https://auth.mercadopago.com.ar/authorization';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const coachId = decoded.uid;

    if (!adminDb) {
      return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    }

    const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
    if (!coachSnap.exists) {
      return NextResponse.json({ error: 'Coach no encontrado' }, { status: 404 });
    }

    const clientId = process.env.MP_CLIENT_ID || '';
    const redirectUri = process.env.MP_OAUTH_REDIRECT_URI || `${req.nextUrl.origin}/api/mp/oauth/callback`;
    if (!clientId) {
      return NextResponse.json({ error: 'MP_CLIENT_ID no configurado' }, { status: 500 });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: coachId,
    });

    const url = `${MP_AUTH_URL}?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('MP OAuth start error', err);
    return NextResponse.json({ error: 'No se pudo iniciar la conexión' }, { status: 500 });
  }
}
