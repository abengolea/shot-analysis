import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook } from '@/lib/mercadopago';

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
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

