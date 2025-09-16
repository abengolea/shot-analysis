import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function requireCoachOrAdmin(req: NextRequest): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'coach' || role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCoachOrAdmin(req);
    const { id } = await params;
    // Permitir al jugador dueño del análisis leer
    let requesterUid: string | undefined = undefined;
    if (auth.ok) requesterUid = auth.uid;
    else {
      try {
        const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
        if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
          const token = authHeader.split(' ')[1];
          const decoded = await adminAuth.verifyIdToken(token);
          requesterUid = decoded.uid;
        }
      } catch {}
    }
    if (!requesterUid) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });

    // Si no es coach/admin, validar que sea el jugador del análisis
    if (!auth.ok) {
      const aSnap = await adminDb.collection('analyses').doc(id).get();
      const aData = aSnap.exists ? (aSnap.data() as any) : null;
      if (!aData || String(aData.playerId) !== requesterUid) {
        return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
      }
    }

    // Devolver el feedback más reciente de cualquier coach (si existiera más de uno)
    const collRef = adminDb.collection('analyses').doc(id).collection('coach_feedback');
    const qs = await collRef.orderBy('updatedAt', 'desc').limit(1).get();
    if (qs.empty) return NextResponse.json({ ok: true, feedback: null });
    const d = qs.docs[0];
    return NextResponse.json({ ok: true, feedback: { id: d.id, ...(d.data() as any) } });
  } catch (e) {
    console.error('coach-feedback GET error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCoachOrAdmin(req);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const body = await req.json();
    const items = (body?.items && typeof body.items === 'object') ? body.items as Record<string, { rating?: number; comment?: string }> : {};
    const coachSummary = typeof body?.coachSummary === 'string' ? body.coachSummary : '';
    const nowIso = new Date().toISOString();

    const feedbackRef = adminDb.collection('analyses').doc(id).collection('coach_feedback').doc(auth.uid);
    const prev = await feedbackRef.get();
    const prevItems = prev.exists ? ((prev.data() as any)?.items || {}) : {};
    const mergedItems = { ...prevItems, ...items };
    const payload = {
      items: mergedItems,
      coachSummary,
      visibility: 'player_only',
      updatedAt: nowIso,
      createdAt: prev.exists ? (prev.data() as any)?.createdAt || nowIso : nowIso,
      createdBy: prev.exists ? (prev.data() as any)?.createdBy || auth.uid : auth.uid,
    };
    await feedbackRef.set(payload, { merge: true });

    // Detectar discrepancias IA vs entrenador
    try {
      const aSnap = await adminDb.collection('analyses').doc(id).get();
      const aData = aSnap.exists ? (aSnap.data() as any) : {};
      const iaChecklist: any[] = Array.isArray(aData?.detailedChecklist) ? aData.detailedChecklist : [];
      const iaItemRatingById: Record<string, number> = {};
      for (const cat of iaChecklist) {
        const list = Array.isArray(cat?.items) ? cat.items : [];
        for (const it of list) {
          const itemId = String(it?.id || '').trim().toLowerCase();
          if (!itemId) continue;
          let r: number | undefined = typeof it?.rating === 'number' ? it.rating : undefined;
          if (r == null) {
            const s = String(it?.status || '');
            r = s === 'Incorrecto' ? 1 : s === 'Incorrecto leve' ? 2 : s === 'Mejorable' ? 3 : s === 'Correcto' ? 4 : s === 'Excelente' ? 5 : 3;
          }
          iaItemRatingById[itemId] = r as number;
        }
      }
      const diffs: Array<{ itemId: string; iaRating: number; coachRating: number; coachComment?: string }> = [];
      for (const [itemId, cf] of Object.entries(items)) {
        const idNorm = itemId.trim().toLowerCase();
        if (!idNorm) continue;
        const iaR = iaItemRatingById[idNorm];
        const cr = typeof cf?.rating === 'number' ? cf.rating : undefined;
        if (iaR != null && cr != null && iaR !== cr) {
          diffs.push({ itemId: idNorm, iaRating: iaR, coachRating: cr, coachComment: cf?.comment });
        }
      }
      if (diffs.length) {
        const queueRef = adminDb.collection('ia_review_queue');
        for (const d of diffs) {
          await queueRef.add({
            analysisId: id,
            itemId: d.itemId,
            iaRating: d.iaRating,
            coachRating: d.coachRating,
            coachComment: d.coachComment || '',
            createdAt: nowIso,
            createdBy: auth.uid,
            status: 'open',
          });
        }
      }
    } catch (e) {
      console.warn('No se pudieron registrar discrepancias IA vs coach:', e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('coach-feedback POST error', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}


