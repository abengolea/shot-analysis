import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { frames, shotType } = body || {};
    if (!Array.isArray(frames) || frames.length < 2) {
      return NextResponse.json({ error: 'Se requieren al menos 2 frames' }, { status: 400 });
    }

    const { detectStartFrame } = await import('@/ai/flows/detect-start-frame');
    const result = await detectStartFrame({ frames, shotType });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('❌ Error en detect-start API:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}


