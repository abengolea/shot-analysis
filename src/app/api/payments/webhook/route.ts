import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook, verifyWebhookSignature } from '@/lib/mercadopago';
import { mpWebhookEventSchema } from '@/lib/webhook-schemas';

const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');
    const url = new URL(req.url);
    const raw = await req.json();
    const parsed = mpWebhookEventSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }
    const event = parsed.data;
    const dataIdFromUrl = url.searchParams.get('data.id');
    const dataId = dataIdFromUrl ?? event?.data?.id ?? event?.data_id ?? null;

    if (MP_WEBHOOK_SECRET) {
      const valid = verifyWebhookSignature({
        xSignature,
        xRequestId,
        dataId,
        secret: MP_WEBHOOK_SECRET,
      });
      if (!valid) {
        console.warn('[Webhook MP] Firma x-signature inválida');
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
      }
    }

    const result = await handleWebhook(event);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}


