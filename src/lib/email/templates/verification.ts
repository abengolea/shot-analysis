/**
 * Template: email de verificación de cuenta. Layout Chaaaas.com.
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';

export interface VerificationTemplateOptions {
  verificationLink: string;
  appName?: string;
  siteUrl?: string;
}

export function verificationTemplate(options: VerificationTemplateOptions): { html: string; text: string } {
  const { verificationLink, siteUrl } = options;
  const body = `
    <p style="margin: 0 0 20px 0; font-size: 16px;">Hola,</p>
    <p style="margin: 0 0 20px 0;">Gracias por registrarte. Para completar tu registro, verifica tu dirección de email.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_BLUE} 0%, #0d5bc7 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Verificar email
      </a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">Si el botón no funciona, copiá este enlace:</p>
    <p style="word-break: break-all; font-size: 13px; color: #6b7280;">${verificationLink}</p>
    <p style="font-size: 14px; color: #6b7280;">Este enlace expira en 24 horas.</p>
  `;
  const html = chaaaasLayout({ body, siteUrl });
  const text = [
    'Verifica tu email',
    '',
    'Hola,',
    'Gracias por registrarte. Para completar tu registro, verifica tu dirección de email.',
    '',
    `Haz clic en este enlace: ${verificationLink}`,
    '',
    'Este enlace expira en 24 horas.',
    '',
    'Equipo Chaaaas.com',
  ].join('\n');
  return { html, text };
}
