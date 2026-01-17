import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { fetchDlocalPayment, handleWebhook } from '@/lib/dlocal';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const { paymentId } = body || {};

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId es requerido' }, { status: 400 });
    }

    console.log('🔍 [Check dLocal Payment] Verificando pago por paymentId:', paymentId);
    const payment = await fetchDlocalPayment(paymentId);

    console.log('📥 [Check dLocal Payment] Pago obtenido:', {
      id: payment.id || payment.order_id,
      status: payment.status,
      metadata: payment.metadata,
    });

    // Reprocesar usando la lógica del webhook para normalizar adjudicación
    await handleWebhook({ order_id: paymentId });

    return NextResponse.json({
      success: true,
      status: payment.status,
      paymentId: payment.id || payment.order_id,
      metadata: payment.metadata || null,
    });
  } catch (error: any) {
    console.error('❌ [Check dLocal Payment] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al verificar el pago' },
      { status: 500 }
    );
  }
}

