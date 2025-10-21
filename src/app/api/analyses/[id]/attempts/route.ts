import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

type Attempt = { start: number; end: number };

function validateAttempts(attempts: Attempt[], videoDuration?: number): string | null {
  if (!Array.isArray(attempts)) return 'Formato inválido';
  for (const a of attempts) {
    if (typeof a.start !== 'number' || typeof a.end !== 'number') return 'Tiempos inválidos';
    if (!(a.start >= 0) || !(a.end > a.start)) return 'Rango inválido';
    if (videoDuration && (a.start > videoDuration || a.end > videoDuration)) return 'Fuera de duración';
  }
  const sorted = [...attempts].sort((x, y) => x.start - y.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) return 'Intentos solapados';
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const attempts: Attempt[] = body?.attempts || [];
    const videoDuration: number | undefined = typeof body?.videoDuration === 'number' ? body.videoDuration : undefined;

    const validation = validateAttempts(attempts, videoDuration);
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 });
    }

    const ref = adminDb.collection('analyses').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }

    // TODO: Permisos reales (owner/coach). Por ahora permitir.
    await ref.update({ attempts, updatedAt: new Date().toISOString() });

    return NextResponse.json({ success: true, attempts });
  } catch (e) {
    console.error('❌ Error guardando intentos:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

