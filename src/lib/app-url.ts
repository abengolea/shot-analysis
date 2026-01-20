export function normalizeBaseUrl(value?: string | null): string {
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

function isLocalhostUrl(value: string): boolean {
  return /^https?:\/\/localhost(?::\d+)?$/i.test(value);
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
  const normalizedEnv = resolveEnvBaseUrl();
  if (normalizedEnv) return normalizedEnv;

  const requestOrigin = normalizeBaseUrl(options?.requestOrigin || '');
  if (requestOrigin) return requestOrigin;

  if (process.env.VERCEL_URL) {
    return normalizeBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
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
