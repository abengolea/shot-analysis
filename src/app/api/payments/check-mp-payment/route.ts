import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { processCoachReviewPayment } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const mpToken = (process.env.MP_ACCESS_TOKEN_AR || '').trim();
    const mpBase = process.env.MP_BASE_URL || 'https://api.mercadopago.com';
    if (!mpToken) {
      return NextResponse.json(
        { error: 'MP_ACCESS_TOKEN_AR no configurado' },
        { status: 500 }
      );
    }
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    
    const body = await req.json();
    const { paymentId, preferenceId, analysisId } = body;
    
    if (!paymentId && !preferenceId) {
      return NextResponse.json({ error: 'paymentId o preferenceId es requerido' }, { status: 400 });
    }
    
    let payment: any = null;
    
    // Si tenemos paymentId, buscar directamente
    if (paymentId) {
      console.log('🔍 [Check MP Payment] Verificando pago por paymentId:', paymentId);
      const paymentRes = await fetch(`${mpBase}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      
      if (!paymentRes.ok) {
        const errTxt = await paymentRes.text().catch(() => '');
        return NextResponse.json(
          { error: 'No se pudo obtener el pago de MercadoPago', status: paymentRes.status, details: errTxt },
          { status: 404 }
        );
      }
      
      payment = await paymentRes.json();
    } else if (preferenceId) {
      // Para preferenceId: primero intentar merchant_orders (más compatible)
      console.log('🔍 [Check MP Payment] Buscando merchant_orders por preferenceId:', preferenceId);
      const moRes = await fetch(`${mpBase}/merchant_orders/search?preference_id=${preferenceId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      if (moRes.ok) {
        const moData = await moRes.json().catch(() => ({}));
        const elements = moData?.elements || moData?.results || [];
        const payments = Array.isArray(elements)
          ? elements.flatMap((el: any) => Array.isArray(el.payments) ? el.payments : [])
          : [];
        if (payments.length) {
          const approvedFromOrder = payments.find((p: any) => p.status === 'approved') || payments[0];
          if (approvedFromOrder?.id) {
            const paymentRes = await fetch(`${mpBase}/v1/payments/${approvedFromOrder.id}`, {
              headers: { Authorization: `Bearer ${mpToken}` },
            });
            if (!paymentRes.ok) {
              const errTxt = await paymentRes.text().catch(() => '');
              return NextResponse.json(
                { error: 'No se pudo obtener el pago desde merchant_orders', status: paymentRes.status, details: errTxt },
                { status: 404 }
              );
            }
            payment = await paymentRes.json();
          }
        }
      } else {
        const moErr = await moRes.text().catch(() => '');
        console.warn('⚠️ [Check MP Payment] merchant_orders/search falló:', moRes.status, moErr);
      }

      // Si merchant_orders no resolvió el pago, intentar payments/search por preference_id
      if (!payment) {
        console.log('🔁 [Check MP Payment] Fallback a payments/search por preferenceId:', preferenceId);
        const searchRes = await fetch(`${mpBase}/v1/payments/search?preference_id=${preferenceId}`, {
          headers: { Authorization: `Bearer ${mpToken}` },
        });
        if (!searchRes.ok) {
          const errTxt = await searchRes.text().catch(() => '');
          return NextResponse.json(
            { error: 'No se pudo buscar pagos de MercadoPago', status: searchRes.status, details: errTxt },
            { status: 404 }
          );
        }
        const searchData = await searchRes.json();
        const results = searchData.results || [];
        if (results.length === 0) {
          return NextResponse.json({ error: 'No se encontraron pagos para esta preferencia' }, { status: 404 });
        }
        const approvedPayment = results.find((p: any) => p.status === 'approved') || results[0];
        payment = approvedPayment;
      }
    }
    console.log('📥 [Check MP Payment] Pago obtenido:', {
      id: payment.id,
      status: payment.status,
      metadata: payment.metadata,
    });
    
    // Si el pago está aprobado, intentar procesarlo como coach_review
    if (payment.status === 'approved') {
      let productId = payment.metadata?.productId;
      let analysisIdMeta = payment.metadata?.analysisId || analysisId;
      let coachIdMeta = payment.metadata?.coachId;
      let unlockIdMeta = payment.metadata?.unlockId;
      let playerIdMeta = payment.metadata?.playerId || payment.metadata?.userId;

      // Si falta metadata, intentar resolver desde coach_unlocks usando preferenceId/paymentId
      if ((!analysisIdMeta || !coachIdMeta || productId !== 'coach_review') && adminDb) {
        const unlockSnap = preferenceId
          ? await adminDb.collection('coach_unlocks').where('preferenceId', '==', preferenceId).limit(1).get()
          : await adminDb.collection('coach_unlocks').where('paymentId', '==', payment.id).limit(1).get();
        if (!unlockSnap.empty) {
          const unlockDoc = unlockSnap.docs[0];
          const unlockData = unlockDoc.data() as any;
          analysisIdMeta = analysisIdMeta || unlockData.analysisId;
          coachIdMeta = coachIdMeta || unlockData.coachId;
          unlockIdMeta = unlockIdMeta || unlockData.unlockId || unlockDoc.id;
          playerIdMeta = playerIdMeta || unlockData.playerId;
          productId = 'coach_review';
        }
      }

      if (productId === 'coach_review' && analysisIdMeta && coachIdMeta) {
        console.log('💰 [Check MP Payment] Procesando pago de coach_review:', {
          analysisId: analysisIdMeta,
          coachId: coachIdMeta,
          unlockId: unlockIdMeta,
          playerId: playerIdMeta,
        });

        await processCoachReviewPayment({
          payment,
          analysisId: analysisIdMeta,
          coachId: coachIdMeta,
          unlockId: unlockIdMeta,
          playerId: playerIdMeta,
        });

        console.log('✅ [Check MP Payment] Pago procesado exitosamente');
        return NextResponse.json({ 
          success: true,
          message: 'Pago procesado correctamente',
          analysisId: analysisIdMeta,
          coachId: coachIdMeta,
        });
      }

      return NextResponse.json({ 
        success: false,
        message: 'Pago aprobado pero no se pudo resolver coach_review',
        status: payment.status,
        metadata: payment.metadata,
      });
    }
    
    return NextResponse.json({ 
      success: false,
      message: `El pago tiene estado: ${payment.status}`,
      status: payment.status,
    });
  } catch (error: any) {
    console.error('❌ [Check MP Payment] Error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Error al verificar el pago' 
    }, { status: 500 });
  }
}

