import { NextRequest, NextResponse } from 'next/server';
import { createPayment, getProductPriceARS, convertARSToUSD, testConnection } from '@/lib/dlocal';

// Endpoint GET para probar que el servidor responde y verificar conexión con dLocal
export async function GET() {
  try {
    // Probar conexión con dLocal Go
    const connectionTest = await testConnection();
    return NextResponse.json({
      ok: true,
      message: 'Endpoint dLocal Go está funcionando',
      dlocalConnection: '✅ Conectado',
      dlocalResponse: connectionTest,
      endpoint: '/api/payments/create-dlocal',
      method: 'POST',
      requiredFields: ['userId', 'productId'],
      optionalFields: ['currency'],
      example: {
        userId: 'test-user-123',
        productId: 'analysis_1',
        currency: 'ARS'
      }
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: true,
      message: 'Endpoint dLocal Go está funcionando',
      dlocalConnection: '❌ Error de conexión',
      dlocalError: err.message,
      endpoint: '/api/payments/create-dlocal',
      method: 'POST',
      requiredFields: ['userId', 'productId'],
      optionalFields: ['currency'],
      example: {
        userId: 'test-user-123',
        productId: 'analysis_1',
        currency: 'ARS'
      }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, productId, currency = 'ARS', amount, title, userEmail, metadata } = body || {};
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'userId requerido',
        received: { userId: !!userId }
      }, { status: 400 });
    }

    // Verificar variables de entorno (rechazar placeholders)
    const apiKey = (process.env.DLOCAL_API_KEY || '').trim();
    const secretKey = (process.env.DLOCAL_SECRET_KEY || '').trim();
    const isPlaceholder = (v: string) => !v || v.includes('tu_api_key') || v.includes('tu_secret') || v.includes('CONFIGURAR');
    
    if (isPlaceholder(apiKey) || isPlaceholder(secretKey)) {
      return NextResponse.json({ 
        error: 'DLOCAL_API_KEY o DLOCAL_SECRET_KEY no configurados o tienen valores placeholder',
        hint: 'Revisa .env.local con credenciales reales de dLocal y reinicia el servidor (npm run dev)'
      }, { status: 500 });
    }

    // Si se proporciona amount, usarlo; si no, calcular desde productId
    let finalAmount: number;
    let finalTitle: string;
    
    if (typeof amount === 'number' && amount > 0) {
      // Monto personalizado (para coach_review u otros casos)
      finalAmount = amount;
      finalTitle = title || 'Pago personalizado';
    } else if (productId) {
      // Monto estándar basado en productId
      const amountARS = getProductPriceARS(productId);
      finalAmount = currency === 'USD' ? convertARSToUSD(amountARS) : amountARS;
      finalTitle = title || (
        productId === 'analysis_1' ? 'Análisis IA de tiro' :
        productId === 'pack_3' ? 'Pack 3 análisis' :
        productId === 'pack_10' ? 'Pack 10 análisis' :
        productId === 'history_plus_annual' ? 'History+ anual' :
        'Producto'
      );
    } else {
      return NextResponse.json({ 
        error: 'productId o amount requerido',
        received: { productId: !!productId, amount: typeof amount }
      }, { status: 400 });
    }

    console.log('📤 Creando pago dLocal:', { userId, productId, amount: finalAmount, currency, title: finalTitle });

    const payment = await createPayment({
      userId,
      productId: productId || 'coach_review',
      amount: finalAmount,
      currency,
      title: finalTitle,
      userEmail,
      metadata,
    });

    console.log('✅ Pago creado:', payment);

    // dLocal Go devuelve redirect_url (no checkout_url)
    // Normalizamos la respuesta para mantener compatibilidad
    return NextResponse.json({
      id: payment.id || payment.order_id,
      checkout_url: payment.redirect_url || payment.checkout_url || payment.payment_url || payment.url,
      redirect_url: payment.redirect_url,
      status: payment.status || payment.raw?.status,
      raw: payment, // Para debugging
    });
  } catch (err: any) {
    console.error('❌ Error create-dlocal:', err);
    return NextResponse.json({ 
      error: err?.message || 'Error interno',
      details: err?.stack,
      hint: 'Revisa la consola del servidor para más detalles'
    }, { status: 500 });
  }
}

