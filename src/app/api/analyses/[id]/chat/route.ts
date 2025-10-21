import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { reviewChatFlow } from '@/ai/flows/review-chat';

async function requireAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const snap = await adminDb.collection('analyses').doc(id).collection('admin_chat').orderBy('createdAt').limit(200).get();
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    console.error('chat GET error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const message: string = String(body?.message || '');
    const attachments: string[] = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!message) return NextResponse.json({ ok: false, error: 'Mensaje requerido' }, { status: 400 });

    // Guardar mensaje del usuario
    const now = new Date().toISOString();
    const refUser = await adminDb.collection('analyses').doc(id).collection('admin_chat').add({
      role: 'user',
      text: message,
      attachments,
      createdAt: now,
      createdBy: auth.uid,
    });

    // Contexto del análisis para la IA
    const aSnap = await adminDb.collection('analyses').doc(id).get();
    const analysis = aSnap.exists ? (aSnap.data() as any) : {};

    const summary = String((analysis?.analysisSummary) || (analysis?.analysisResult?.analysisSummary) || '');
    const checklist = (analysis?.detailedChecklist || analysis?.analysisResult?.detailedChecklist) ? JSON.stringify(analysis?.detailedChecklist || analysis?.analysisResult?.detailedChecklist) : '';
    const attachmentsMd = Array.isArray(attachments) && attachments.length
      ? attachments.map((u) => `![adjunto](${u})`).join('\n')
      : '';
    const { reply } = await reviewChatFlow({
      analysisSummary: summary,
      detailedChecklist: checklist,
      message,
      attachments,
      attachmentsMd,
    });

    const refAssistant = await adminDb.collection('analyses').doc(id).collection('admin_chat').add({
      role: 'assistant',
      text: reply,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, messages: [ { id: refUser.id, role: 'user', text: message }, { id: refAssistant.id, role: 'assistant', text: reply } ] });
  } catch (e) {
    console.error('chat POST error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

