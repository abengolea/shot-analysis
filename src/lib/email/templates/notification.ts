/**
 * Template: notificación genérica (admin, tickets, etc.). Layout Chaaaas.com.
 */

import { chaaaasLayout } from './chaaaas-layout';

const BRAND_BLUE = '#0A4AA4';

export interface NotificationTemplateOptions {
  title: string;
  content: string;
  button?: { text: string; url: string };
  appName?: string;
  siteUrl?: string;
}

export function notificationTemplate(options: NotificationTemplateOptions): { html: string; text: string } {
  const { title, content, button, siteUrl } = options;
  const buttonBlock = button
    ? `<p style="text-align: center; margin: 24px 0;">
        <a href="${button.url}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_BLUE} 0%, #0d5bc7 100%); color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">${button.text}</a>
      </p>`
    : '';
  const body = `
    <h2 style="color: ${BRAND_BLUE}; margin-top: 0; font-size: 18px;">${title}</h2>
    <div style="margin: 20px 0;">${content}</div>
    ${buttonBlock}
  `;
  const html = chaaaasLayout({ body, siteUrl });
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const text = [title, '', stripHtml(content), button ? `${button.text}: ${button.url}` : '', 'Equipo Chaaaas.com'].join('\n');
  return { html, text };
}
