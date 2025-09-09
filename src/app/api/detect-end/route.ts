import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { frames, shotType } = body || {};
    if (!Array.isArray(frames) || frames.length < 3) {
      return NextResponse.json({ error: 'Se requieren al menos 3 frames' }, { status: 400 });
    }

    const { detectEndFrame } = await import('@/ai/flows/detect-end-frame');
    const result = await detectEndFrame({ frames, shotType });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('❌ Error en detect-end API:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}


