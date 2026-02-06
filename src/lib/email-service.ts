import fs from 'fs';
import path from 'path';
import nodemailer, { type Transporter } from 'nodemailer';
import { adminAuth } from './firebase-admin';
import { getAppBaseUrl } from './app-url';
import { verificationTemplate, passwordResetTemplate } from './email/templates';
import { chaaaasLayout } from './email/templates/chaaaas-layout';
import { sendEmailResendOrNull, type ResendAttachment } from './resend-service';

const CID_LOGO = 'chaaaas-logo';

/**
 * Servicio de email: Resend primero (env o Secret Manager), fallback SMTP.
 * Templates HTML reutilizables en ./email/templates.
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Solo usado si el envío va por Resend */
  attachments?: ResendAttachment[];
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
}

const ADMIN_NOTIFICATION_EMAILS =
  process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_EMAIL || process.env.NOTIFY_EMAILS || '';

let cachedTransporter: Transporter | null = null;

const normalizeRecipients = (value?: string | string[] | null): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[;,]/g)
    .map(v => v.trim())
    .filter(Boolean);
};

export const getAdminRecipients = (fallback?: string | string[]): string[] => {
  const base = normalizeRecipients(ADMIN_NOTIFICATION_EMAILS);
  if (base.length > 0) return base;
  return normalizeRecipients(fallback);
};

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromEmail = process.env.FROM_EMAIL;

  if (!host || !user || !pass || !fromEmail) {
    console.warn('⚠️ SMTP no configurado. Faltan variables SMTP_* o FROM_EMAIL.');
    return null;
  }

  return { host, port, user, pass, fromEmail };
}

function getTransporter(): Transporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}

async function sendSmtpEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const config = getSmtpConfig();
    if (!transporter || !config) {
      return false;
    }

    const recipients = normalizeRecipients(options.to);
    if (recipients.length === 0) {
      console.warn('⚠️ Email sin destinatarios:', options.subject);
      return false;
    }

    const info = await transporter.sendMail({
      from: config.fromEmail,
      to: recipients.join(','),
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log('📧 Email enviado (SMTP):', { to: recipients.join(', '), messageId: info.messageId });
    return true;
  } catch (error) {
    console.error('❌ Error enviando email por SMTP:', error);
    return false;
  }
}

/** Base URL del entorno actual: local (localhost:PORT), staging o producción (chaaaas.com). */
function getSiteUrlForEmails(): string {
  return getAppBaseUrl();
}

/** Envuelve HTML crudo en layout Chaaaas.com para que todos los mails sean uniformes. */
function ensureChaaaasLayout(html: string): string {
  if (!html) return html;
  // No volver a envolver si ya es documento completo (tiene DOCTYPE o el header del layout)
  const alreadyWrapped =
    html.includes('<!DOCTYPE') ||
    html.includes('Análisis de lanzamiento') ||
    (html.includes('Chaaaas.com') && html.includes('Equipo '));
  if (alreadyWrapped) return html;
  const siteUrl = getSiteUrlForEmails();
  return chaaaasLayout({ body: html, siteUrl });
}

/** Logo Chaaaas como adjunto inline (CID) para que Gmail y otros clientes lo muestren sin depender de URLs externas. */
function getLogoInlineAttachment(): ResendAttachment | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'landing-hero.jpeg');
    if (!fs.existsSync(logoPath)) return null;
    const content = fs.readFileSync(logoPath).toString('base64');
    return { filename: 'logo.jpeg', content, contentId: CID_LOGO };
  } catch {
    return null;
  }
}

/** Reemplaza la URL/data-URI del logo en el HTML por cid: para que use el adjunto inline. */
function useInlineLogoInHtml(html: string): string {
  if (!html.includes('alt="Chaaaas.com"')) return html;
  return html.replace(
    /(<img[^>]*?)src="[^"]*"([^>]*alt="Chaaaas\.com"[^>]*>)/i,
    `$1src="cid:${CID_LOGO}"$2`
  );
}

/** Envío unificado: Resend primero, fallback SMTP. Todo el HTML usa layout Chaaaas.com. */
async function sendEmailUnified(options: EmailOptions): Promise<boolean> {
  const recipients = normalizeRecipients(options.to);
  if (recipients.length === 0) {
    console.warn('⚠️ Email sin destinatarios:', options.subject);
    return false;
  }

  let html = ensureChaaaasLayout(options.html);
  const logoAttachment = getLogoInlineAttachment();
  const attachments = [...(options.attachments || [])];
  if (logoAttachment) {
    html = useInlineLogoInHtml(html);
    attachments.push(logoAttachment);
  }

  const resendResult = await sendEmailResendOrNull({
    to: recipients,
    subject: options.subject,
    html,
    text: options.text,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (resendResult?.ok) {
    console.log('📧 Email enviado (Resend):', { to: recipients.join(', '), id: resendResult.id });
    return true;
  }

  return sendSmtpEmail({ to: options.to, subject: options.subject, html, text: options.text });
}

/**
 * Envía email de verificación (template HTML). Resend primero, fallback SMTP.
 * Links y redirect apuntan al entorno actual (local / staging / producción).
 */
export async function sendVerificationEmail(userId: string, email: string): Promise<boolean> {
  try {
    console.log(`📧 Enviando email de verificación a: ${email}`);
    const siteUrl = getSiteUrlForEmails();
    const actionCodeSettings = siteUrl ? { url: siteUrl } : undefined;
    const verificationLink = await adminAuth.generateEmailVerificationLink(email, actionCodeSettings);
    const { html, text } = verificationTemplate({ verificationLink, siteUrl });
    const sent = await sendEmailUnified({
      to: email,
      subject: 'Verifica tu Email',
      html,
      text,
    });
    if (!sent) console.log('📧 Verification link (log only):', verificationLink);
    console.log(`✅ Email de verificación enviado a: ${email}`);
    return sent;
  } catch (error) {
    console.error('❌ Error enviando email de verificación:', error);
    return false;
  }
}

/**
 * Envía email de restablecimiento de contraseña (template HTML). Resend primero, fallback SMTP.
 * Links y redirect apuntan al entorno actual (local / staging / producción).
 */
export async function sendPasswordResetEmail(email: string): Promise<boolean> {
  try {
    console.log(`📧 Enviando email de restablecimiento a: ${email}`);
    const siteUrl = getSiteUrlForEmails();
    const actionCodeSettings = siteUrl ? { url: siteUrl } : undefined;
    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
    const { html, text } = passwordResetTemplate({ resetLink, siteUrl });
    const sent = await sendEmailUnified({
      to: email,
      subject: 'Restablece tu Contraseña',
      html,
      text,
    });
    if (!sent) console.log('📧 Reset link (log only):', resetLink);
    console.log(`✅ Email de restablecimiento enviado a: ${email}`);
    return sent;
  } catch (error) {
    console.error('❌ Error enviando email de restablecimiento:', error);
    return false;
  }
}

/**
 * Envía email personalizado. Resend primero (con adjuntos si los hay), fallback SMTP.
 */
export async function sendCustomEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`📧 Enviando email personalizado a: ${options.to}`);
    const sent = await sendEmailUnified(options);
    if (!sent) {
      console.log('📧 Custom email (log only):', { to: options.to, subject: options.subject });
      return false;
    }
    console.log(`✅ Email personalizado enviado a: ${options.to}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email personalizado:', error);
    return false;
  }
}

export async function sendAdminNotification(options: {
  subject: string;
  html: string;
  text?: string;
  fallbackTo?: string | string[];
}): Promise<boolean> {
  const recipients = getAdminRecipients(options.fallbackTo);
  if (recipients.length === 0) {
    console.warn('📧 Admin notification skipped: sin destinatarios');
    return false;
  }
  return sendCustomEmail({
    to: recipients.join(','),
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

/**
 * Cola de email: por ahora envía de inmediato.
 * Más adelante se puede reemplazar por Cloud Tasks o cola en DB.
 */
export async function queueEmail(options: EmailOptions): Promise<boolean> {
  return sendEmailUnified(options);
}



