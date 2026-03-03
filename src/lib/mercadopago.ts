import { adminDb } from '@/lib/firebase-admin';
import { sendCustomEmail } from '@/lib/email-service';

// Leer env en runtime para evitar cache (igual que dLocal)
function getMpBase(): string {
  return (process.env.MP_BASE_URL || 'https://api.mercadopago.com').trim();
}
function getMpAccessToken(): string {
  return (process.env.MP_ACCESS_TOKEN_AR || '').trim();
}
function getMpNotificationUrl(): string {
  return (process.env.MP_WEBHOOK_URL || '').trim();
}
function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || '').trim();
}
function isProductionToken(token: string): boolean {
  return token.startsWith('APP_USR-');
}

type PreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: 'ARS';
};

type CreatePreferenceInput = {
  userId?: string;
  productId: 'analysis_1' | 'pack_3' | 'pack_10' | 'history_plus_annual' | 'coach_review';
  amountARS: number;
  title: string;
  userEmail?: string;
  metadata?: Record<string, any>;
  marketplaceFeeARS?: number;
  sponsorId?: number | string;
  collectorAccessToken?: string;
  returnBase?: string;
};

export async function createPreference(input: CreatePreferenceInput) {
  const resolvedAccessToken = input.collectorAccessToken || getMpAccessToken();
  if (!resolvedAccessToken) throw new Error('MP_ACCESS_TOKEN_AR no configurado');

  // Con token de PRODUCCIÓN (APP_USR-), MP exige HTTPS y dominio real. Nunca localhost.
  const isProd = isProductionToken(resolvedAccessToken);
  const appUrlHttps = getAppUrl() || 'https://chaaaas.com';

  const computeReturnBase = (): string => {
    if (isProd) {
      return appUrlHttps;
    }
    if (input.returnBase) {
      const u = input.returnBase;
      if (u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1')) {
        return appUrlHttps;
      }
      return u;
    }
    const explicit = process.env.MP_RETURN_URL;
    if (explicit) return explicit;
    if (appUrlHttps) return appUrlHttps;
    const webhookUrl = getMpNotificationUrl();
    if (webhookUrl) {
      try {
        return new URL(webhookUrl).origin;
      } catch {}
    }
    return appUrlHttps;
  };

  const returnBase = computeReturnBase();
  const resolveReturnUrl = (base: string): string => {
    try {
      const u = new URL(base);
      return `${u.origin}/player/payments/return`;
    } catch {
      const trimmed = base.replace(/\/$/, '');
      if (trimmed.endsWith('/payments/return') || trimmed.endsWith('/player/payments/return')) return trimmed;
      if (trimmed.includes('/player/')) return `${trimmed}/payments/return`;
      return `${trimmed}/player/payments/return`;
    }
  };

  const baseReturnUrl = resolveReturnUrl(returnBase);
  const returnUrl = (() => {
    try {
      const url = new URL(baseReturnUrl);
      if (input.productId) url.searchParams.set('productId', input.productId);
      if (input.metadata?.coachId) url.searchParams.set('coachId', input.metadata.coachId);
      if (input.metadata?.analysisId) url.searchParams.set('analysisId', input.metadata.analysisId);
      url.searchParams.set('provider', 'mercadopago');
      return url.toString();
    } catch {
      return baseReturnUrl;
    }
  })();

  const backUrls = {
    success: returnUrl,
    failure: returnUrl,
    pending: returnUrl,
  };

  const notificationUrl = getMpNotificationUrl() || `${appUrlHttps.replace(/\/$/, '')}/api/payments/webhook`;
  if (!notificationUrl.startsWith('https://')) {
    throw new Error('notification_url debe ser HTTPS para MercadoPago. Configura MP_WEBHOOK_URL con https://chaaaas.com/api/payments/webhook');
  }

  const payerEmail = (input.userEmail || '').trim();
  const invalidEmails = ['', 'test@test.com', 'test@test'];
  if (!payerEmail || invalidEmails.includes(payerEmail.toLowerCase()) || !payerEmail.includes('@')) {
    throw new Error(`MercadoPago requiere un email válido del pagador. Recibido: ${payerEmail ? '(email inválido)' : '(vacío)'}`);
  }

  const body: Record<string, any> = {
    items: [
      {
        title: input.title,
        quantity: 1,
        unit_price: input.amountARS,
        currency_id: 'ARS',
      } as PreferenceItem,
    ],
    metadata: {
      ...(input.metadata || {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.userEmail ? { userEmail: input.userEmail } : {}),
      productId: input.productId,
    },
    payer: {
      email: payerEmail,
    },
    notification_url: notificationUrl,
    back_urls: backUrls,
    auto_return: 'approved',
    ...(typeof input.marketplaceFeeARS === 'number' ? { marketplace_fee: Math.max(0, input.marketplaceFeeARS) } : {}),
    ...(typeof input.sponsorId !== 'undefined' && input.sponsorId !== null
      ? { sponsor_id: Number(input.sponsorId) }
      : {}),
  };

  console.log('🔍 [MP] Objeto de preferencia completo:', JSON.stringify(body, null, 2));
  console.log('🔍 [MP] Config:', {
    returnUrl,
    notificationUrl,
    payerEmail: payerEmail ? `${payerEmail.substring(0, 3)}***` : '(vacío)',
    isProductionToken: isProd,
  });

  const res = await fetch(`${getMpBase()}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolvedAccessToken}`,
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
    const base: any = {
      provider: 'mercadopago',
      providerPaymentId: pref.id,
      productId: input.productId,
      amount: input.amountARS,
      currency: 'ARS',
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(typeof input.marketplaceFeeARS === 'number' ? { platformFeeAmount: input.marketplaceFeeARS } : {}),
      ...(typeof input.sponsorId !== 'undefined' ? { sponsorId: input.sponsorId } : {}),
    };
    if (input.userId) base.userId = input.userId;
    if (input.metadata?.coachId) base.coachId = input.metadata.coachId;
    if (input.metadata?.analysisId) base.analysisId = input.metadata.analysisId;
    await adminDb.collection('payments').doc(pref.id).set(base);
  }

  return pref;
}

export async function handleWebhook(event: any) {
  // Mercado Pago envía distintos tipos; nos interesa payment approved
  try {
    console.log('🔔 [MP Webhook] Evento recibido:', JSON.stringify(event, null, 2));
    const type = event.type || event.action;
    console.log('🔔 [MP Webhook] Tipo de evento:', type);
    if (type === 'payment.created' || type === 'payment.updated') {
      const data = event.data || event.data_id ? { id: event.data?.id || event.data_id } : null;
      if (!data?.id) {
        console.log('⚠️ [MP Webhook] No hay payment ID en el evento');
        return { ok: true };
      }

      console.log('🔍 [MP Webhook] Obteniendo pago de MP:', data.id);
      const paymentRes = await fetch(`${getMpBase()}/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${getMpAccessToken()}` },
      });
      const payment = await paymentRes.json();
      console.log('📥 [MP Webhook] Pago obtenido:', {
        id: payment.id,
        status: payment.status,
        metadata: payment.metadata,
      });

      const status = payment.status as string;
      const prefId = payment?.metadata?.payment_preference_id || payment.order?.id || payment.external_reference || payment.metadata?.preference_id || payment.metadata?.preferenceId;
      let userId = payment?.metadata?.userId as string | undefined;
      const productId = payment?.metadata?.productId as CreatePreferenceInput['productId'];
      const analysisIdMeta = payment?.metadata?.analysisId as string | undefined;
      const coachIdMeta = payment?.metadata?.coachId as string | undefined;
      const unlockIdMeta = payment?.metadata?.unlockId as string | undefined;
      const playerIdMeta = (payment?.metadata?.playerId || payment?.metadata?.userId || userId) as string | undefined;
      const emailCandidate = (payment?.metadata?.userEmail || payment?.payer?.email || payment?.additional_info?.payer?.email) as string | undefined;
      
      console.log('🔍 [MP Webhook] Metadatos extraídos:', {
        productId,
        analysisIdMeta,
        coachIdMeta,
        unlockIdMeta,
        playerIdMeta,
        userId,
      });

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
        console.log('✅ [MP Webhook] Pago aprobado, procesando...');
        const productIdResolved = (payment.metadata?.productId || 'analysis_1') as CreatePreferenceInput['productId'];
        const userIdResolved = (payment.metadata?.userId || userId) as string;
        console.log('🔍 [MP Webhook] Procesando producto:', productIdResolved);
        if (productIdResolved === 'coach_review') {
          console.log('💰 [MP Webhook] Procesando pago de coach_review:', {
            analysisId: analysisIdMeta,
            coachId: coachIdMeta,
            unlockId: unlockIdMeta,
            playerId: playerIdMeta || userIdResolved,
          });
          await processCoachReviewPayment({
            payment,
            analysisId: analysisIdMeta,
            coachId: coachIdMeta,
            unlockId: unlockIdMeta,
            playerId: playerIdMeta || userIdResolved,
          });
          console.log('✅ [MP Webhook] Pago de coach_review procesado exitosamente');
        } else {
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
    case 'coach_review':
      return 0;
    default:
      return 5000;
  }
}

export async function processCoachReviewPayment(params: {
  payment: any;
  analysisId?: string;
  coachId?: string;
  unlockId?: string;
  playerId?: string;
}) {
  if (!adminDb) return;
  const { payment, analysisId, coachId, unlockId, playerId } = params;
  const nowIso = new Date().toISOString();

  try {
    if (unlockId) {
      await adminDb.collection('coach_unlocks').doc(unlockId).set(
        {
          status: 'paid',
          paymentId: payment.id,
          paidAt: nowIso,
          updatedAt: nowIso,
          paymentRaw: payment,
        },
        { merge: true }
      );
    }

    if (analysisId && coachId) {
      await adminDb
        .collection('analyses')
        .doc(analysisId)
        .set(
          {
            coachAccess: {
              [coachId]: {
                status: 'paid',
                unlockedAt: nowIso,
                paymentId: payment.id,
                unlockId: unlockId || null,
              },
            },
          },
          { merge: true }
        );
    }

    const coachSnap = coachId ? await adminDb.collection('coaches').doc(coachId).get() : null;
    const playerSnap = playerId ? await adminDb.collection('players').doc(playerId).get() : null;
    const coachData = coachSnap?.data() || null;
    const playerData = playerSnap?.data() || null;

    if (coachId) {
      await adminDb.collection('messages').add({
        fromId: 'system',
        fromName: 'Chaaaas.com',
        toId: coachId,
        toCoachDocId: coachId, // Campo adicional para que aparezca en la notificación del coach
        toName: coachData?.name || coachId,
        text: `El jugador ${playerData?.name || playerId || ''} ya abonó la revisión manual del análisis ${analysisId || ''}. Podés ingresar y dejar tu devolución.`,
        analysisId: analysisId || null, // Guardar el ID del análisis para acceso directo
        createdAt: nowIso,
        read: false,
      });
    }

    // Otorgar 2 análisis gratis adicionales con IA al jugador
    if (playerId) {
      const walletRef = adminDb.collection('wallets').doc(playerId);
      const walletSnap = await walletRef.get();
      const bonusCredits = 2;

      if (!walletSnap.exists) {
        await walletRef.set({
          userId: playerId,
          credits: bonusCredits,
          freeAnalysesUsed: 0,
          yearInUse: new Date().getFullYear(),
          historyPlusActive: false,
          historyPlusValidUntil: null,
          currency: 'ARS',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else {
        const data = walletSnap.data() || {};
        const currentCredits = Number(data.credits || 0);
        await walletRef.update({
          credits: currentCredits + bonusCredits,
          updatedAt: nowIso,
        });
      }

      await adminDb.collection('messages').add({
        fromId: 'system',
        fromName: 'Chaaaas.com',
        toId: playerId,
        toName: playerData?.name || playerId,
        text: `Tu pago ya fue abonado correctamente. Estamos esperando la devolución o análisis del entrenador. ¡Además te regalamos 2 análisis gratis adicionales con IA!`,
        analysisId: analysisId || null, // Guardar el ID del análisis para acceso directo
        createdAt: nowIso,
        read: false,
      });
    }

    if (coachData?.email) {
      await sendCustomEmail({
        to: coachData.email,
        subject: 'Nuevo análisis pagado para revisión',
        html: `<p>Hola ${coachData.name || ''},</p>
        <p>El jugador ${playerData?.name || playerId || ''} abonó la revisión manual de su análisis ${analysisId || ''}.</p>
        <p>Ingresá a tu panel para revisar los videos y dejar la devolución.</p>
        <p>Equipo Shot Analysis</p>`,
      });
    }
  } catch (error) {
    console.error('Error procesando coach_review payment', error);
  }
}

