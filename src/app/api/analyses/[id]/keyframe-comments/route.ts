import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getAppBaseUrl } from '@/lib/app-url';
import { hasPaidCoachAccessToPlayer } from '@/lib/coach-access';
import { keyframeIdFromUrl, isKeyframeUrlTooLong } from '@/lib/keyframe-id';
import { buildConversationId, getMessageType } from '@/lib/message-utils';
import { sendCustomEmail } from '@/lib/email-service';
import { coachKeyframeCommentTemplate } from '@/lib/email/templates/coach-keyframe-comment';

type KeyframeComment = {
  id?: string;
  analysisId: string;
  keyframeUrl: string;
  keyframeId?: string;
  angle?: 'front' | 'back' | 'left' | 'right';
  index?: number;
  comment: string;
  coachId: string;
  coachName?: string;
  createdAt: string;
};

async function verifyCoachPermission(req: NextRequest, analysisId: string): Promise<{ ok: boolean; uid?: string; reason?: string }> {
  try {
    if (!adminDb || !adminAuth) return { ok: false, reason: 'Admin SDK not ready' };
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false, reason: 'No token' };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const [coachSnap, viewerPlayerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const coachData = coachSnap.exists ? (coachSnap.data() as any) : null;
    const playerData = viewerPlayerSnap.exists ? (viewerPlayerSnap.data() as any) : null;
    const role = coachData?.role || playerData?.role;
    if (role === 'admin') return { ok: true, uid };

    const analysisRef = adminDb.collection('analyses').doc(analysisId);
    const analysisSnap = await analysisRef.get();
    if (!analysisSnap.exists) return { ok: false, reason: 'Analysis not found' };
    const analysis = analysisSnap.data() as any;
    const coachAccess = analysis?.coachAccess || {};
    const access = coachAccess?.[uid];
    // Solo el coach designado para ESTE lanzamiento (con pago) puede comentar en fotogramas
    if (access?.status === 'paid') return { ok: true, uid };
    // Coach sin acceso pagado para este análisis: no puede comentar
    return { ok: false, reason: 'Debes ser designado por el jugador para este lanzamiento para poder comentar' };
  } catch (e) {
    console.error('verifyCoachPermission error', e);
    return { ok: false, reason: 'Auth error' };
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    const { id: analysisId } = await params;
    const { searchParams } = new URL(request.url);
    const keyframeUrl = searchParams.get('keyframeUrl');

    const ref = adminDb.collection('analyses').doc(analysisId).collection('keyframeComments');
    let q = ref.orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (keyframeUrl) {
      if (isKeyframeUrlTooLong(keyframeUrl)) {
        q = q.where('keyframeId', '==', keyframeIdFromUrl(keyframeUrl));
      } else {
        q = q.where('keyframeUrl', '==', keyframeUrl);
      }
    }
    const snap = await q.get();
    const items: KeyframeComment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ comments: items });
  } catch (e) {
    console.error('❌ Error listando comentarios de keyframe:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: analysisId } = await params;
    if (!adminDb || !adminAuth) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    if (body?.action === 'list') {
      const keyframeUrl = String(body?.keyframeUrl || '');
      const ref = adminDb.collection('analyses').doc(analysisId).collection('keyframeComments');
      let q = ref.orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
      if (keyframeUrl) {
        if (isKeyframeUrlTooLong(keyframeUrl)) {
          q = q.where('keyframeId', '==', keyframeIdFromUrl(keyframeUrl));
        } else {
          q = q.where('keyframeUrl', '==', keyframeUrl);
        }
      }
      const snap = await q.get();
      const items: KeyframeComment[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return NextResponse.json({ comments: items });
    }

    const perm = await verifyCoachPermission(request, analysisId);
    if (!perm.ok || !perm.uid) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const keyframeUrl = String(body?.keyframeUrl || '');
    const comment = String(body?.comment || '').trim();
    const angle = body?.angle as KeyframeComment['angle'] | undefined;
    const index = typeof body?.index === 'number' ? Number(body.index) : undefined;
    const coachName = String(body?.coachName || '').trim() || undefined;
    if (!keyframeUrl || !comment) return NextResponse.json({ error: 'keyframeUrl y comment son requeridos' }, { status: 400 });

    const payload: KeyframeComment = {
      analysisId,
      keyframeUrl,
      keyframeId: keyframeIdFromUrl(keyframeUrl),
      angle,
      index,
      comment,
      coachId: perm.uid,
      ...(coachName ? { coachName } : {}),
      createdAt: new Date().toISOString(),
    };
    const ref = await adminDb.collection('analyses').doc(analysisId).collection('keyframeComments').add(payload);
    try {
      const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
      const analysis = analysisSnap.exists ? (analysisSnap.data() as any) : null;
      const playerId = analysis?.playerId;
      if (playerId) {
        const coachSnap = await adminDb.collection('coaches').doc(perm.uid).get();
        const coach = coachSnap.exists ? (coachSnap.data() as any) : null;
        const targetPlayerSnap = await adminDb.collection('players').doc(playerId).get();
        const player = targetPlayerSnap.exists ? (targetPlayerSnap.data() as any) : null;
        let playerEmail = '';
        try {
          const userRecord = await adminAuth.getUser(playerId);
          playerEmail = userRecord.email?.trim() || '';
        } catch {}
        if (!playerEmail && player?.email) playerEmail = String(player.email).trim();
        const baseUrl = getAppBaseUrl({ requestOrigin: request.nextUrl.origin });
        const query = angle && typeof index === 'number'
          ? `?kfAngle=${encodeURIComponent(angle)}&kfIndex=${encodeURIComponent(String(index))}`
          : '';
        const link = `${baseUrl}/analysis/${analysisId}${query}#videos`;
        const messageText = `Tu entrenador comentó un fotograma de tu análisis. Ver: ${link}`;
        await adminDb.collection('messages').add({
          fromId: perm.uid,
          fromName: coachName || coach?.name || 'Entrenador',
          ...(coach?.avatarUrl ? { fromAvatarUrl: coach.avatarUrl } : {}),
          toId: playerId,
          toName: player?.name || player?.fullName || playerId,
          text: messageText,
          createdAt: new Date().toISOString(),
          read: false,
          analysisId,
          keyframeUrl,
          angle,
          index,
          link,
          messageType: getMessageType({ fromId: perm.uid, analysisId }),
          conversationId: buildConversationId({ fromId: perm.uid, toId: playerId, analysisId }),
        });

        if (playerEmail) {
          try {
            const { html, text: textPlain } = coachKeyframeCommentTemplate({
              playerName: player?.name ? String(player.name) : undefined,
              coachName: coachName || coach?.name || 'Entrenador',
              linkUrl: link,
              siteUrl: baseUrl || undefined,
            });
            await sendCustomEmail({
              to: playerEmail,
              subject: 'Tu entrenador te dejó un comentario en tu análisis',
              html,
              text: textPlain,
            });
          } catch (emailErr) {
            console.warn('⚠️ No se pudo enviar email al jugador:', emailErr);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ No se pudo crear mensaje de notificación:', e);
    }
    return NextResponse.json({ success: true, id: ref.id });
  } catch (e) {
    console.error('❌ Error creando comentario de keyframe:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


