import { adminDb } from '@/lib/firebase-admin';

const DLOCAL_BASE = process.env.DLOCAL_BASE_URL || 'https://api.dlocalgo.com';
const DLOCAL_API_KEY = process.env.DLOCAL_API_KEY || '';
const DLOCAL_SECRET_KEY = process.env.DLOCAL_SECRET_KEY || '';
const DLOCAL_NOTIFICATION_URL = process.env.DLOCAL_WEBHOOK_URL || '';

type CreatePaymentInput = {
  userId?: string;
  productId: 'analysis_1' | 'pack_3' | 'pack_10' | 'history_plus_annual' | 'coach_review';
  amount: number;
  currency: 'ARS' | 'USD';
  title: string;
  userEmail?: string;
  userFullName?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
};

const DLOCAL_MIN_AMOUNT_ARS = 1500;
const DLOCAL_MIN_AMOUNT_USD = 1;

function getAuthToken(): string {
  const apiKey = (DLOCAL_API_KEY || '').trim();
  const secretKey = (DLOCAL_SECRET_KEY || '').trim();
  if (!apiKey || !secretKey) {
    throw new Error('DLOCAL_API_KEY y DLOCAL_SECRET_KEY deben estar configurados');
  }
  return `Bearer ${apiKey}:${secretKey}`;
}

function computeReturnBase(): string | undefined {
  const explicit = process.env.DLOCAL_RETURN_URL;
  if (explicit) return explicit;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return appUrl;
  const webhookUrl = process.env.DLOCAL_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const origin = new URL(webhookUrl).origin;
      return origin;
    } catch {}
  }
  return undefined;
}

function resolveReturnUrl(base: string): string {
  try {
    const u = new URL(base);
    return `${u.origin}/player/payments/return`;
  } catch {
    const trimmed = base.replace(/\/$/, '');
    if (trimmed.endsWith('/payments/return') || trimmed.endsWith('/player/payments/return')) return trimmed;
    if (trimmed.includes('/player/')) {
      return `${trimmed}/payments/return`;
    }
    return `${trimmed}/player/payments/return`;
  }
}

function buildReturnUrl(input: CreatePaymentInput): string | undefined {
  const base = input.returnUrl || computeReturnBase();
  if (!base) return undefined;
  const resolved = resolveReturnUrl(base);
  try {
    const url = new URL(resolved);
    if (input.productId) url.searchParams.set('productId', input.productId);
    if (input.metadata?.coachId) url.searchParams.set('coachId', String(input.metadata.coachId));
    if (input.metadata?.analysisId) url.searchParams.set('analysisId', String(input.metadata.analysisId));
    url.searchParams.set('provider', 'dlocal');
    return url.toString();
  } catch {
    return resolved;
  }
}

export async function fetchDlocalPayment(paymentId: string) {
  if (!DLOCAL_API_KEY || !DLOCAL_SECRET_KEY) {
    throw new Error('DLOCAL_API_KEY y DLOCAL_SECRET_KEY deben estar configurados');
  }
  const res = await fetch(`${DLOCAL_BASE}/v1/orders/${paymentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      authorization: getAuthToken(),
    },
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Error obteniendo pago de dLocal: ${res.status} ${errTxt}`);
  }
  return res.json();
}

export async function createPayment(input: CreatePaymentInput) {
  if (!DLOCAL_API_KEY || !DLOCAL_SECRET_KEY) {
    throw new Error('DLOCAL_API_KEY y DLOCAL_SECRET_KEY deben estar configurados');
  }

  if (input.currency === 'ARS' && input.amount < DLOCAL_MIN_AMOUNT_ARS) {
    throw new Error(`El monto mínimo para pagos con tarjeta es de $${DLOCAL_MIN_AMOUNT_ARS} ARS. El monto ingresado es de $${input.amount} ARS.`);
  }
  if (input.currency === 'USD' && input.amount < DLOCAL_MIN_AMOUNT_USD) {
    throw new Error(`El monto mínimo para pagos con tarjeta es de $${DLOCAL_MIN_AMOUNT_USD} USD. El monto ingresado es de $${input.amount} USD.`);
  }

  const returnUrl = buildReturnUrl(input);
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const body = {
    amount: input.amount,
    currency: input.currency,
    country: input.currency === 'ARS' ? 'AR' : 'US',
    order_id: orderId,
    description: input.title,
    notification_url: DLOCAL_NOTIFICATION_URL,
    ...(returnUrl ? { redirect_url: returnUrl } : {}),
    payer: {
      ...(input.userEmail ? { email: input.userEmail } : {}),
      ...(input.userFullName ? { name: input.userFullName } : {}),
    },
    metadata: {
      ...(input.metadata || {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.userEmail ? { userEmail: input.userEmail } : {}),
      productId: input.productId,
    },
  };

  const res = await fetch(`${DLOCAL_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthToken(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Error creando pago con dLocal Go: ${res.status} ${errTxt}`);
  }

  const payment = await res.json();

  if (adminDb && (payment.id || payment.order_id || orderId)) {
    const base: any = {
      provider: 'dlocal',
      providerPaymentId: payment.id || payment.order_id || orderId,
      productId: input.productId,
      amount: input.amount,
      currency: input.currency,
      status: payment.status || 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (input.userId) base.userId = input.userId;
    if (input.metadata?.coachId) base.coachId = input.metadata.coachId;
    if (input.metadata?.analysisId) base.analysisId = input.metadata.analysisId;
    await adminDb.collection('payments').doc(payment.id || payment.order_id || orderId).set(base);
  }

  return payment;
}
