import { getResendConfig, getResendConfigDiagnostic } from '@/lib/resend-secrets';
import { requireAdminRequest } from '@/lib/api-admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const TEST_TO = 'abengolea1@gmail.com';

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (!auth.ok) return auth.response;
  if (!checkRateLimit(`email-test:${auth.uid}`)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  return NextResponse.json({
    message: 'Envía un POST con Authorization: Bearer <token_admin> para mandar el email de prueba.',
    ejemplo: 'curl -X POST -H "Authorization: Bearer <token>" http://localhost:9999/api/email/test',
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (!auth.ok) return auth.response;
  if (!checkRateLimit(`email-test:${auth.uid}`)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }
  const config = await getResendConfig();
  if (!config?.apiKey || !config.from) {
    const diagnostic = await getResendConfigDiagnostic();
    const msg =
      'RESEND no configurado: usa .env.local (RESEND_API_KEY, RESEND_FROM) en local o Secret Manager en staging/producción.';
    console.error('[api/email/test]', msg, diagnostic);
    return NextResponse.json(
      {
        error: msg,
        diagnostico: diagnostic,
        pasos:
          diagnostic.source === 'secretmanager' && diagnostic.error
            ? [
                '1. Crear secretos en GCP: node scripts/setup-resend-secrets.js (con .env.local con RESEND_*)',
                '2. Dar a la cuenta de App Hosting el rol Secret Manager Secret Accessor',
              ]
            : undefined,
      },
      { status: 500 }
    );
  }

  const resend = new Resend(config.apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: config.from,
      to: TEST_TO,
      subject: 'Email de prueba – Resend OK',
      text: 'Este es un email de prueba enviado desde tu app Next.js usando Resend. Si lo recibiste, Resend está funcionando correctamente.',
    });

    if (error) {
      console.error('[api/email/test] Resend:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, id: data?.id ?? null },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al enviar el email';
    console.error('[api/email/test]', message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Para probar:
// curl -X POST http://localhost:9999/api/email/test
