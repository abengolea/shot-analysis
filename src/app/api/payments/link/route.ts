import { NextRequest, NextResponse } from 'next/server';
import { createPreference, getProductPriceARS } from '@/lib/mercadopago';

type ProductId = 'analysis_1' | 'pack_3' | 'pack_10' | 'history_plus_annual';

const TITLES: Record<ProductId, string> = {
  analysis_1: 'Análisis IA de tiro',
  pack_3: 'Pack 3 análisis',
  pack_10: 'Pack 10 análisis',
  history_plus_annual: 'History+ anual',
};

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const productIdRaw = sp.get('productId');

    if (!productIdRaw) {
      return NextResponse.json({ error: 'productId requerido' }, { status: 400 });
    }

    const productId = productIdRaw as ProductId;
    if (!['analysis_1', 'pack_3', 'pack_10', 'history_plus_annual'].includes(productId)) {
      return NextResponse.json({ error: 'productId inválido' }, { status: 400 });
    }

    const amount = getProductPriceARS(productId);
    const title = TITLES[productId];

    const pref = await createPreference({
      productId,
      amountARS: amount,
      title,
    });

    const url = pref?.init_point || pref?.sandbox_init_point;
    if (!url) {
      return NextResponse.json({ error: 'No se pudo obtener URL de checkout' }, { status: 500 });
    }

    return NextResponse.redirect(url);
  } catch (err: any) {
    console.error('Error /api/payments/link:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}

