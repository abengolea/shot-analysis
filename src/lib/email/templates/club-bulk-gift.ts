/**
 * Template: "Recibiste un regalo de tu club" – análisis y revisiones coach.
 * Se envía cuando el admin aplica "Acceso gratis por club y entrenador" en bloque.
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';

export interface ClubBulkGiftTemplateOptions {
  playerName?: string;
  clubName: string;
  coachName?: string;
  giftAnalyses: number;
  giftCoachReviews: number;
  siteUrl?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function clubBulkGiftTemplate(
  options: ClubBulkGiftTemplateOptions
): { html: string; text: string } {
  const { playerName, clubName, coachName, giftAnalyses, giftCoachReviews, siteUrl } = options;
  const greeting = playerName ? `Hola ${escapeHtml(playerName)},` : 'Hola,';

  const parts: string[] = [];
  if (giftAnalyses > 0) {
    parts.push(`${giftAnalyses} análisis de IA`);
  }
  if (giftCoachReviews > 0) {
    parts.push(`${giftCoachReviews} revisión${giftCoachReviews > 1 ? 'es' : ''} de entrenador`);
  }
  const giftsText = parts.join(' y ');

  const coachLine = coachName
    ? `Tu entrenador ${escapeHtml(coachName)} tiene acceso a tus análisis para darte devoluciones.`
    : '';

  const body = `
    <p style="margin: 0 0 20px 0; font-size: 16px;">${greeting}</p>
    <p style="margin: 0 0 24px 0; color: #374151;">
      Tu club <strong>${escapeHtml(clubName)}</strong> te regaló: <strong>${giftsText}</strong>.
    </p>
    ${coachLine ? `<p style="margin: 0 0 24px 0; color: #374151;">${coachLine}</p>` : ''}
    <p style="margin: 0 0 24px 0; color: #374151;">
      Podés usarlos desde tu cuenta. Este regalo es único por jugador y no se repite.
    </p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${siteUrl || 'https://www.chaaaas.com'}/dashboard" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_BLUE} 0%, #0d5bc7 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; font-family: 'Inter', sans-serif;">
        Ir a mi panel
      </a>
    </p>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Equipo Chaaaas.com</p>
  `;

  const html = chaaaasLayout({ body, siteUrl });
  const text = [
    playerName ? `Hola ${playerName},` : 'Hola,',
    '',
    `Tu club ${clubName} te regaló: ${giftsText}.`,
    coachLine ? `\n${coachLine}` : '',
    '',
    'Podés usarlos desde tu cuenta. Este regalo es único por jugador y no se repite.',
    '',
    `Ir a mi panel: ${siteUrl || 'https://www.chaaaas.com'}/dashboard`,
    '',
    'Equipo Chaaaas.com',
  ].join('\n');

  return { html, text };
}
