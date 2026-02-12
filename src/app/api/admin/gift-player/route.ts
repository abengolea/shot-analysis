import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { sendCustomEmail } from '@/lib/email-service';
import { playerGiftTemplate } from '@/lib/email/templates';
import { getAppBaseUrl } from '@/lib/app-url';

async function isAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth!.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return role === 'admin';
  } catch {
    return false;
  }
}

/**
 * POST: Regalar análisis y revisiones coach (misma cantidad) a un jugador.
 * Body: { userId, count: number }
 * Envía un solo email al jugador.
 */
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    if (!(await isAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    const count = typeof body.count === 'number' ? Math.max(0, body.count) : parseInt(String(body.count || '0'), 10) || 0;

    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    if (count <= 0) return NextResponse.json({ error: 'count debe ser positivo' }, { status: 400 });

    const nowIso = new Date().toISOString();
    const walletRef = adminDb.collection('wallets').doc(userId);

    await adminDb.runTransaction(async (tx: any) => {
      const walletSnap = await tx.get(walletRef);
      const base = walletSnap.exists ? walletSnap.data() : {
        userId,
        credits: 0,
        freeAnalysesUsed: 0,
        yearInUse: new Date().getFullYear(),
        freeCoachReviews: 0,
        historyPlusActive: false,
        historyPlusValidUntil: null,
        currency: 'ARS',
        createdAt: nowIso,
      };
      base.credits = (base.credits || 0) + count;
      base.freeCoachReviews = (base.freeCoachReviews || 0) + count;
      base.updatedAt = nowIso;
      tx.set(walletRef, base, { merge: true });
    });

    const playerSnap = await adminDb.collection('players').doc(userId).get();
    const playerData = playerSnap.exists ? (playerSnap.data() as any) : null;
    const email = (playerData?.email || '').trim();
    const playerName = playerData?.name || '';

    if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      const siteUrl = getAppBaseUrl();
      const { html, text } = playerGiftTemplate({ playerName: playerName || undefined, count, siteUrl });
      await sendCustomEmail({
        to: email,
        subject: `Recibiste ${count} análisis y ${count} revisiones de entrenador`,
        html,
        text,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Se regalaron ${count} análisis y ${count} revisiones coach. Email enviado.`,
    });
  } catch (e: any) {
    console.error('admin gift-player error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
