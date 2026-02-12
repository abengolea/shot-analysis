/**
 * Envío de emails vía Resend (API key desde env o Secret Manager).
 * Soporta HTML, texto plano, adjuntos y replyTo.
 */

import { getResendConfig } from '@/lib/resend-secrets';
import { Resend } from 'resend';

export interface ResendAttachment {
  /** Nombre del archivo */
  filename: string;
  /** Contenido en base64 */
  content: string;
  /** Content-ID para imágenes inline (referencia en HTML: src="cid:valor") */
  contentId?: string;
}

export interface ResendSendOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: ResendAttachment[];
}

export interface ResendSendResult {
  ok: true;
  id: string | null;
}

/**
 * Envía un email con Resend.
 * Devuelve { ok, id } o lanza si no hay config o Resend falla.
 */
export async function sendEmailResend(options: ResendSendOptions): Promise<ResendSendResult> {
  const config = await getResendConfig();
  if (!config?.apiKey || !config.from) {
    throw new Error('Resend no configurado (RESEND_API_KEY, RESEND_FROM o Secret Manager)');
  }

  const resend = new Resend(config.apiKey);
  const to = Array.isArray(options.to) ? options.to : [options.to];

  const payload = {
    from: config.from,
    to,
    subject: options.subject,
    replyTo: options.replyTo ?? config.replyTo,
    text: options.text ?? (options.html ? undefined : ''),
    html: options.html,
    ...(options.attachments?.length && {
      attachments: options.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        ...(a.contentId && { contentId: a.contentId }),
      })),
    }),
  };

  const { data, error } = await resend.emails.send(payload as Parameters<Resend['emails']['send']>[0]);

  if (error) throw new Error(error.message);
  return { ok: true, id: data?.id ?? null };
}

/**
 * Intenta enviar con Resend. Si falla o no hay config, devuelve null (para hacer fallback a SMTP).
 */
export async function sendEmailResendOrNull(
  options: ResendSendOptions
): Promise<ResendSendResult | null> {
  try {
    return await sendEmailResend(options);
  } catch (err) {
    console.warn('[resend-service] Envío fallido, usar fallback SMTP:', err);
    return null;
  }
}
