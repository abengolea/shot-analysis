import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

async function getAuth(request: NextRequest): Promise<{ ok: true; uid: string; role: 'user' | 'admin' } | { ok: false; status: number; message: string }> {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return { ok: false, status: 401, message: 'Authorization Bearer token requerido' };
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const isAdmin = (coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined)) === 'admin';
    return { ok: true, uid, role: isAdmin ? 'admin' : 'user' };
  } catch (e: any) {
    return { ok: false, status: 401, message: 'Token inválido' };
  }
}

// GET mensajes (paginado simple)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(Number(searchParams.get('limit') || 50), 200));
    const startAfter = searchParams.get('startAfter') || '';

    let query = adminDb.collection('tickets').doc(params.id).collection('messages').orderBy('createdAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (startAfter) query = query.startAfter(startAfter);
    const snap = await query.limit(limit).get();
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ items, next: items.length ? items[items.length - 1].createdAt : null });
  } catch (e: any) {
    console.error('ticket messages GET error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

// POST nuevo mensaje en ticket
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const who = await getAuth(request);
    if (!who.ok) return NextResponse.json({ error: who.message }, { status: who.status });

    const ticketRef = adminDb.collection('tickets').doc(params.id);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) return NextResponse.json({ error: 'Ticket no existe' }, { status: 404 });
    const ticket = ticketSnap.data() as any;

    // Autorización mínima: user propietario o admin
    if (who.role === 'user' && ticket.userId !== who.uid) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const text = String(body?.text || '').trim();
    if (!text || text.length < 1) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 });

    const nowIso = new Date().toISOString();
    const msg = {
      ticketId: params.id,
      senderId: who.uid,
      senderRole: who.role,
      text,
      attachments: Array.isArray(body?.attachments) ? body.attachments : [],
      createdAt: nowIso,
    };
    await ticketRef.collection('messages').add(msg);

    const updates: Record<string, any> = {
      lastMessageAt: nowIso,
      lastSenderRole: who.role,
      updatedAt: nowIso,
    };
    if (who.role === 'user') {
      updates.unreadForAdmin = (Number(ticket.unreadForAdmin || 0) + 1);
      if (ticket.status === 'waiting_user') updates.status = 'in_progress';
    } else {
      updates.unreadForUser = (Number(ticket.unreadForUser || 0) + 1);
      if (!ticket.firstResponseAt) updates.firstResponseAt = nowIso;
      if (ticket.status === 'open') updates.status = 'in_progress';
    }
    await ticketRef.set(updates, { merge: true });

    // Email notificación
    try {
      const { sendAdminNotification, sendCustomEmail } = await import('@/lib/email-service');
      if (who.role === 'admin') {
        await sendCustomEmail({ to: String(ticket.userEmail || 'abengolea@hotmail.com'), subject: `Respuesta a tu ticket: ${ticket.subject}`, html: `<p>${text}</p>` });
      } else {
        await sendAdminNotification({
          subject: `Nuevo mensaje en ticket: ${ticket.subject}`,
          html: `<p>${text}</p>`,
          fallbackTo: 'abengolea@hotmail.com',
        });
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('ticket messages POST error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}


