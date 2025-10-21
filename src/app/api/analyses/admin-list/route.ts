import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Endpoint temporal de depuración:
// GET /api/analyses/admin-list?token=ADMIN_BOOTSTRAP_123
// o enviar header x-bootstrap-token: ADMIN_BOOTSTRAP_123
// Devuelve hasta 500 analyses sin requerir Firebase Auth

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ ok: false, error: 'Admin SDK no inicializado (FIREBASE_ADMIN_* o ADC faltante)' }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const qp = searchParams.get('token') || '';
    const hp = req.headers.get('x-bootstrap-token') || '';
    const token = (qp || hp || '').trim();
    if (token !== 'ADMIN_BOOTSTRAP_123') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const snap = await adminDb
      .collection('analyses')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    const analyses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, count: analyses.length, analyses });
  } catch (e: any) {
    console.error('admin-list error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}

