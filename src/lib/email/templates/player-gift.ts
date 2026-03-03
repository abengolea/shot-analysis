/**
 * Template: "Recibiste un regalo" – análisis y revisiones (misma cantidad).
 * Se envía cuando el admin regala en forma particular a un jugador.
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';

export interface PlayerGiftTemplateOptions {
  playerName?: string;
  count: number;
  siteUrl?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function playerGiftTemplate(
  options: PlayerGiftTemplateOptions
): { html: string; text: string } {
  const { playerName, count, siteUrl } = options;
  const greeting = playerName ? `Hola ${escapeHtml(playerName)},` : 'Hola,';

  const body = `
    <p style="margin: 0 0 20px 0; font-size: 16px;">${greeting}</p>
    <p style="margin: 0 0 24px 0; color: #374151;">
      Recibiste un regalo: <strong>${count} análisis de IA</strong> y <strong>${count} revisión${count > 1 ? 'es' : ''} de entrenador</strong>.
    </p>
    <p style="margin: 0 0 24px 0; color: #374151;">
      Podés usarlos desde tu cuenta en Chaaaas.com.
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
    `Recibiste un regalo: ${count} análisis de IA y ${count} revisión${count > 1 ? 'es' : ''} de entrenador.`,
    '',
    'Podés usarlos desde tu cuenta en Chaaaas.com.',
    '',
    `Ir a mi panel: ${siteUrl || 'https://www.chaaaas.com'}/dashboard`,
    '',
    'Equipo Chaaaas.com',
  ].join('\n');

  return { html, text };
}
