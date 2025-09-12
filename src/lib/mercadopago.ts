import { adminDb } from '@/lib/firebase-admin';

const MP_BASE = process.env.MP_BASE_URL || 'https://api.mercadopago.com';
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN_AR || '';
const MP_NOTIFICATION_URL = process.env.MP_WEBHOOK_URL || '';

type PreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: 'ARS';
};

type CreatePreferenceInput = {
  userId?: string;
  productId: 'analysis_1' | 'pack_3' | 'pack_10' | 'history_plus_annual';
  amountARS: number;
  title: string;
  userEmail?: string;
};

export async function createPreference(input: CreatePreferenceInput) {
  if (!MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN_AR no configurado');

  const body = {
    items: [
      {
        title: input.title,
        quantity: 1,
        unit_price: input.amountARS,
        currency_id: 'ARS',
      } as PreferenceItem,
    ],
    metadata: {
      userId: input.userId,
      ...(input.userEmail ? { userEmail: input.userEmail } : {}),
      productId: input.productId,
    },
    notification_url: MP_NOTIFICATION_URL,
    back_urls: {
      success: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      failure: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      pending: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    auto_return: 'approved',
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
  const pref = await res.json();

  // Registrar intento de pago
  if (adminDb) {
    await adminDb.collection('payments').doc(pref.id).set({
      provider: 'mercadopago',
      providerPaymentId: pref.id,
      userId: input.userId,
      productId: input.productId,
      amount: input.amountARS,
      currency: 'ARS',
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return pref;
}

export async function handleWebhook(event: any) {
  // Mercado Pago envía distintos tipos; nos interesa payment approved
  try {
    const type = event.type || event.action;
    if (type === 'payment.created' || type === 'payment.updated') {
      const data = event.data || event.data_id ? { id: event.data?.id || event.data_id } : null;
      if (!data?.id) return { ok: true };

      const paymentRes = await fetch(`${MP_BASE}/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });
      const payment = await paymentRes.json();

      const status = payment.status as string;
      const prefId = payment?.metadata?.payment_preference_id || payment.order?.id || payment.external_reference || payment.metadata?.preference_id || payment.metadata?.preferenceId;
      let userId = payment?.metadata?.userId as string | undefined;
      const productId = payment?.metadata?.productId as CreatePreferenceInput['productId'];
      const emailCandidate = (payment?.metadata?.userEmail || payment?.payer?.email || payment?.additional_info?.payer?.email) as string | undefined;

      if (!userId || !productId) {
        // Intentar leer del doc de preferencia
        const prefDoc = prefId ? await adminDb.collection('payments').doc(prefId).get() : null;
        const prefData = prefDoc?.exists ? prefDoc.data() : undefined;
        if (!userId && prefData?.userId) {
          (payment.metadata ||= {}).userId = prefData.userId;
          userId = prefData.userId;
        }
        if (!productId && prefData?.productId) {
          (payment.metadata ||= {}).productId = prefData.productId;
        }
      }

      // Si aún falta userId, resolverlo por email
      if (!userId && emailCandidate && adminDb) {
        try {
          const playersSnap = await adminDb.collection('players').where('email', '==', emailCandidate).limit(1).get();
          if (!playersSnap.empty) {
            userId = playersSnap.docs[0].id;
            (payment.metadata ||= {}).userId = userId;
          } else {
            const coachesSnap = await adminDb.collection('coaches').where('email', '==', emailCandidate).limit(1).get();
            if (!coachesSnap.empty) {
              userId = coachesSnap.docs[0].id;
              (payment.metadata ||= {}).userId = userId;
            }
          }
        } catch (e) {
          console.error('Error resolviendo userId por email en webhook:', e);
        }
      }

      // Actualizar registro de pago
      if (adminDb) {
        await adminDb.collection('payments').doc(payment.id).set(
          {
            provider: 'mercadopago',
            providerPaymentId: payment.id,
            userId: payment.metadata?.userId || '',
            productId: payment.metadata?.productId || 'analysis_1',
            amount: payment.transaction_amount,
            currency: (payment.currency_id || 'ARS') as 'ARS' | 'USD',
            status: status as any,
            raw: payment,
            updatedAt: new Date().toISOString(),
            createdAt: new Date(payment.date_created).toISOString(),
          },
          { merge: true }
        );
      }

      // Acreditar beneficios si approved
      if (status === 'approved' && adminDb) {
        const productIdResolved = (payment.metadata?.productId || 'analysis_1') as CreatePreferenceInput['productId'];
        const userIdResolved = (payment.metadata?.userId || userId) as string;
        const walletRef = adminDb.collection('wallets').doc(userIdResolved);
        const walletSnap = await walletRef.get();
        const nowIso = new Date().toISOString();

        const deltaCredits = productIdResolved === 'analysis_1' ? 1 : productIdResolved === 'pack_3' ? 3 : productIdResolved === 'pack_10' ? 10 : 0;
        const historyPlus = productIdResolved === 'history_plus_annual';

        if (!walletSnap.exists) {
          await walletRef.set({
            userId: userIdResolved,
            credits: deltaCredits,
            freeAnalysesUsed: 0,
            yearInUse: new Date().getFullYear(),
            historyPlusActive: historyPlus,
            historyPlusValidUntil: historyPlus ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() : null,
            currency: 'ARS',
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        } else {
          const data = walletSnap.data() || {};
          const currentCredits = Number(data.credits || 0);
          const updates: any = { credits: currentCredits + deltaCredits, updatedAt: nowIso };
          if (historyPlus) {
            updates.historyPlusActive = true;
            const base = data.historyPlusValidUntil ? new Date(data.historyPlusValidUntil) : new Date();
            base.setFullYear(base.getFullYear() + 1);
            updates.historyPlusValidUntil = base.toISOString();
          }
          await walletRef.update(updates);
        }
      }
    }
  } catch (err) {
    console.error('Webhook MP error:', err);
  }
  return { ok: true };
}

export function getProductPriceARS(productId: CreatePreferenceInput['productId']): number {
  switch (productId) {
    case 'analysis_1':
      return 5000;
    case 'pack_3':
      return 13500;
    case 'pack_10':
      return 40000;
    case 'history_plus_annual':
      return 12000;
    default:
      return 5000;
  }
}


