import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { reanalyzeAnalysis } from '@/lib/reanalyze-analysis';

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

async function loadPromptConfig(analysisId: string): Promise<any | undefined> {
  let promptConfig: any = undefined;
  try {
    const fbSnap = await adminDb.collection('analyses').doc(analysisId).collection('admin_feedback').doc('latest').get();
    if (fbSnap.exists) {
      const fb = fbSnap.data() as any;
      const issuesText = Array.isArray(fb.issues)
        ? fb.issues.map((it: any) => `- ${String(it.id)}${it.rating ? ` (rating ${it.rating})` : ''}${it.severity ? ` [${it.severity}]` : ''}${it.commentForAI ? `: ${it.commentForAI}` : ''}`).join('\n')
        : '';
      const intro: string = [
        fb.commentForAI ? `Notas del admin: ${fb.commentForAI}` : '',
        issuesText ? `Ítems observados:\n${issuesText}` : '',
      ].filter(Boolean).join('\n\n');
      promptConfig = { intro };
    }
  } catch {}
  return promptConfig;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'Método no permitido' }, { status: 405 });
    }
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });
    const promptConfig = await loadPromptConfig(id);
    const result = await reanalyzeAnalysis({ analysisId: id, promptConfig, reason: 'dev_get' });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Error interno' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, aiResult: result.analysisResult, score: result.score });
  } catch (e) {
    console.error('reanalyze GET error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    if (!id) return NextResponse.json({ ok: false, error: 'ID requerido' }, { status: 400 });

    const promptConfig = await loadPromptConfig(id);
    const result = await reanalyzeAnalysis({ analysisId: id, promptConfig, reason: 'admin' });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'Error interno' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, aiResult: result.analysisResult, score: result.score });
  } catch (e) {
    console.error('reanalyze error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


