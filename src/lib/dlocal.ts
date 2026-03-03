import { adminDb } from '@/lib/firebase-admin';
import { sendCustomEmail } from '@/lib/email-service';

// dLocal Go usa diferentes URLs para testing y producción
// NOTA: Las credenciales proporcionadas funcionan con PRODUCCIÓN
// Si necesitas sandbox, obtén credenciales de sandbox desde el dashboard
// Usar getters para leer env en runtime y evitar cache de módulo en Next.js
function getDlocalBase(): string {
  return (process.env.DLOCAL_BASE_URL || 'https://api.dlocalgo.com').trim();
}
const PLACEHOLDER_PATTERNS = ['tu_api_key', 'tu_secret_key', 'CONFIGURAR', 'tu_api_key_aqui', 'tu_secret_key_aqui'];
function isPlaceholderValue(v: string): boolean {
  const lower = v.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}
function getDlocalApiKey(): string {
  const v = (process.env.DLOCAL_API_KEY || '').trim();
  if (v && isPlaceholderValue(v)) {
    console.error('[dLocal] DLOCAL_API_KEY parece un placeholder. Revisa .env.local y reinicia el servidor (npm run dev).');
  }
  return v;
}
function getDlocalSecretKey(): string {
  const v = (process.env.DLOCAL_SECRET_KEY || '').trim();
  if (v && isPlaceholderValue(v)) {
    console.error('[dLocal] DLOCAL_SECRET_KEY parece un placeholder. Revisa .env.local y reinicia el servidor (npm run dev).');
  }
  return v;
}
function getDlocalNotificationUrl(): string {
  return (process.env.DLOCAL_WEBHOOK_URL || '').trim();
}

type CreatePaymentInput = {
  userId?: string;
  productId: 'analysis_1' | 'pack_3' | 'pack_10' | 'history_plus_annual' | 'coach_review';
  amount: number; // Monto en la moneda especificada
  currency: 'ARS' | 'USD';
  title: string;
  userEmail?: string;
  userFullName?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
};

/**
 * Genera el token de autenticación para dLocal Go
 * Formato confirmado: Bearer API_KEY:SECRET_KEY
 */
function getAuthToken(): string {
  const apiKey = getDlocalApiKey();
  const secretKey = getDlocalSecretKey();
  if (!apiKey || !secretKey) {
    throw new Error('DLOCAL_API_KEY y DLOCAL_SECRET_KEY deben estar configurados en .env.local');
  }
  // Formato confirmado que funciona: Bearer API_KEY:SECRET_KEY
  return `Bearer ${apiKey}:${secretKey}`;
}

/**
 * Verifica la conexión con dLocal Go
 */
export async function testConnection() {
  try {
    // Verificar que las variables estén cargadas
    const hasApiKey = !!getDlocalApiKey();
    const hasSecretKey = !!getDlocalSecretKey();
    
    console.log('🔍 Verificando credenciales:', {
      hasApiKey,
      hasSecretKey,
      baseUrl: getDlocalBase(),
    });
    
    if (!hasApiKey || !hasSecretKey) {
      throw new Error('DLOCAL_API_KEY o DLOCAL_SECRET_KEY no están configurados');
    }
    
    const authToken = getAuthToken();
    console.log('🔑 Token de autenticación generado (longitud:', authToken.length, ')');
    console.log('🌐 URL de prueba:', `${getDlocalBase()}/v1/me`);
    
    const res = await fetch(`${getDlocalBase()}/v1/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken,
      },
    });
    
    if (!res.ok) {
      const errTxt = await res.text();
      console.error('❌ Error de respuesta:', res.status, errTxt);
      throw new Error(`Error verificando conexión: ${res.status} ${errTxt}`);
    }
    
    const data = await res.json();
    console.log('✅ Conexión exitosa:', data);
    return data;
  } catch (err: any) {
    console.error('❌ Error en testConnection:', err);
    throw new Error(`Error de conexión con dLocal Go: ${err.message}`);
  }
}

/**
 * Crea un pago en dLocal Go
 */
// Monto mínimo de dLocal Go: 1 USD o su equivalente
// Para Argentina, aproximadamente 1,300 ARS (puede variar según tipo de cambio)
// NOTA: Usamos 1,500 ARS como mínimo seguro para evitar errores de redondeo
const DLOCAL_MIN_AMOUNT_ARS = 1500; // Monto mínimo en ARS (margen de seguridad)
const DLOCAL_MIN_AMOUNT_USD = 1; // Monto mínimo en USD

/**
 * Obtiene un pago desde dLocal Go por ID
 */
export async function fetchDlocalPayment(paymentId: string) {
  if (!getDlocalApiKey() || !getDlocalSecretKey()) {
    throw new Error('DLOCAL_API_KEY y DLOCAL_SECRET_KEY deben estar configurados');
  }
  const path = `/v1/orders/${paymentId}`;
  const res = await fetch(`${getDlocalBase()}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'authorization': getAuthToken(),
    },
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Error obteniendo pago de dLocal: ${res.status} ${errTxt}`);
  }
  return res.json();
}

export async function createPayment(input: CreatePaymentInput) {
  if (!getDlocalApiKey() || !getDlocalSecretKey()) {
    throw new Error('DLOCAL_API_KEY y DLOCAL_SECRET_KEY deben estar configurados');
  }

  // Validar monto mínimo
  if (input.currency === 'ARS' && input.amount < DLOCAL_MIN_AMOUNT_ARS) {
    throw new Error(`El monto mínimo para pagos con tarjeta es de $${DLOCAL_MIN_AMOUNT_ARS} ARS. El monto ingresado es de $${input.amount} ARS.`);
  }
  if (input.currency === 'USD' && input.amount < DLOCAL_MIN_AMOUNT_USD) {
    throw new Error(`El monto mínimo para pagos con tarjeta es de $${DLOCAL_MIN_AMOUNT_USD} USD. El monto ingresado es de $${input.amount} USD.`);
  }

  // Determinar URL de retorno
  const computeReturnBase = (): string | undefined => {
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
  };

  const returnBase = computeReturnBase();
  const resolveReturnUrl = (base: string): string => {
    try {
      const u = new URL(base);
      // Usar /player/payments/return para mantener consistencia con la estructura de rutas
      return `${u.origin}/player/payments/return`;
    } catch {
      const trimmed = base.replace(/\/$/, '');
      if (trimmed.endsWith('/payments/return') || trimmed.endsWith('/player/payments/return')) return trimmed;
      // Intentar con /player/payments/return primero
      if (trimmed.includes('/player/')) {
        return `${trimmed}/payments/return`;
      }
      return `${trimmed}/player/payments/return`;
    }
  };
  // Construir URL de retorno con parámetros para identificar el tipo de pago
  const baseReturnUrl = input.returnUrl || (returnBase ? resolveReturnUrl(returnBase) : undefined);
  const returnUrl = baseReturnUrl ? (() => {
    try {
      const url = new URL(baseReturnUrl);
      // Agregar parámetros para identificar el tipo de pago
      if (input.productId) url.searchParams.set('productId', input.productId);
      if (input.metadata?.coachId) url.searchParams.set('coachId', input.metadata.coachId);
      if (input.metadata?.analysisId) url.searchParams.set('analysisId', input.metadata.analysisId);
      url.searchParams.set('provider', 'dlocal');
      return url.toString();
    } catch {
      return baseReturnUrl;
    }
  })() : undefined;

  // Generar ID único para la orden
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Construir el body de la petición
  const body = {
    amount: input.amount,
    currency: input.currency,
    country: input.currency === 'ARS' ? 'AR' : 'US',
    order_id: orderId,
    description: input.title,
    notification_url: getDlocalNotificationUrl(),
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

  // Probar diferentes rutas según la documentación de dLocal Go
  // Nota: La documentación oficial puede usar diferentes endpoints
  // Intentamos varias opciones comunes
  // IMPORTANTE: /v1/payments es el endpoint correcto que funcionó anteriormente
  const possiblePaths = [
    '/v1/payments',  // ✅ Este es el endpoint correcto que funcionó
    '/v1/orders',    // Algunas APIs usan "orders"
    '/payments',     // Sin versión
    '/orders',       // Sin versión
    '/v1/checkout',  // Algunas APIs usan "checkout"
    '/checkout'      // Sin versión
  ];
  let lastError: Error | null = null;
  
  console.log('🔍 Configuración dLocal:', {
    baseUrl: getDlocalBase(),
    hasApiKey: !!getDlocalApiKey(),
    hasSecretKey: !!getDlocalSecretKey(),
    notificationUrl: getDlocalNotificationUrl(),
  });
  
  for (let i = 0; i < possiblePaths.length; i++) {
    const path = possiblePaths[i];
    try {
      const method = 'POST';
      const bodyString = JSON.stringify(body);
      const fullUrl = `${getDlocalBase()}${path}`;

      console.log(`📤 [${i + 1}/${possiblePaths.length}] Intentando crear pago en: ${fullUrl}`);
      console.log(`📋 Body enviado:`, JSON.stringify(body, null, 2));

      // Realizar la petición a dLocal Go usando autenticación Bearer
      // Probar con 'Authorization' (mayúscula) y 'authorization' (minúscula)
      const authToken = getAuthToken();
      // Log solo los primeros caracteres para no exponer credenciales
      const preview = authToken.length > 20 ? `${authToken.substring(0, 12)}...` : '(oculto)';
      console.log(`🔑 Token de autenticación: ${preview}`);
      const res = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken, // Usar mayúscula (estándar HTTP)
        },
        body: bodyString,
      });

      if (res.ok) {
        const payment = await res.json();
        console.log(`✅ Pago creado exitosamente usando: ${path}`);
        
        // Registrar intento de pago en Firestore
        if (adminDb && (payment.id || orderId)) {
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
      } else {
        const errTxt = await res.text();
        let errData: any = {};
        try {
          errData = JSON.parse(errTxt);
        } catch {}
        
        // Si es 400 con "Amount to low", lanzar error específico
        if (res.status === 400 && (errData.code === 5016 || errData.message?.toLowerCase().includes('amount') || errData.message?.toLowerCase().includes('low'))) {
          const errorMsg = errData.message || 'Monto demasiado bajo';
          throw new Error(`El monto mínimo para pagos con tarjeta es mayor a $${input.amount} ARS. Por favor, verifica el monto mínimo con dLocal Go.`);
        }
        
        lastError = new Error(`Error en ${path}: ${res.status} ${errTxt}`);
        console.log(`❌ Error en ${path}: ${res.status} ${errTxt.substring(0, 200)}`);
        // Si es 404 y no es la última ruta, probar siguiente
        if (res.status === 404 && i < possiblePaths.length - 1) {
          console.log(`⏭️ Probando siguiente ruta...`);
          continue;
        }
        // Si no es 404 o es la última ruta, lanzar error
        console.log(`❌ No hay más rutas para probar o error no es 404`);
        throw lastError;
      }
    } catch (err: any) {
      lastError = err;
      // Si no es 404, no intentar otras rutas
      if (err.message && !err.message.includes('404') && !err.message.includes('Error en')) {
        throw err;
      }
      // Continuar con siguiente ruta si es 404 y no es la última
      if (i < possiblePaths.length - 1) {
        continue;
      }
      throw err;
    }
  }
  
  // Si llegamos aquí, todas las rutas fallaron
  throw lastError || new Error('No se pudo crear el pago. Todas las rutas probadas fallaron.');
}

/**
 * Maneja los webhooks de dLocal
 */
export async function handleWebhook(event: any) {
  try {
    // dLocal envía notificaciones sobre cambios en el estado de los pagos
    const paymentId = event.id || event.payment_id || event.order_id;
    if (!paymentId) {
      return { ok: true };
    }

    // Obtener información del pago desde dLocal Go
    const path = `/v1/orders/${paymentId}`;
    const method = 'GET';

    const paymentRes = await fetch(`${getDlocalBase()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'authorization': getAuthToken(),
      },
    });

    if (!paymentRes.ok) {
      console.error('Error obteniendo pago de dLocal:', paymentRes.status);
      return { ok: true };
    }

    const payment = await paymentRes.json();

    // Mapear estados de dLocal a nuestros estados
    const statusMap: Record<string, 'created' | 'approved' | 'rejected' | 'refunded' | 'pending'> = {
      PENDING: 'pending',
      PAID: 'approved',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      CANCELLED: 'rejected',
      REFUNDED: 'refunded',
      FAILED: 'rejected',
    };

    const status = statusMap[payment.status?.toUpperCase()] || (payment.status?.toLowerCase() as any) || 'pending';

    let userId = payment.metadata?.userId as string | undefined;
    let productId = payment.metadata?.productId as CreatePaymentInput['productId'] | undefined;
    let analysisIdMeta = payment.metadata?.analysisId as string | undefined;
    let coachIdMeta = payment.metadata?.coachId as string | undefined;
    let unlockIdMeta = payment.metadata?.unlockId as string | undefined;
    let playerIdMeta = (payment.metadata?.playerId || payment.metadata?.userId || userId) as string | undefined;
    const emailCandidate = (payment.metadata?.userEmail || payment.payer?.email) as string | undefined;

    let paymentDocId: string | undefined;
    let paymentData: any | undefined;

    // Si falta metadata, intentar leer del registro existente (por id/order_id)
    if (adminDb) {
      const paymentIdCandidates = [paymentId, payment.id, payment.order_id, payment.payment_id].filter(Boolean) as string[];
      for (const candidate of paymentIdCandidates) {
        const paymentDoc = await adminDb.collection('payments').doc(candidate).get();
        if (paymentDoc.exists) {
          paymentDocId = candidate;
          paymentData = paymentDoc.data();
          break;
        }
      }
    }

    if (paymentData) {
      if (!userId && paymentData?.userId) userId = paymentData.userId;
      if (!productId && paymentData?.productId) productId = paymentData.productId;
      if (!analysisIdMeta && paymentData?.analysisId) analysisIdMeta = paymentData.analysisId;
      if (!coachIdMeta && paymentData?.coachId) coachIdMeta = paymentData.coachId;
    }

    if (!unlockIdMeta && analysisIdMeta && coachIdMeta) {
      unlockIdMeta = `${analysisIdMeta}__${coachIdMeta}`;
    }

    if (!playerIdMeta && userId) {
      playerIdMeta = userId;
    }

    // Si aún falta userId, resolverlo por email
    if (!userId && emailCandidate && adminDb) {
      try {
        const playersSnap = await adminDb.collection('players').where('email', '==', emailCandidate).limit(1).get();
        if (!playersSnap.empty) {
          userId = playersSnap.docs[0].id;
        } else {
          const coachesSnap = await adminDb.collection('coaches').where('email', '==', emailCandidate).limit(1).get();
          if (!coachesSnap.empty) {
            userId = coachesSnap.docs[0].id;
          }
        }
      } catch (e) {
        console.error('Error resolviendo userId por email en webhook dLocal:', e);
      }
    }

    const productIdResolved = (productId || 'analysis_1') as CreatePaymentInput['productId'];
    let resolvedAnalysisId = analysisIdMeta;
    let resolvedCoachId = coachIdMeta;
    let resolvedPlayerId = playerIdMeta || userId;

    // Para coach_review, priorizar datos del unlock/analysis para evitar asignaciones erróneas
    if (productIdResolved === 'coach_review' && adminDb) {
      if (unlockIdMeta) {
        const unlockSnap = await adminDb.collection('coach_unlocks').doc(unlockIdMeta).get();
        if (unlockSnap.exists) {
          const unlockData = unlockSnap.data() as any;
          resolvedAnalysisId = resolvedAnalysisId || unlockData?.analysisId;
          resolvedCoachId = resolvedCoachId || unlockData?.coachId;
          resolvedPlayerId = resolvedPlayerId || unlockData?.playerId;
        }
      }

      if (!resolvedPlayerId && resolvedAnalysisId) {
        const analysisSnap = await adminDb.collection('analyses').doc(resolvedAnalysisId).get();
        if (analysisSnap.exists) {
          const analysisData = analysisSnap.data() as any;
          resolvedPlayerId = analysisData?.playerId || resolvedPlayerId;
        }
      }
    }

    const paymentUserId = productIdResolved === 'coach_review' && resolvedPlayerId ? resolvedPlayerId : (userId || '');
    const paymentDocIdFinal = paymentDocId || paymentId;

    // Actualizar registro de pago
    if (adminDb) {
      await adminDb.collection('payments').doc(paymentDocIdFinal).set(
        {
          provider: 'dlocal',
          providerPaymentId: paymentId,
          userId: paymentUserId,
          productId: productIdResolved,
          ...(resolvedAnalysisId ? { analysisId: resolvedAnalysisId } : {}),
          ...(resolvedCoachId ? { coachId: resolvedCoachId } : {}),
          amount: payment.amount || payment.order_amount || 0,
          currency: (payment.currency || 'ARS') as 'ARS' | 'USD',
          status: status,
          raw: payment,
          updatedAt: new Date().toISOString(),
          createdAt: payment.created_date ? new Date(payment.created_date).toISOString() : new Date().toISOString(),
        },
        { merge: true }
      );
    }

    // Acreditar beneficios si approved
    if (status === 'approved' && adminDb) {
      const userIdResolved = paymentUserId as string;
      
      if (!userIdResolved) {
        console.error('No se pudo resolver userId para acreditar beneficios');
        return { ok: true };
      }

      if (productIdResolved === 'coach_review') {
        await processCoachReviewPayment({
          payment,
          analysisId: resolvedAnalysisId,
          coachId: resolvedCoachId,
          unlockId: unlockIdMeta,
          playerId: resolvedPlayerId || userIdResolved,
        });
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
  } catch (err) {
    console.error('Webhook dLocal error:', err);
  }
  return { ok: true };
}

/**
 * Obtiene el precio de un producto en ARS
 */
export function getProductPriceARS(productId: CreatePaymentInput['productId']): number {
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

/**
 * Convierte ARS a USD (puedes ajustar según tu lógica de conversión)
 */
export function convertARSToUSD(amountARS: number): number {
  // Puedes usar una API de cambio o un valor fijo
  // Por ahora usamos un valor aproximado
  const exchangeRate = Number(process.env.USD_EXCHANGE_RATE) || 1000;
  return Math.round((amountARS / exchangeRate) * 100) / 100;
}

/**
 * Procesa el pago de coach_review
 */
async function processCoachReviewPayment(params: {
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
          paymentId: payment.id || payment.order_id,
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
                paymentId: payment.id || payment.order_id,
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
        toCoachDocId: coachId,
        toName: coachData?.name || coachId,
        text: `El jugador ${playerData?.name || playerId || ''} ya abonó la revisión manual del análisis ${analysisId || ''}. Podés ingresar y dejar tu devolución.`,
        analysisId: analysisId || null,
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
        analysisId: analysisId || null,
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
    console.error('Error procesando coach_review payment dLocal', error);
  }
}

/**
 * Verifica la firma de un webhook de dLocal Go (si aplica)
 * Nota: dLocal Go puede usar diferentes métodos de verificación de webhooks
 * Consulta la documentación oficial para el método específico
 */
export function verifyWebhookSignature(body: string, signature: string | null): boolean {
  // TODO: Implementar verificación según la documentación oficial de dLocal Go
  // Por ahora retornamos true, pero deberías implementar la verificación real
  if (!signature) return true; // Si no hay firma, asumimos que es válido (ajustar según docs)
  // Implementar lógica de verificación cuando tengas la documentación específica
  return true;
}

