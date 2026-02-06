/**
 * Layout base para emails HTML.
 */

const BRAND_COLOR = '#2563eb';
const TEXT_MUTED = '#6b7280';
const MAX_WIDTH = '600px';

export interface BaseLayoutOptions {
  /** Contenido HTML del cuerpo */
  body: string;
  /** Nombre del producto/app */
  appName?: string;
  /** URL del sitio (para footer) */
  siteUrl?: string;
}

export function baseLayout(options: BaseLayoutOptions): string {
  const { body, appName = 'Shot Analysis', siteUrl = '' } = options;
  const footerLink = siteUrl ? `<a href="${siteUrl}" style="color: ${BRAND_COLOR};">Visitar sitio</a>` : '';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: ${MAX_WIDTH}; margin: 0 auto; padding: 24px;">
    <div style="background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
      <div style="background: ${BRAND_COLOR}; color: #fff; padding: 20px 24px;">
        <h1 style="margin:0; font-size: 20px; font-weight: 600;">${appName}</h1>
      </div>
      <div style="padding: 24px; line-height: 1.6; color: #374151;">
        ${body}
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: ${TEXT_MUTED};">
        <p style="margin:0;">&copy; ${new Date().getFullYear()} ${appName}. ${footerLink}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();
}
