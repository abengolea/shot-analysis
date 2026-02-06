/**
 * Template: "Tu entrenador te escribió" – mensaje coach → jugador.
 * Usa layout Chaaaas.com (logo, tipografía, Equipo Chaaaas.com).
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';
const BRAND_ORANGE = '#FF6A00';

export interface CoachMessageTemplateOptions {
  playerName?: string;
  coachName: string;
  messageText: string;
  /** URL a la conversación (ej. https://www.chaaaas.com/analysis/xxx#messages) */
  conversationUrl: string;
  siteUrl?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

export function coachMessageTemplate(options: CoachMessageTemplateOptions): { html: string; text: string } {
  const { playerName, coachName, messageText, conversationUrl, siteUrl } = options;
  const safeText = escapeHtml(messageText);
  const greeting = playerName ? `Hola ${escapeHtml(playerName)},` : 'Hola,';

  const body = `
    <p style="margin: 0 0 20px 0; font-size: 16px;">${greeting}</p>
    <p style="margin: 0 0 20px 0; color: #374151;">
      Tu entrenador <strong style="color: ${BRAND_BLUE};">${escapeHtml(coachName)}</strong> te envió un mensaje en el análisis.
    </p>
    <div style="background: linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid ${BRAND_ORANGE}; border-radius: 0 8px 8px 0; padding: 18px 20px; margin: 24px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${safeText}</p>
    </div>
    <p style="margin: 28px 0 24px 0; font-size: 15px;">Respondé desde la plataforma para seguir la conversación:</p>
    <p style="text-align: center; margin: 0 0 28px 0;">
      <a href="${conversationUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_BLUE} 0%, #0d5bc7 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; font-family: 'Inter', sans-serif;">
        Ver conversación y responder
      </a>
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Si el botón no funciona, copiá este enlace en tu navegador:</p>
    <p style="margin: 8px 0 0 0; font-size: 13px; word-break: break-all;"><a href="${conversationUrl}" style="color: ${BRAND_BLUE}; text-decoration: none;">${conversationUrl}</a></p>
  `;

  const html = chaaaasLayout({ body, siteUrl });

  const plainMessage = messageText.replace(/\n/g, '\n').trim();
  const text = [
    playerName ? `Hola ${playerName},` : 'Hola,',
    '',
    `Tu entrenador ${coachName} te envió un mensaje en el análisis.`,
    '',
    '---',
    plainMessage,
    '---',
    '',
    `Ver conversación y responder: ${conversationUrl}`,
    '',
    'Equipo Chaaaas.com',
  ].join('\n');

  return { html, text };
}
