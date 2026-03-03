import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { sendCustomEmail } from '@/lib/email-service';
import { clubBulkGiftTemplate } from '@/lib/email/templates';
import { getAppBaseUrl } from '@/lib/app-url';

async function isAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
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
 * GET: Vista previa de jugadores por club.
 * Query: clubName (exacto, ej. "La Emilia")
 */
export async function GET(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    if (!(await isAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const clubName = String(searchParams.get('clubName') || '').trim();
    if (!clubName) {
      return NextResponse.json({ error: 'clubName requerido' }, { status: 400 });
    }

    const snap = await adminDb
      .collection('players')
      .where('club', '==', clubName)
      .limit(500)
      .get();

    const players = snap.docs.map((d) => {
      const data = d.data() as any;
      const yaRecibio = data?.clubBulkGiftFrom === clubName;
      return {
        id: d.id,
        name: data?.name || '-',
        email: data?.email || '-',
        club: data?.club || '-',
        coachId: data?.coachId || null,
        yaRecibioRegalo: !!yaRecibio,
      };
    });

    return NextResponse.json({ count: players.length, players, nuevos: players.filter((p: any) => !p.yaRecibioRegalo).length });
  } catch (e: any) {
    console.error('admin bulk-club-coach preview error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

/**
 * POST: Asignar coach y/o regalar análisis/revisiones a todos los jugadores de un club.
 * Body: { clubName, coachId, giftAnalyses?, giftCoachReviews? }
 */
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    if (!(await isAdmin(req))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const clubName = String(body.clubName || '').trim();
    const coachId = String(body.coachId || '').trim();
    const giftAnalyses = typeof body.giftAnalyses === 'number' ? Math.max(0, body.giftAnalyses) : 0;
    const giftCoachReviews = typeof body.giftCoachReviews === 'number' ? Math.max(0, body.giftCoachReviews) : 0;

    if (!clubName) {
      return NextResponse.json({ error: 'clubName requerido' }, { status: 400 });
    }
    if (!coachId) {
      return NextResponse.json({ error: 'coachId requerido' }, { status: 400 });
    }

    const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
    if (!coachSnap.exists) {
      return NextResponse.json({ error: 'Coach no encontrado' }, { status: 404 });
    }
    const coachName = (coachSnap.data() as any)?.name || 'tu entrenador';

    const playersSnap = await adminDb
      .collection('players')
      .where('club', '==', clubName)
      .limit(500)
      .get();

    const nowIso = new Date().toISOString();
    const updated: Array<{ id: string; name: string }> = [];
    const emailsToSend: Array<{ email: string; name: string }> = [];
    let regalados = 0;

    for (const doc of playersSnap.docs) {
      const playerId = doc.id;
      const data = doc.data() as any;
      const yaRecibioRegalo = data?.clubBulkGiftFrom === clubName;

      const playerUpdates: Record<string, unknown> = {
        coachId,
        updatedAt: nowIso,
      };

      const playerRef = adminDb.collection('players').doc(playerId);

      if (!yaRecibioRegalo && (giftAnalyses > 0 || giftCoachReviews > 0)) {
        playerUpdates.clubBulkGiftFrom = clubName;
        playerUpdates.clubBulkGiftAt = nowIso;
        const walletRef = adminDb.collection('wallets').doc(playerId);
        await adminDb.runTransaction(async (tx: any) => {
          tx.update(playerRef, playerUpdates);
          const walletSnap = await tx.get(walletRef);
          const base = walletSnap.exists ? walletSnap.data() : {
            userId: playerId,
            credits: 0,
            freeAnalysesUsed: 0,
            yearInUse: new Date().getFullYear(),
            freeCoachReviews: 0,
            historyPlusActive: false,
            historyPlusValidUntil: null,
            currency: 'ARS',
            createdAt: nowIso,
          };
          const newCredits = (base.credits || 0) + giftAnalyses;
          const newFreeReviews = (base.freeCoachReviews || 0) + giftCoachReviews;
          tx.set(walletRef, {
            ...base,
            credits: newCredits,
            freeCoachReviews: newFreeReviews,
            updatedAt: nowIso,
          }, { merge: true });
        });
        regalados++;
        const email = (data?.email || '').trim();
        if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          emailsToSend.push({ email, name: data?.name || '' });
        }
      } else if (yaRecibioRegalo) {
        await adminDb.collection('players').doc(playerId).update(playerUpdates);
      } else {
        await adminDb.collection('players').doc(playerId).update(playerUpdates);
      }

      updated.push({ id: playerId, name: data?.name || playerId });
    }

    let msg = `Se actualizaron ${updated.length} jugador(es) del club "${clubName}": coach asignado`;
    if (giftAnalyses > 0 || giftCoachReviews > 0) {
      if (regalados > 0) {
        msg += `, ${regalados} recibieron el regalo (análisis/revisiones)`;
      }
      if (updated.length > regalados && regalados >= 0) {
        const omitidos = updated.length - regalados;
        if (omitidos > 0) msg += `, ${omitidos} ya lo tenían (no se suma)`;
      }
    }
    msg += '.';

    if (emailsToSend.length > 0 && (giftAnalyses > 0 || giftCoachReviews > 0)) {
      const siteUrl = getAppBaseUrl();
      const results = await Promise.allSettled(
        emailsToSend.map(({ email, name }) => {
          const { html, text } = clubBulkGiftTemplate({
            playerName: name || undefined,
            clubName,
            coachName,
            giftAnalyses,
            giftCoachReviews,
            siteUrl,
          });
          return sendCustomEmail({
            to: email,
            subject: `Tu club ${clubName} te regaló análisis y revisiones`,
            html,
            text,
          });
        })
      );
      const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)).length;
      if (sent > 0) msg += ` Se enviaron ${sent} email(s) a los jugadores.`;
      if (failed > 0) console.warn(`⚠️ ${failed} email(s) no se pudieron enviar`);
    }

    return NextResponse.json({
      ok: true,
      updated: updated.length,
      regalados,
      message: msg,
      players: updated,
    });
  } catch (e: any) {
    console.error('admin bulk-club-coach execute error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
