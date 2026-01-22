import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const MP_OAUTH_URL = 'https://api.mercadopago.com/oauth/token';

function buildHtml(title: string, message: string) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="font-family: Arial, sans-serif; padding: 24px;">
    <h2>${title}</h2>
    <p>${message}</p>
  </body>
</html>`;
}

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return new NextResponse(
        buildHtml('Error', 'DB no inicializada. Intenta nuevamente.'),
        { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const coachId = url.searchParams.get('state');
    const clientId = process.env.MP_CLIENT_ID || '';
    const clientSecret = process.env.MP_CLIENT_SECRET || '';
    const redirectUri = process.env.MP_OAUTH_REDIRECT_URI || `${url.origin}/api/mp/oauth/callback`;

    if (!code || !coachId) {
      return new NextResponse(
        buildHtml('Error', 'Falta code o state (coachId).'),
        { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }
    if (!clientId || !clientSecret) {
      return new NextResponse(
        buildHtml('Error', 'Faltan credenciales de MercadoPago en el servidor.'),
        { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
    if (!coachSnap.exists) {
      return new NextResponse(
        buildHtml('Error', 'Coach no encontrado en Chaaaas.'),
        { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(MP_OAUTH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return new NextResponse(
        buildHtml('Error', `No se pudo conectar MercadoPago (${tokenRes.status}).`),
        { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    const tokenData = await tokenRes.json();
    const mpAccessToken = tokenData?.access_token;
    const mpRefreshToken = tokenData?.refresh_token;
    const mpUserId = tokenData?.user_id;

    if (!mpAccessToken || !mpUserId) {
      return new NextResponse(
        buildHtml('Error', 'Respuesta inválida de MercadoPago.'),
        { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    const nowIso = new Date().toISOString();
    await adminDb.collection('coach_payment_accounts').doc(coachId).set(
      {
        coachId,
        mpUserId: Number(mpUserId),
        mpAccessToken,
        mpRefreshToken: mpRefreshToken || null,
        status: 'active',
        updatedAt: nowIso,
        createdAt: nowIso,
      },
      { merge: true }
    );

    return new NextResponse(
      buildHtml('Conexión exitosa', 'Tu cuenta de MercadoPago quedó vinculada. Ya podés recibir pagos.'),
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  } catch (err) {
    console.error('MP OAuth callback error', err);
    return new NextResponse(
      buildHtml('Error', 'Ocurrió un error inesperado. Intenta nuevamente.'),
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }
}
