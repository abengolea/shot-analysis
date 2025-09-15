import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function isAdmin(req: NextRequest): Promise<{ ok: boolean; uid?: string }> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false };
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    // Determinar rol buscando en coaches y players; admin si role==='admin'
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    if (role === 'admin') return { ok: true, uid };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // move to Monday (0..6)
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'DB no inicializada' }, { status: 500 });
    const auth = await isAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    // Helpers para count() con fallback
    const countCollection = async (name: string): Promise<number> => {
      try {
        // @ts-ignore - compat con versiones que soportan aggregate count()
        const agg = await (adminDb.collection(name) as any).count().get();
        // Firestore Admin devuelve data().count
        // @ts-ignore
        const v = agg.data().count as number | undefined;
        if (typeof v === 'number') return v;
      } catch {}
      const snap = await adminDb.collection(name).select().get();
      return snap.size;
    };

    const now = new Date();
    const nowIso = now.toISOString();

    // Totales
    const [totalPlayers, totalCoaches, analysesCount] = await Promise.all([
      countCollection('players'),
      countCollection('coaches'),
      countCollection('analyses'),
    ]);

    // Pagos approved: contar, revenue y usuarios que pagaron (distintos)
    const approvedSnap = await adminDb
      .collection('payments')
      .where('status', '==', 'approved')
      .get();
    let approvedPaymentsCount = 0;
    let revenueARS = 0;
    const payingUsersSet = new Set<string>();
    approvedSnap.forEach((doc) => {
      const p: any = doc.data();
      approvedPaymentsCount += 1;
      if (p.currency === 'ARS' && typeof p.amount === 'number') revenueARS += p.amount;
      if (p.userId) payingUsersSet.add(String(p.userId));
    });
    const payingUsers = payingUsersSet.size;

    // Suscripciones activas (History+)
    const activeSubsSet = new Set<string>();
    const walletsActiveSnap = await adminDb
      .collection('wallets')
      .where('historyPlusActive', '==', true)
      .get();
    walletsActiveSnap.forEach((doc) => {
      const w: any = doc.data();
      const validUntil = w.historyPlusValidUntil ? new Date(w.historyPlusValidUntil) : null;
      if (!validUntil || validUntil > now) {
        activeSubsSet.add(w.userId || doc.id);
      }
    });
    const activeSubscriptions = activeSubsSet.size;

    // Series semanales (últimas 8 semanas)
    const weeks: { start: Date; end: Date }[] = [];
    const startThisWeek = startOfWeek(now);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(startThisWeek);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      weeks.push({ start, end });
    }

    const weekly = [] as Array<{
      weekStart: string;
      paymentsCount: number;
      paymentsAmountARS: number;
      analysesCount: number;
    }>;

    // Para eficiencia, leer pagos y análisis solo del rango total cubierto
    const globalStart = weeks[0].start.toISOString();
    const globalEnd = weeks[weeks.length - 1].end.toISOString();

    const [paymentsRangeSnap, analysesRangeSnap] = await Promise.all([
      adminDb
        .collection('payments')
        .where('status', '==', 'approved')
        .where('createdAt', '>=', globalStart)
        .where('createdAt', '<', globalEnd)
        .get(),
      adminDb
        .collection('analyses')
        .where('createdAt', '>=', globalStart)
        .where('createdAt', '<', globalEnd)
        .get(),
    ]);

    const paymentsByWeek: Record<string, { count: number; ars: number }> = {};
    const analysesByWeek: Record<string, number> = {};

    const keyFor = (d: Date) => startOfWeek(d).toISOString().slice(0, 10);

    paymentsRangeSnap.forEach((doc) => {
      const p: any = doc.data();
      const created = p.createdAt ? new Date(p.createdAt) : null;
      if (!created) return;
      const k = keyFor(created);
      const bucket = (paymentsByWeek[k] ||= { count: 0, ars: 0 });
      bucket.count += 1;
      if (p.currency === 'ARS' && typeof p.amount === 'number') bucket.ars += p.amount;
    });

    analysesRangeSnap.forEach((doc) => {
      const a: any = doc.data();
      const created = a.createdAt ? new Date(a.createdAt) : null;
      if (!created) return;
      const k = keyFor(created);
      analysesByWeek[k] = (analysesByWeek[k] || 0) + 1;
    });

    for (const w of weeks) {
      const k = w.start.toISOString().slice(0, 10);
      const pm = paymentsByWeek[k] || { count: 0, ars: 0 };
      weekly.push({
        weekStart: k,
        paymentsCount: pm.count,
        paymentsAmountARS: pm.ars,
        analysesCount: analysesByWeek[k] || 0,
      });
    }

    return NextResponse.json({
      totalPlayers,
      totalCoaches,
      payingUsers,
      approvedPaymentsCount,
      revenueARS,
      activeSubscriptions,
      analysesCount,
      weekly,
      generatedAt: nowIso,
    });
  } catch (e: any) {
    console.error('metrics/overview error', e);
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}


