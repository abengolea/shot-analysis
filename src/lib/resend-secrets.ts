/**
 * Configuración de Resend: primero desde env (local), si no desde Secret Manager (producción).
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export interface ResendConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
}

let cached: ResendConfig | null = null;

async function getSecret(projectId: string, secretId: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const name = `projects/${projectId}/secrets/${secretId}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  const payload = version.payload?.data;
  if (!payload) return '';
  return Buffer.from(payload as Uint8Array).toString('utf8').trim();
}

/**
 * Obtiene RESEND_API_KEY, RESEND_FROM y opcionalmente RESEND_REPLY_TO.
 * Origen: process.env (local) o Google Secret Manager (producción).
 */
export async function getResendConfig(): Promise<ResendConfig | null> {
  if (cached) return cached;

  const fromEnv = {
    apiKey: process.env.RESEND_API_KEY?.trim(),
    from: process.env.RESEND_FROM?.trim(),
    replyTo: process.env.RESEND_REPLY_TO?.trim(),
  };

  if (fromEnv.apiKey && fromEnv.from) {
    cached = { apiKey: fromEnv.apiKey, from: fromEnv.from, replyTo: fromEnv.replyTo };
    return cached;
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    '';

  if (!projectId) {
    return null;
  }

  try {
    const [apiKey, from, replyTo] = await Promise.all([
      getSecret(projectId, 'RESEND_API_KEY'),
      getSecret(projectId, 'RESEND_FROM'),
      getSecret(projectId, 'RESEND_REPLY_TO').catch(() => ''),
    ]);

    if (!apiKey || !from) return null;

    cached = { apiKey, from, replyTo: replyTo || undefined };
    return cached;
  } catch (err) {
    console.error('[resend-secrets] Error leyendo Secret Manager:', err);
    return null;
  }
}
