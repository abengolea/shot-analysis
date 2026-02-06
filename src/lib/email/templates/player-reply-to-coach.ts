/**
 * Template: "Un jugador te respondió" – mensaje jugador → coach.
 * Usa layout Chaaaas.com (logo, tipografía, Equipo Chaaaas.com).
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';
const BRAND_ORANGE = '#FF6A00';

export interface PlayerReplyToCoachTemplateOptions {
  coachName?: string;
  playerName: string;
  messageText: string;
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

export function playerReplyToCoachTemplate(
  options: PlayerReplyToCoachTemplateOptions
): { html: string; text: string } {
  const { coachName, playerName, messageText, conversationUrl, siteUrl } = options;
  const safeText = escapeHtml(messageText);
  const greeting = coachName ? `Hola ${escapeHtml(coachName)},` : 'Hola,';

  const body = `
    <p style="margin: 0 0 20px 0; font-size: 16px;">${greeting}</p>
    <p style="margin: 0 0 20px 0; color: #374151;">
      <strong style="color: ${BRAND_BLUE};">${escapeHtml(playerName)}</strong> te respondió en el análisis.
    </p>
    <div style="background: linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid ${BRAND_ORANGE}; border-radius: 0 8px 8px 0; padding: 18px 20px; margin: 24px 0;">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${safeText}</p>
    </div>
    <p style="margin: 28px 0 24px 0; font-size: 15px;">Entrá a la plataforma para ver la conversación y responder:</p>
    <p style="text-align: center; margin: 0 0 28px 0;">
      <a href="${conversationUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_BLUE} 0%, #0d5bc7 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; font-family: 'Inter', sans-serif;">
        Ver conversación y responder
      </a>
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Si el botón no funciona, copiá este enlace:</p>
    <p style="margin: 8px 0 0 0; font-size: 13px; word-break: break-all;"><a href="${conversationUrl}" style="color: ${BRAND_BLUE}; text-decoration: none;">${conversationUrl}</a></p>
  `;

  const html = chaaaasLayout({ body, siteUrl });

  const text = [
    coachName ? `Hola ${coachName},` : 'Hola,',
    '',
    `${playerName} te respondió en el análisis.`,
    '',
    '---',
    messageText.trim(),
    '---',
    '',
    `Ver conversación y responder: ${conversationUrl}`,
    '',
    'Equipo Chaaaas.com',
  ].join('\n');

  return { html, text };
}
