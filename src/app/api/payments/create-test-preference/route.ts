import { NextRequest, NextResponse } from 'next/server';
import { createPreference } from '@/lib/mercadopago';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let userId = body?.userId as string | undefined;
    const userEmail = (body?.userEmail as string | undefined)?.toLowerCase();
    const amountRaw = body?.amount;
    const amount = Math.max(1, Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : 100);

    // Permitir resolver por email si no vino userId
    if (!userId && userEmail && adminDb) {
      try {
        const playersSnap = await adminDb.collection('players').where('email', '==', userEmail).limit(1).get();
        if (!playersSnap.empty) {
          userId = playersSnap.docs[0].id;
        } else {
          const coachesSnap = await adminDb.collection('coaches').where('email', '==', userEmail).limit(1).get();
          if (!coachesSnap.empty) {
            userId = coachesSnap.docs[0].id;
          }
        }
      } catch (e) {
        console.error('Error resolviendo userId por email:', e);
      }
    }

    // Fallback: intentar por Firebase Auth
    if (!userId && userEmail) {
      try {
        const u = await adminAuth.getUserByEmail(userEmail);
        if (u?.uid) userId = u.uid;
      } catch (e) {
        // ignorar si no existe
      }
    }

    if (!userId && !userEmail) {
      return NextResponse.json({ error: 'Debe enviar userId o userEmail' }, { status: 400 });
    }

    const pref = await createPreference({
      userId,
      userEmail,
      productId: 'analysis_1',
      amountARS: amount,
      title: 'Pago de prueba (1 crédito)',
    });

    return NextResponse.json({
      id: pref.id,
      init_point: pref.init_point,
      sandbox_init_point: pref.sandbox_init_point,
      amount,
      userId,
    });
  } catch (err: any) {
    console.error('Error create-test-preference:', err);
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 });
  }
}

