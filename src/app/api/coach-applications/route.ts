import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

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

export async function POST(request: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const who = await getAuthUid(request);
    if (!who.ok) return NextResponse.json({ error: who.message }, { status: who.status });

    const body = await request.json();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const bio = String(body?.bio || '').trim();
    const photoUrl = String(body?.photoUrl || '').trim();

    if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
    // Foto ahora es opcional

    const now = new Date();
    const data = {
      userId: who.uid,
      email,
      name,
      bio: bio || null,
      photoUrl,
      status: 'pending' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Rate limit básico: 3 solicitudes por 24h
    const dayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const recentSnap = await adminDb
      .collection('coach_applications')
      .where('userId', '==', who.uid)
      .where('createdAt', '>=', dayAgoIso)
      .get();
    if (recentSnap.size >= 3) {
      return NextResponse.json({ error: 'Límite de solicitudes alcanzado. Intenta más tarde.' }, { status: 429 });
    }

    const ref = await adminDb.collection('coach_applications').add(data);

    // Crear ticket para notificación del admin
    try {
      const nowIso = new Date().toISOString();
      const subject = `Solicitud de alta de entrenador: ${name}`;
      const description = `Nombre: ${name}\nEmail: ${who.email || email}\nBio: ${bio || '-'}\nFoto: ${photoUrl || '-'}`;
      const ticketData = {
        userId: who.uid,
        userEmail: who.email || email,
        subject,
        category: 'coach_application',
        description,
        status: 'open' as const,
        priority: 'normal' as const,
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
      const ticketRef = await adminDb.collection('tickets').add(ticketData);
      const msg = {
        ticketId: ticketRef.id,
        senderId: who.uid,
        senderRole: 'user' as const,
        text: description,
        attachments: [] as string[],
        createdAt: nowIso,
      };
      await adminDb.collection('tickets').doc(ticketRef.id).collection('messages').add(msg);
    } catch (e) {
      console.warn('No se pudo crear el ticket para la solicitud de entrenador', e);
    }

    // Notificación admin (placeholder via email-service)
    try {
      const { sendCustomEmail } = await import('@/lib/email-service');
      await sendCustomEmail({
        to: 'abengolea1@gmail.com',
        subject: `Nueva solicitud de entrenador: ${name}`,
        html: `<p>Usuario: ${who.email || email}</p><p>Nombre: ${name}</p><p>Bio: ${bio || '-'}</p><p>Foto: ${photoUrl || '-'}</p><p>ID: ${ref.id}</p>`
      });
    } catch {}

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    console.error('coach-applications POST error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}


