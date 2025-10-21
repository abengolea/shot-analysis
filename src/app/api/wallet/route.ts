import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const ref = adminDb.collection('wallets').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ credits: 0, freeAnalysesUsed: 0, yearInUse: new Date().getFullYear(), lastFreeAnalysisDate: null });
    return NextResponse.json(snap.data());
  } catch (e: any) {
    console.error('wallet api error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

