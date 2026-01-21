import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { buildConversationId, getMessageType } from '@/lib/message-utils';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Cargar análisis y verificar permisos (el coach asignado o admin)
    const ref = adminDb.collection('analyses').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    const data = snap.data() as any;
    const isAdmin = decoded?.claims?.admin === true;
    const isCoach = data?.coachId && String(data.coachId) === String(uid);
    if (!isCoach && !isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    await ref.set({ coachCompleted: true, updatedAt: nowIso }, { merge: true });

    // Notificar al jugador con un mensaje en su bandeja (colección messages)
    try {
      if (data?.playerId) {
        const msg = {
          fromId: uid,
          fromName: 'Entrenador',
          toId: data.playerId,
          toName: data.playerName || data.playerId,
          text: 'Tu análisis fue revisado por el entrenador y ya está disponible la devolución.',
          analysisId: id,
          createdAt: nowIso,
          read: false,
          messageType: getMessageType({ fromId: uid, analysisId: id }),
          conversationId: buildConversationId({ fromId: uid, toId: data.playerId, analysisId: id }),
        } as any;
        await adminDb.collection('messages').add(msg);
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('complete analysis error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}


