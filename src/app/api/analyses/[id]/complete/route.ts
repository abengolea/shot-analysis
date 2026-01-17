import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    // Verificar acceso del coach: puede tener coachId directo o acceso pagado en coachAccess
    const hasCoachId = data?.coachId && String(data.coachId) === String(uid);
    const coachAccess = (data?.coachAccess || {})[uid];
    const hasPaidAccess = coachAccess && coachAccess.status === 'paid';
    const isCoach = hasCoachId || hasPaidAccess;
    if (!isCoach && !isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    await ref.set({ coachCompleted: true, coachCompletedAt: nowIso, updatedAt: nowIso }, { merge: true });

    // Actualizar el mensaje original del coach si existe
    try {
      // Buscar el mensaje usando el coachId que está completando (uid)
      const messagesQuery = await adminDb.collection('messages')
        .where('toCoachDocId', '==', uid)
        .where('analysisId', '==', id)
        .where('fromId', '==', 'system')
        .limit(1)
        .get();
      
      if (!messagesQuery.empty) {
        const messageDoc = messagesQuery.docs[0];
        const messageData = messageDoc.data();
        const playerName = data?.playerName || 'el jugador';
        await messageDoc.ref.update({
          text: `El análisis ${id} del jugador ${playerName} ya está terminado. La devolución está disponible.`,
          updatedAt: nowIso,
        });
      }
    } catch (e) {
      console.error('Error actualizando mensaje del coach:', e);
    }

    // Notificar al jugador con un mensaje en su bandeja (colección messages)
    try {
      if (data?.playerId) {
        const msg = {
          fromId: uid,
          fromName: 'Entrenador',
          toId: data.playerId,
          toName: data.playerName || data.playerId,
          text: 'Tu análisis fue revisado por el entrenador y ya está disponible la devolución.',
          analysisId: id, // Incluir el ID del análisis para poder generar el link
          createdAt: nowIso,
          read: false,
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

