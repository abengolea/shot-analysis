import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

// Job manual: marcar para purga análisis >24 meses si no hay History+
export async function POST(_req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const twoYearsAgo = new Date();
    twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);

    // Buscar wallets con History+ activo
    const walletsSnap = await adminDb.collection('wallets').get();
    const historyUsers = new Set<string>();
    walletsSnap.forEach((doc) => {
      const w: any = doc.data();
      const active = w.historyPlusActive && (!w.historyPlusValidUntil || new Date(w.historyPlusValidUntil) > new Date());
      if (active) historyUsers.add(w.userId || doc.id);
    });

    // Buscar análisis antiguos
    const analysesSnap = await adminDb.collection('analyses').where('createdAt', '<', twoYearsAgo.toISOString()).get();
    const toFlag: string[] = [];
    for (const doc of analysesSnap.docs) {
      const data: any = doc.data();
      const userId = data.playerId;
      if (historyUsers.has(userId)) continue;
      toFlag.push(doc.id);
    }

    // Marcar como expiringSoon para UI (purga real puede ser otra tarea)
    const batch = adminDb.batch();
    toFlag.forEach((id) => {
      const ref = adminDb.collection('analyses').doc(id);
      batch.update(ref, { expiringSoon: true, updatedAt: new Date().toISOString() });
    });
    await batch.commit();

    return NextResponse.json({ flagged: toFlag.length });
  } catch (e: any) {
    console.error('retention job error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}



