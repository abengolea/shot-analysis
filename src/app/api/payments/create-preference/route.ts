import { NextRequest, NextResponse } from 'next/server';
import { createPreference, getProductPriceARS } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, productId } = body || {};
    if (!userId || !productId) {
      return NextResponse.json({ error: 'userId y productId requeridos' }, { status: 400 });
    }
    const amount = getProductPriceARS(productId);
    const title = productId === 'analysis_1' ? 'Análisis IA de tiro' :
      productId === 'pack_3' ? 'Pack 3 análisis' :
      productId === 'pack_10' ? 'Pack 10 análisis' :
      'History+ anual';

    const pref = await createPreference({ userId, productId, amountARS: amount, title });
    return NextResponse.json({ init_point: pref.init_point, id: pref.id, sandbox_init_point: pref.sandbox_init_point });
  } catch (err: any) {
    console.error('Error create-preference:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}

