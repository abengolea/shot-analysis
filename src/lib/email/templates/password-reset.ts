/**
 * Template: restablecimiento de contraseña.
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';

export interface PasswordResetTemplateOptions {
  resetLink: string;
  appName?: string;
  siteUrl?: string;
}

export function passwordResetTemplate(options: PasswordResetTemplateOptions): { html: string; text: string } {
  const { resetLink, siteUrl } = options;
  const body = `
    <p style="margin: 0 0 20px 0; font-size: 16px;">Hola,</p>
    <p style="margin: 0 0 20px 0;">Has solicitado restablecer tu contraseña.</p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_BLUE} 0%, #0d5bc7 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Restablecer contraseña</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">Si el botón no funciona, copiá este enlace:</p>
    <p style="word-break: break-all; font-size: 13px; color: #6b7280;">${resetLink}</p>
    <p style="font-size: 14px; color: #6b7280;">Este enlace expira en 1 hora.</p>
    <p>Si no solicitaste este cambio, podés ignorar este email.</p>
  `;
  const html = chaaaasLayout({ body, siteUrl });
  const text = [
    'Restablece tu contraseña', '', 'Hola,', 'Has solicitado restablecer tu contraseña.',
    '', `Haz clic en este enlace: ${resetLink}`, '', 'Este enlace expira en 1 hora.',
    'Si no solicitaste este cambio, podés ignorar este email.', '', 'Equipo Chaaaas.com',
  ].join('\n');
  return { html, text };
}
