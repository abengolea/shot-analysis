/**
 * Template: "Tu análisis fue revisado – ya está tu devolución".
 * Usa layout Chaaaas.com (logo, tipografía, Equipo Chaaaas.com).
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';

export interface CoachReviewCompleteTemplateOptions {
  playerName?: string;
  /** URL al análisis (ej. https://www.chaaaas.com/analysis/xxx) */
  analysisUrl: string;
  siteUrl?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function coachReviewCompleteTemplate(
  options: CoachReviewCompleteTemplateOptions
): { html: string; text: string } {
  const { playerName, analysisUrl, siteUrl } = options;
  const greeting = playerName ? `Hola ${escapeHtml(playerName)},` : 'Hola,';

  const body = `
    <p style="margin: 0 0 20px 0; font-size: 16px;">${greeting}</p>
    <p style="margin: 0 0 24px 0; color: #374151;">
      Tu entrenador completó la revisión de tu análisis. La devolución ya está disponible.
    </p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${analysisUrl}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_BLUE} 0%, #0d5bc7 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; font-family: 'Inter', sans-serif;">
        Ver análisis y devolución
      </a>
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Si el botón no funciona, copiá este enlace:</p>
    <p style="margin: 8px 0 0 0; font-size: 13px; word-break: break-all;"><a href="${analysisUrl}" style="color: ${BRAND_BLUE}; text-decoration: none;">${analysisUrl}</a></p>
  `;

  const html = chaaaasLayout({ body, siteUrl });
  const text = [
    playerName ? `Hola ${playerName},` : 'Hola,',
    '',
    'Tu entrenador completó la revisión de tu análisis. La devolución ya está disponible.',
    '',
    `Ver análisis y devolución: ${analysisUrl}`,
    '',
    'Equipo Chaaaas.com',
  ].join('\n');

  return { html, text };
}
