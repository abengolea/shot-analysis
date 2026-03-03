export function normalizeBaseUrl(value?: string | null): string {
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

function isLocalhostUrl(value: string): boolean {
  return /^https?:\/\/localhost(?::\d+)?$/i.test(value);
}

function isWildcardHostUrl(value: string): boolean {
  return /^https?:\/\/0\.0\.0\.0(?::\d+)?$/i.test(value);
}

function normalizeRequestOrigin(value: string): string {
  if (isWildcardHostUrl(value)) {
    return value.replace(/^https?:\/\/0\.0\.0\.0/i, 'http://localhost');
  }
  return value;
}

function resolveEnvBaseUrl(): string {
  const appEnv = String(process.env.APP_ENV || '').toLowerCase();
  if (appEnv === 'staging') {
    const stagingUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL_STAGING || '');
    if (stagingUrl) return stagingUrl;
  }
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.APP_URL;
  const normalizedEnv = normalizeBaseUrl(envUrl);
  if (!normalizedEnv) return '';
  if (process.env.NODE_ENV !== 'development' && isLocalhostUrl(normalizedEnv)) {
    return '';
  }
  return normalizedEnv;
}

export function getAppBaseUrl(options?: { requestOrigin?: string | null }): string {
  const requestOriginRaw = normalizeBaseUrl(options?.requestOrigin || '');
  const requestOrigin = normalizeRequestOrigin(requestOriginRaw);
  if (requestOrigin) {
    if (process.env.NODE_ENV !== 'development' && isLocalhostUrl(requestOrigin)) {
      // Evitar retornos a localhost en entornos no locales.
    } else {
      return requestOrigin;
    }
  }

  const normalizedEnv = resolveEnvBaseUrl();
  if (normalizedEnv) return normalizedEnv;

  if (process.env.VERCEL_URL) {
    return normalizeBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || '3000';
    return `http://localhost:${port}`;
  }

  return '';
}

export function getClientAppBaseUrl(): string {
  const normalizedEnv = resolveEnvBaseUrl();
  if (normalizedEnv) return normalizedEnv;

  if (typeof window !== 'undefined') {
    return normalizeBaseUrl(window.location.origin);
  }

  return getAppBaseUrl();
}

/**
 * Reescribe URLs de análisis para que apunten al entorno actual del cliente.
 * Si la URL es un link de análisis (/analysis/ID), devuelve la URL con el origin
 * correcto (local, staging o producción según donde se está viendo la app).
 */
export function resolveMessageLinkToCurrentEnv(url: string): string {
  const analysisMatch = url.match(/\/analysis\/([A-Za-z0-9_-]+)(\?[^#\s]*)?(#.*)?/);
  if (analysisMatch) {
    const base = getClientAppBaseUrl();
    if (base) {
      const path = `/analysis/${analysisMatch[1]}${analysisMatch[2] || ''}${analysisMatch[3] || ''}`;
      return base.replace(/\/+$/, '') + path;
    }
  }
  return url;
}
