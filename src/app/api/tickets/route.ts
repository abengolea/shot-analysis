import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

async function getAuthUid(request: NextRequest): Promise<{ ok: true; uid: string; email?: string } | { ok: false; status: number; message: string }> {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return { ok: false, status: 401, message: 'Authorization Bearer token requerido' };
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid, email: decoded.email };
  } catch (e: any) {
    return { ok: false, status: 401, message: 'Token inválido' };
  }
}

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  try {
    const who = await getAuthUid(request);
    if (!who.ok) return false;
    const uid = who.uid;
    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return role === 'admin';
  } catch {
    return false;
  }
}

// GET /api/tickets
// Admin (admin=1): filtros status, assigneeId, limit, startAfter
// User: userId obligatorio (o inferido del token), limit, startAfter
export async function GET(request: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const limitParam = Math.max(1, Math.min(Number(searchParams.get('limit') || 50), 100));
    const startAfterParam = searchParams.get('startAfter') || '';
    const adminFlag = searchParams.get('admin');
    const requestIsAdmin = adminFlag === '1' || adminFlag === 'true' ? await isAdminRequest(request) : false;

    let query = adminDb.collection('tickets').orderBy('updatedAt', 'desc') as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

    if (requestIsAdmin) {
      const status = searchParams.get('status') as TicketStatus | null;
      const assigneeId = searchParams.get('assigneeId');
      if (status) query = query.where('status', '==', status);
      if (assigneeId) query = query.where('adminAssigneeId', '==', assigneeId);
    } else {
      // Usuario normal: limitar a sus tickets
      const who = await getAuthUid(request);
      if (!who.ok) return NextResponse.json({ error: who.message }, { status: who.status });
      const userId = (searchParams.get('userId') || who.uid);
      query = query.where('userId', '==', userId);
    }

    if (startAfterParam) query = query.startAfter(startAfterParam);
    const snap = await query.limit(limitParam).get();
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ items, next: items.length ? items[items.length - 1].updatedAt : null });
  } catch (e: any) {
    console.error('tickets GET error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

// POST /api/tickets  -> crear ticket
export async function POST(request: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const who = await getAuthUid(request);
    if (!who.ok) return NextResponse.json({ error: who.message }, { status: who.status });

    const body = await request.json();
    const subject = String(body?.subject || '').trim();
    const category = String(body?.category || '').trim();
    const description = String(body?.description || '').trim();
    const priority = String(body?.priority || 'normal').trim().toLowerCase() as TicketPriority;

    if (!subject || subject.length < 3) return NextResponse.json({ error: 'subject inválido' }, { status: 400 });
    if (!category) return NextResponse.json({ error: 'category inválido' }, { status: 400 });
    if (!description || description.length < 5) return NextResponse.json({ error: 'description inválida' }, { status: 400 });

    // Rate limit simple: 5 tickets en últimas 24h por usuario
    const now = new Date();
    const dayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const recentSnap = await adminDb
      .collection('tickets')
      .where('userId', '==', who.uid)
      .where('createdAt', '>=', dayAgoIso)
      .limit(6)
      .get();
    if (recentSnap.size >= 5) {
      return NextResponse.json({ error: 'Límite de creación alcanzado. Intenta más tarde.' }, { status: 429 });
    }

    const nowIso = now.toISOString();
    const userEmail = who.email || null;

    const ticketData = {
      userId: who.uid,
      userEmail,
      subject,
      category,
      description,
      status: 'open' as TicketStatus,
      priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : ('normal' as TicketPriority),
      adminAssigneeId: null as string | null,
      unreadForAdmin: 1,
      unreadForUser: 0,
      lastMessageAt: nowIso,
      lastSenderRole: 'user' as const,
      firstResponseAt: null as string | null,
      resolutionAt: null as string | null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const ref = await adminDb.collection('tickets').add(ticketData);

    // Guardar también el primer mensaje como descripción inicial
    const msg = {
      ticketId: ref.id,
      senderId: who.uid,
      senderRole: 'user' as const,
      text: description,
      attachments: [] as string[],
      createdAt: nowIso,
    };
    await adminDb.collection('tickets').doc(ref.id).collection('messages').add(msg);

    // Email de notificación (placeholder)
    try {
      const { sendCustomEmail } = await import('@/lib/email-service');
      await sendCustomEmail({
        to: 'abengolea@hotmail.com',
        subject: `Nuevo ticket: ${subject}`,
        html: `<p>Categoría: ${category}</p><p>Descripción: ${description}</p><p>Usuario: ${userEmail || who.uid}</p>`
      });
    } catch {}

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    console.error('tickets POST error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

