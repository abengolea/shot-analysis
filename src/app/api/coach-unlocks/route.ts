import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

type AuthResult =
  | { ok: true; uid: string; role: 'player' | 'admin' }
  | { ok: false };

const MP_BASE = process.env.MP_BASE_URL || 'https://api.mercadopago.com';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN_AR || '';
const MP_NOTIFICATION_URL = process.env.MP_WEBHOOK_URL || '';

const DLOCAL_CHECKOUT_URL =
  process.env.DLOCAL_GO_CHECKOUT_URL ||
  process.env.DLOCAL_CHECKOUT_URL ||
  '';
const DLOCAL_CURRENCY = process.env.DLOCAL_CURRENCY || 'ARS';
const DLOCAL_MIN_AMOUNT = Number(process.env.DLOCAL_MIN_AMOUNT || 0);

async function requirePlayerOrAdmin(req: NextRequest): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const role = coachSnap.exists
      ? (coachSnap.data() as any)?.role
      : playerSnap.exists
        ? (playerSnap.data() as any)?.role
        : undefined;
    if (role === 'admin') return { ok: true, uid, role: 'admin' };
    if (role === 'player') return { ok: true, uid, role: 'player' };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function parseRate(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeReturnBase(): string | undefined {
  const explicit = process.env.MP_RETURN_URL;
  if (explicit) return explicit;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return appUrl;
  const webhookUrl = process.env.MP_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const origin = new URL(webhookUrl).origin;
      return origin;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function buildReturnUrl(base: string, params: Record<string, string>): string {
  const desiredPath = '/player/payments/return';
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    url = new URL(base.startsWith('http') ? base : `https://${base}`);
  }
  const alreadyReturn =
    url.pathname.endsWith('/payments/return') ||
    url.pathname.endsWith('/player/payments/return');
  if (!alreadyReturn) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}${desiredPath}`;
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function buildDlocalCheckoutUrl(input: {
  amount: number;
  currency: string;
  orderId: string;
  description: string;
  returnUrl: string;
}): string {
  if (!DLOCAL_CHECKOUT_URL) {
    throw new Error('DLOCAL_NOT_CONFIGURED');
  }
  const replacements: Record<string, string> = {
    amount: String(input.amount),
    currency: input.currency,
    orderId: input.orderId,
    returnUrl: encodeURIComponent(input.returnUrl),
    description: encodeURIComponent(input.description),
  };
  if (DLOCAL_CHECKOUT_URL.includes('{')) {
    let url = DLOCAL_CHECKOUT_URL;
    for (const [key, value] of Object.entries(replacements)) {
      url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return url;
  }
  const url = new URL(DLOCAL_CHECKOUT_URL);
  url.searchParams.set('amount', String(input.amount));
  url.searchParams.set('currency', input.currency);
  url.searchParams.set('order_id', input.orderId);
  url.searchParams.set('description', input.description);
  url.searchParams.set('return_url', input.returnUrl);
  return url.toString();
}

async function createMercadoPagoPreference(input: {
  amount: number;
  title: string;
  userId: string;
  analysisId: string;
  coachId: string;
  unlockId: string;
  coachName: string;
  returnUrl?: string;
}) {
  if (!MP_ACCESS_TOKEN) {
    throw new Error('MP_ACCESS_TOKEN_AR no configurado');
  }
  const backUrls = input.returnUrl
    ? {
        success: input.returnUrl,
        failure: input.returnUrl,
        pending: input.returnUrl,
      }
    : undefined;
  const canAutoReturn = Boolean(backUrls?.success && backUrls.success.startsWith('https://'));
  const body = {
    items: [
      {
        title: input.title,
        quantity: 1,
        unit_price: input.amount,
        currency_id: 'ARS',
      },
    ],
    metadata: {
      productId: 'coach_review',
      userId: input.userId,
      analysisId: input.analysisId,
      coachId: input.coachId,
      unlockId: input.unlockId,
      coachName: input.coachName,
    },
    external_reference: input.unlockId,
    notification_url: MP_NOTIFICATION_URL || undefined,
    ...(backUrls ? { back_urls: backUrls } : {}),
    ...(canAutoReturn ? { auto_return: 'approved' as const } : {}),
  };
  const res = await fetch(`${MP_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Error creando preferencia MP: ${res.status} ${errTxt}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePlayerOrAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }
    const body = await req.json();
    const analysisId = String(body?.analysisId || '');
    const coachId = String(body?.coachId || '');
    const paymentProvider = String(body?.paymentProvider || 'mercadopago');
    if (!analysisId || !coachId) {
      return NextResponse.json({ error: 'analysisId y coachId son requeridos' }, { status: 400 });
    }
    if (paymentProvider !== 'mercadopago' && paymentProvider !== 'dlocal') {
      return NextResponse.json({ error: 'paymentProvider inválido' }, { status: 400 });
    }

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }
    const analysisData = analysisSnap.data() as any;
    const ownerId = String(analysisData?.playerId || analysisData?.userId || '');
    if (auth.role !== 'admin' && ownerId !== auth.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
    if (!coachSnap.exists) {
      return NextResponse.json({ error: 'Coach no encontrado' }, { status: 404 });
    }
    const coachData = coachSnap.data() as any;
    const coachName = String(coachData?.name || 'Entrenador');
    const rate = parseRate(coachData?.ratePerAnalysis);
    if (rate == null || rate <= 0) {
      return NextResponse.json({ error: 'El entrenador no tiene tarifa válida' }, { status: 400 });
    }
    const platformFee = Math.max(1, Math.round(rate * 0.3));
    const totalAmount = rate + platformFee;

    if (paymentProvider === 'dlocal' && DLOCAL_MIN_AMOUNT > 0 && totalAmount < DLOCAL_MIN_AMOUNT) {
      return NextResponse.json(
        {
          error: 'El monto es demasiado bajo para pagos con tarjeta. Usá MercadoPago.',
          code: 'AMOUNT_TOO_LOW',
        },
        { status: 400 }
      );
    }

    const unlockId = adminDb.collection('coach_unlocks').doc().id;
    const nowIso = new Date().toISOString();
    const returnBase = computeReturnBase();
    const returnUrl = returnBase
      ? buildReturnUrl(returnBase, {
          provider: paymentProvider,
          productId: 'coach_review',
          analysisId,
          coachId,
        })
      : undefined;

    let checkoutUrl: string | undefined;
    let preferenceId: string | undefined;
    let mpInitPoint: string | undefined;
    let mpSandboxInitPoint: string | undefined;

    if (paymentProvider === 'mercadopago') {
      const pref = await createMercadoPagoPreference({
        amount: totalAmount,
        title: `Revisión de entrenador${coachName ? ` (${coachName})` : ''}`,
        userId: ownerId || auth.uid,
        analysisId,
        coachId,
        unlockId,
        coachName,
        returnUrl,
      });
      preferenceId = pref?.id;
      mpInitPoint = pref?.init_point;
      mpSandboxInitPoint = pref?.sandbox_init_point;
      checkoutUrl = mpInitPoint || mpSandboxInitPoint;
    } else {
      checkoutUrl = buildDlocalCheckoutUrl({
        amount: totalAmount,
        currency: DLOCAL_CURRENCY,
        orderId: unlockId,
        description: `Revisión de entrenador${coachName ? ` (${coachName})` : ''}`,
        returnUrl:
          returnUrl ||
          buildReturnUrl('http://localhost:3000', {
            provider: 'dlocal',
            productId: 'coach_review',
            analysisId,
            coachId,
          }),
      });
    }

    if (!checkoutUrl) {
      return NextResponse.json({ error: 'No se pudo obtener URL de pago' }, { status: 500 });
    }

    await adminDb.runTransaction(async (tx) => {
      const freshSnap = await tx.get(analysisRef);
      if (!freshSnap.exists) {
        throw new Error('ANALYSIS_NOT_FOUND');
      }
      const freshData = freshSnap.data() as any;
      const access = (freshData?.coachAccess || {}) as Record<string, any>;
      const existing = access[coachId];
      if (existing?.status === 'paid') {
        throw new Error('ALREADY_PAID');
      }
      if (existing?.status === 'pending') {
        throw new Error('PENDING_PAYMENT');
      }
      tx.set(
        analysisRef,
        {
          coachAccess: {
            [coachId]: {
              status: 'pending',
              coachId,
              coachName,
              paymentProvider,
              amount: totalAmount,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          },
          updatedAt: nowIso,
        },
        { merge: true }
      );
      const unlockRef = adminDb.collection('coach_unlocks').doc(unlockId);
      tx.set(unlockRef, {
        analysisId,
        coachId,
        coachName,
        playerId: ownerId || auth.uid,
        status: 'pending',
        paymentProvider,
        amount: totalAmount,
        currency: paymentProvider === 'dlocal' ? DLOCAL_CURRENCY : 'ARS',
        preferenceId: preferenceId || null,
        checkoutUrl: checkoutUrl,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });

    return NextResponse.json({
      ok: true,
      initPoint: mpInitPoint,
      sandboxInitPoint: mpSandboxInitPoint,
      checkoutUrl,
      redirectUrl: checkoutUrl,
      preferenceId: preferenceId || null,
    });
  } catch (e: any) {
    const code = String(e?.message || '');
    if (code === 'ALREADY_PAID') {
      return NextResponse.json(
        { error: 'El análisis ya está desbloqueado para este entrenador.', code: 'ALREADY_PAID' },
        { status: 409 }
      );
    }
    if (code === 'PENDING_PAYMENT') {
      return NextResponse.json(
        { error: 'Ya hay un pago pendiente para este entrenador.', code: 'PAYMENT_PENDING' },
        { status: 409 }
      );
    }
    if (code === 'ANALYSIS_NOT_FOUND') {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }
    if (code === 'DLOCAL_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'dLocal no está configurado en el servidor.' },
        { status: 500 }
      );
    }
    console.error('coach-unlocks error:', e);
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}
