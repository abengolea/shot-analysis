import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook, verifyWebhookSignature } from '@/lib/dlocal';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const event = JSON.parse(body);
    
    // Verificar firma del webhook (si dLocal Go la envía)
    // Consulta la documentación oficial para el método específico de verificación
    const signature = req.headers.get('X-Signature') || req.headers.get('authorization') || null;
    
    // Si hay firma, verificarla (implementar según docs oficiales)
    if (signature && process.env.DLOCAL_SECRET_KEY) {
      const isValid = verifyWebhookSignature(body, signature);
      if (!isValid) {
        console.error('Firma de webhook dLocal Go inválida');
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
      }
    }

    const result = await handleWebhook(event);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Webhook dLocal Go error:', err);
    // Siempre retornar 200 para evitar reintentos excesivos
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: 'dlocal' });
}

