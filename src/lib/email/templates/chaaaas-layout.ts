/**
 * Layout de email con marca Chaaaas.com.
 * Logo: landing-hero.jpeg (canasta + CHAAAAS.com). Tipografía: Inter + Oswald.
 */

const BRAND_BLUE = '#0A4AA4';
const BRAND_ORANGE = '#FF6A00';
const TEXT_DARK = '#1f2937';
const TEXT_MUTED = '#6b7280';
const MAX_WIDTH = '600px';

// Fallback cuando no hay siteUrl (SVG del icono chas-logo)
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="#ffffff"/><g transform="translate(12,10)"><path d="M8 16h44v8H16v32H8z" fill="#0A4AA4"/><ellipse cx="84" cy="26" rx="20" ry="20" fill="#FF6A00"/><path d="M64 40c8-4 16-6 24-6 6 0 12 1 18 4" stroke="#fff" stroke-width="3" fill="none"/><path d="M36 58h52c1 0 2 1 2 2v2c0 9-7 16-16 16H50c-9 0-16-7-16-16v-2c0-1 1-2 2-2z" fill="#0A4AA4"/><g transform="translate(52,62)"><path d="M0 0h20v1H0z" fill="#fff"/><path d="M2 0v12M6 0v12M10 0v12M14 0v12M18 0v12" stroke="#fff" stroke-width="1"/></g></g></svg>';

function getLogoFallbackDataUri(): string {
  return `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;
}

export interface ChaaaasLayoutOptions {
  /** Contenido HTML del cuerpo */
  body: string;
  /** URL base del sitio (ej. https://www.chaaaas.com) para logo y links */
  siteUrl?: string;
}

/** URL base pública para imágenes en email (evita localhost para que el logo cargue en el cliente). */
function getLogoBaseUrl(siteUrl: string): string {
  const base = (siteUrl || '').replace(/\/$/, '');
  if (base && !/^https?:\/\/localhost(?::\d+)?$/i.test(base) && !/^https?:\/\/0\.0\.0\.0/i.test(base)) {
    return base;
  }
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '');
  return envUrl || base;
}

export function chaaaasLayout(options: ChaaaasLayoutOptions): string {
  const { body, siteUrl = '' } = options;
  const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
  const logoBase = getLogoBaseUrl(siteUrl);
  const logoUrl = logoBase ? `${logoBase}/landing-hero.jpeg` : '';
  const logoSrc = logoUrl || getLogoFallbackDataUri();
  const visitLink = base ? `<a href="${base}" style="color: ${BRAND_BLUE}; text-decoration: none; font-weight: 500;">Visitar Chaaaas.com</a>` : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chaaaas.com</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f8fafc;">
  <div style="max-width: ${MAX_WIDTH}; margin: 0 auto; padding: 32px 20px;">
    <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06); overflow: hidden;">
      <div style="background: #ffffff; padding: 24px 32px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
        <img src="${logoSrc}" alt="Chaaaas.com" width="110" style="max-width: 110px; height: auto; display: block; margin: 0 auto;" />
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500; color: ${TEXT_MUTED}; letter-spacing: 0.06em; margin-top: 10px; text-transform: uppercase;">Análisis de lanzamiento</div>
      </div>
      <div style="padding: 32px; line-height: 1.65; color: ${TEXT_DARK}; font-size: 15px;">
        ${body}
      </div>
      <div style="padding: 20px 32px; border-top: 1px solid #e5e7eb; font-size: 13px; color: ${TEXT_MUTED}; text-align: center;">
        <p style="margin: 0 0 6px 0;">Equipo <strong style="color: ${BRAND_BLUE};">Chaaaas.com</strong></p>
        <p style="margin: 0;">${visitLink}</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();
}
