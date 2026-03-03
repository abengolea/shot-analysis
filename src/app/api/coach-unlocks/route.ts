import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { createPreference } from '@/lib/mercadopago';
import { createPayment } from '@/lib/dlocal';
import { getCoachPaymentAccount, resolvePlatformFeePercent } from '@/lib/coach-payments';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const playerId = decoded.uid;

    const body = await req.json();
    console.log('📥 Body recibido en /api/coach-unlocks:', JSON.stringify(body, null, 2));
    const analysisId = typeof body?.analysisId === 'string' ? body.analysisId.trim() : '';
    const coachId = typeof body?.coachId === 'string' ? body.coachId.trim() : '';
    const paymentProvider = body?.paymentProvider || 'mercadopago'; // 'mercadopago' o 'dlocal'
    console.log('🔍 paymentProvider recibido:', paymentProvider);

    if (!analysisId || !coachId) {
      return NextResponse.json({ error: 'analysisId y coachId son requeridos.' }, { status: 400 });
    }
    
    if (paymentProvider !== 'mercadopago' && paymentProvider !== 'dlocal') {
      return NextResponse.json({ error: 'paymentProvider debe ser "mercadopago" o "dlocal".' }, { status: 400 });
    }

    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado.' }, { status: 404 });
    }
    const analysisData = analysisSnap.data() as any;
    if (String(analysisData.playerId) !== String(playerId)) {
      return NextResponse.json({ error: 'No podés solicitar revisión para este análisis.' }, { status: 403 });
    }

    const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
    if (!coachSnap.exists) {
      return NextResponse.json({ error: 'Entrenador no encontrado.' }, { status: 404 });
    }
    const coachData = coachSnap.data() as any;
    const parseCoachRate = (raw: unknown): number => {
      if (typeof raw === 'number') return raw;
      if (typeof raw !== 'string') return Number(raw);
      const trimmed = raw.trim();
      if (!trimmed) return NaN;
      const cleaned = trimmed.replace(/[^\d.,\s]/g, '');
      const noSpaces = cleaned.replace(/\s+/g, '');
      if (noSpaces.includes(',') && noSpaces.includes('.')) {
        // Asumir formato 1.234,56 -> quitar miles y convertir coma decimal
        const normalized = noSpaces.replace(/\./g, '').replace(',', '.');
        return Number(normalized);
      }
      if (noSpaces.includes(',') && !noSpaces.includes('.')) {
        // Asumir miles si termina en ,000; si no, usar coma como decimal
        if (/,\\d{3}$/.test(noSpaces)) {
          return Number(noSpaces.replace(/,/g, ''));
        }
        return Number(noSpaces.replace(',', '.'));
      }
      if (noSpaces.includes('.') && !noSpaces.includes(',')) {
        // Asumir miles si termina en .000
        if (/\\.\\d{3}$/.test(noSpaces)) {
          return Number(noSpaces.replace(/\\./g, ''));
        }
      }
      return Number(noSpaces);
    };
    const paymentAccountOwnerId = typeof coachData?.paymentAccountOwnerId === 'string' && coachData.paymentAccountOwnerId.trim()
      ? coachData.paymentAccountOwnerId.trim()
      : coachId;
    const rawCoachRate = coachData?.ratePerAnalysis;
    const coachRate = parseCoachRate(rawCoachRate);
    console.log('💰 Coach rate debug:', {
      coachId,
      coachName: coachData?.name || '',
      rawRate: rawCoachRate,
      rawRateType: typeof rawCoachRate,
      parsedRate: coachRate,
    });
    if (!Number.isFinite(coachRate) || coachRate <= 0) {
      return NextResponse.json(
        {
          error: 'El entrenador no tiene una tarifa configurada.',
          details: process.env.NODE_ENV === 'development'
            ? { coachId, rawRate: rawCoachRate, parsedRate: coachRate }
            : undefined,
        },
        { status: 400 }
      );
    }

    const unlockId = `${analysisId}__${coachId}`;
    
    // Verificar si ya existe un unlock pagado para este análisis y entrenador
    const existingUnlockSnap = await adminDb.collection('coach_unlocks').doc(unlockId).get();
    if (existingUnlockSnap.exists) {
      const existingUnlock = existingUnlockSnap.data() as any;
      
      // Si ya está pagado, rechazar
      if (existingUnlock.status === 'paid') {
        console.log('❌ Unlock ya pagado:', unlockId);
        return NextResponse.json({ 
          error: `Ya pagaste para que ${coachData?.name || 'este entrenador'} analice tu lanzamiento. El entrenador ya tiene acceso al análisis.`,
          code: 'ALREADY_PAID',
        }, { status: 409 }); // 409 Conflict
      }
      
      // Si está pendiente PERO tiene un paymentId, significa que ya se inició un pago
      // Verificar si el pago está realmente pendiente o si ya fue procesado
      if (existingUnlock.status === 'pending' && existingUnlock.paymentId) {
        console.log('⚠️ Unlock pendiente con paymentId:', unlockId, 'paymentId:', existingUnlock.paymentId);
        
        // Verificar en la colección de payments si el pago ya fue aprobado
        const paymentSnap = await adminDb.collection('payments').doc(existingUnlock.paymentId).get();
        if (paymentSnap.exists) {
          const paymentData = paymentSnap.data() as any;
        if (paymentData.status === 'approved' || paymentData.status === 'paid') {
            console.log('❌ Pago ya aprobado, rechazando duplicado');
            return NextResponse.json({ 
            error: `Ya pagaste para que ${coachData?.name || 'este entrenador'} analice tu lanzamiento. El entrenador ya tiene acceso al análisis.`,
            code: 'ALREADY_PAID',
            }, { status: 409 });
          }
        }
        
        // Si el unlock tiene paymentId pero el pago no existe o está pendiente,
        // permitir continuar solo si han pasado más de 5 minutos (pago probablemente falló)
        const unlockCreatedAt = existingUnlock.createdAt ? new Date(existingUnlock.createdAt).getTime() : 0;
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        
        if (unlockCreatedAt > fiveMinutesAgo) {
          console.log('⚠️ Unlock pendiente reciente, rechazando duplicado');
          return NextResponse.json({ 
            error: `Ya tienes un pago pendiente para que ${coachData?.name || 'este entrenador'} analice tu lanzamiento. Espera a que se complete o cancela el pago anterior.`,
            code: 'PAYMENT_PENDING',
          }, { status: 409 });
        }
      }
    }
    
    // También verificar en el análisis si ya tiene acceso pagado
    const coachAccess = (analysisData.coachAccess || {})[coachId];
    if (coachAccess && coachAccess.status === 'paid') {
      console.log('❌ Acceso ya pagado en análisis:', analysisId, 'coach:', coachId);
      return NextResponse.json({ 
        error: `Ya pagaste para que ${coachData?.name || 'este entrenador'} analice tu lanzamiento. El entrenador ya tiene acceso al análisis.`,
        code: 'ALREADY_PAID',
      }, { status: 409 });
    }
    
    const paymentAccount = await getCoachPaymentAccount(paymentAccountOwnerId);
    const platformFeePercent = resolvePlatformFeePercent(paymentAccount, 30);
    const platformFee = Math.max(1, Math.round(coachRate * (platformFeePercent / 100)));
    const totalAmount = coachRate + platformFee;
    const nowIso = new Date().toISOString();

    console.log('🔍 Entrando en la lógica de creación de pago');
    console.log('🔍 paymentProvider === "dlocal":', paymentProvider === 'dlocal');
    console.log('🔍 paymentProvider === "mercadopago":', paymentProvider === 'mercadopago');
    
    let paymentResult: any;
    let paymentProviderData: any = {};

    if (paymentProvider === 'dlocal') {
      console.log('✅ Usando dLocal Go para crear el pago');
      console.log('📋 Parámetros para dLocal:', {
        userId: playerId,
        userEmail: decoded.email,
        productId: 'coach_review',
        amount: totalAmount,
        currency: 'ARS',
        title: `Revisión manual - ${coachData?.name || 'Entrenador'}`,
      });
      try {
        // Crear pago con dLocal Go
        const dlocalPayment = await createPayment({
          userId: playerId,
          userEmail: decoded.email,
          productId: 'coach_review',
          amount: totalAmount,
          currency: 'ARS',
          title: `Revisión manual - ${coachData?.name || 'Entrenador'}`,
          metadata: {
            analysisId,
            coachId,
            unlockId,
            playerId,
            coachName: coachData?.name || '',
            playerName: analysisData?.playerName || '',
          },
        });

        paymentResult = dlocalPayment;
        console.log('📋 Respuesta completa de dLocal:', JSON.stringify(dlocalPayment, null, 2));
      
        // dLocal puede devolver redirect_url en diferentes lugares
        // Según la respuesta que vimos antes, viene en redirect_url directamente
        const redirectUrl = dlocalPayment.redirect_url || 
                           dlocalPayment.checkout_url || 
                           dlocalPayment.payment_url || 
                           dlocalPayment.url ||
                           (dlocalPayment.raw && (dlocalPayment.raw.redirect_url || dlocalPayment.raw.checkout_url));
        
        console.log('🔗 URL de redirección encontrada:', redirectUrl);
        console.log('🔍 Estructura del objeto dlocalPayment:', {
          hasRedirectUrl: !!dlocalPayment.redirect_url,
          hasCheckoutUrl: !!dlocalPayment.checkout_url,
          hasRaw: !!dlocalPayment.raw,
          rawRedirectUrl: dlocalPayment.raw?.redirect_url,
          keys: Object.keys(dlocalPayment),
        });
        
        if (!redirectUrl) {
          console.error('❌ No se encontró URL de redirección en la respuesta de dLocal');
          throw new Error('No se pudo obtener la URL de pago de dLocal Go');
        }
        
        paymentProviderData = {
          paymentProvider: 'dlocal',
          paymentId: dlocalPayment.id || dlocalPayment.order_id || dlocalPayment.raw?.id,
          checkoutUrl: redirectUrl,
          redirectUrl: redirectUrl,
        };
      } catch (dlocalError: any) {
        console.error('❌ Error creando pago con dLocal:', dlocalError);
        console.error('❌ Error message:', dlocalError?.message);
        console.error('❌ Error stack:', dlocalError?.stack);
        
        // Si el error es sobre monto mínimo, mostrar mensaje más claro
        if (dlocalError?.message?.includes('monto mínimo') || dlocalError?.message?.includes('Amount to low') || dlocalError?.message?.includes('too low')) {
          return NextResponse.json({ 
            error: `El monto mínimo para pagos con tarjeta de crédito/débito es mayor a $${totalAmount} ARS. Por favor, contacta al soporte o usa MercadoPago para este monto.`,
            code: 'AMOUNT_TOO_LOW',
            amount: totalAmount,
          }, { status: 400 });
        }
        
        throw new Error(`Error creando pago con dLocal Go: ${dlocalError?.message || 'Error desconocido'}`);
      }
    } else {
      console.log('✅ Usando MercadoPago para crear el pago');
      // MercadoPago requiere email válido del pagador (nunca vacío ni test@test)
      let payerEmail = (decoded.email || '').trim();
      if (!payerEmail || !payerEmail.includes('@')) {
        const playerDoc = await adminDb.collection('players').doc(playerId).get();
        payerEmail = (playerDoc.data() as any)?.email || '';
      }
      if (!payerEmail || !payerEmail.includes('@')) {
        return NextResponse.json({
          error: 'Se requiere un email válido para pagar con MercadoPago. Verificá tu perfil.',
        }, { status: 400 });
      }
      const pref = await createPreference({
        userId: playerId,
        userEmail: payerEmail,
        productId: 'coach_review',
        amountARS: totalAmount,
        title: `Revisión manual - ${coachData?.name || 'Entrenador'}`,
        ...(paymentAccount?.mpAccessToken
          ? {
              collectorAccessToken: paymentAccount.mpAccessToken,
              marketplaceFeeARS: platformFee,
              sponsorId: paymentAccount.mpUserId,
            }
          : {}),
        returnBase: req.nextUrl.origin,
        metadata: {
          analysisId,
          coachId,
          paymentAccountOwnerId,
          unlockId,
          playerId,
          coachName: coachData?.name || '',
          playerName: analysisData?.playerName || '',
        },
      });

      paymentResult = pref;
      paymentProviderData = {
        paymentProvider: 'mercadopago',
        preferenceId: pref?.id,
        initPoint: pref?.init_point,
        sandboxInitPoint: pref?.sandbox_init_point,
      };
    }

    const unlockRef = adminDb.collection('coach_unlocks').doc(unlockId);
    await unlockRef.set(
      {
        analysisId,
        coachId,
        playerId,
        status: 'pending',
        coachRate,
        platformFee,
        totalAmount,
        currency: 'ARS',
        ...paymentProviderData,
        coachName: coachData?.name || '',
        playerName: analysisData?.playerName || '',
        paymentAccountOwnerId,
        platformFeePercent,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    const response = {
      ok: true,
      unlockId,
      amount: totalAmount,
      currency: 'ARS',
      coachRate,
      platformFee,
      platformFeePercent,
      paymentProvider,
      ...paymentProviderData,
    };
    
    console.log('📤 Respuesta de coach-unlocks:', JSON.stringify(response, null, 2));
    console.log('🔗 URL de redirección disponible:', response.checkoutUrl || response.redirectUrl || response.initPoint || response.sandboxInitPoint);
    
    return NextResponse.json(response);
  } catch (e: any) {
    console.error('❌ coach-unlocks POST error:', e);
    console.error('❌ Error stack:', e?.stack);
    console.error('❌ Error message:', e?.message);
    console.error('❌ Error name:', e?.name);
    const errorMessage = e?.message || 'Error interno';
    return NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
    }, { status: 500 });
  }
}

