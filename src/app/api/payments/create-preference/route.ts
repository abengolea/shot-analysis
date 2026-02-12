import { NextRequest, NextResponse } from 'next/server';
import { createPreference, getProductPriceARS } from '@/lib/mercadopago';
import { createPreferenceBodySchema } from '@/lib/webhook-schemas';

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = createPreferenceBodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors?.[0] ?? 'userId y productId requeridos';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { userId, productId, metadata } = parsed.data;
    const amount = getProductPriceARS(productId);
    const title = productId === 'analysis_1' ? 'Análisis IA de tiro' :
      productId === 'pack_3' ? 'Pack 3 análisis' :
      productId === 'pack_10' ? 'Pack 10 análisis' :
      'History+ anual';

    const pref = await createPreference({
      userId,
      productId,
      amountARS: amount,
      title,
      returnBase: req.nextUrl.origin,
      metadata,
    });
    return NextResponse.json({ init_point: pref.init_point, id: pref.id, sandbox_init_point: pref.sandbox_init_point });
  } catch (err: any) {
    console.error('Error create-preference:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}


