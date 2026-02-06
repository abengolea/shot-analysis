import { getResendConfig } from '@/lib/resend-secrets';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const TEST_TO = 'abengolea1@gmail.com';

export async function GET() {
  return NextResponse.json({
    message: 'Envía un POST para mandar el email de prueba.',
    ejemplo: 'curl -X POST http://localhost:9999/api/email/test',
  });
}

export async function POST() {
  const config = await getResendConfig();
  if (!config?.apiKey || !config.from) {
    const msg =
      'RESEND no configurado: usa .env.local (RESEND_API_KEY, RESEND_FROM) en local o Secret Manager (RESEND_API_KEY, RESEND_FROM) en producción.';
    console.error('[api/email/test]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
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
