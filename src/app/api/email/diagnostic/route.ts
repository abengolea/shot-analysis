/**
 * Diagnóstico de configuración de email (Resend, SMTP, appBaseUrl).
 * Protegido: requiere token de admin.
 * GET /api/email/diagnostic con Authorization: Bearer <token>
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/api-admin-auth';
import { getResendConfigDiagnostic } from '@/lib/resend-secrets';
import { getAppBaseUrl } from '@/lib/app-url';

function getSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.FROM_EMAIL?.trim();
  return !!(host && user && pass && from);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if (!auth.ok) return auth.response;

  const resendDiag = await getResendConfigDiagnostic();
  const resendConfigured = resendDiag.source === 'env' || resendDiag.source === 'secretmanager';
  const smtpConfigured = getSmtpConfigured();
  const appBaseUrl = getAppBaseUrl();

  const canSend = resendConfigured || smtpConfigured;
  const pasos: string[] = [];

  if (!resendConfigured && resendDiag.error) {
    pasos.push(`Resend: ${resendDiag.error}`);
  }
  if (!resendConfigured && !smtpConfigured) {
    pasos.push('Configurá Resend (Secret Manager: RESEND_API_KEY, RESEND_FROM) o SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL)');
  }
  if (!appBaseUrl) {
    pasos.push('NEXT_PUBLIC_APP_URL no está definida; los links de verificación pueden fallar');
  }

  return NextResponse.json({
    resendConfigured,
    resendSource: resendDiag.source ?? null,
    resendError: resendDiag.error ?? null,
    smtpConfigured,
    appBaseUrl: appBaseUrl || '(vacío)',
    canSendEmails: canSend,
    pasos: pasos.length > 0 ? pasos : ['Configuración OK para envío de emails'],
  });
}
