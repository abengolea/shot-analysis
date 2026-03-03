import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type ShotTypesMaintenance = {
  tres: boolean;
  media: boolean;
  libre: boolean;
};

type MaintenanceConfig = {
  enabled: boolean;
  title: string;
  message: string;
  updatedAt: string;
  updatedBy: string;
  shotTypesMaintenance: ShotTypesMaintenance;
};

const DEFAULT_CONFIG: MaintenanceConfig = {
  enabled: false,
  title: '🔧 SITIO EN MANTENIMIENTO',
  message: 'Estamos ajustando variables importantes del sistema.\n\nEl análisis de lanzamientos está temporalmente deshabilitado.\n\nVolveremos pronto con mejoras. ¡Gracias por tu paciencia!',
  updatedAt: '',
  updatedBy: '',
  shotTypesMaintenance: {
    tres: false,
    media: false,
    libre: false,
  },
};

async function requireAdmin(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return false;
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const playerSnap = await adminDb.collection('players').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : (playerSnap.exists ? (playerSnap.data() as any)?.role : undefined);
    return role === 'admin';
  } catch {
    return false;
  }
}

function normalizeShotTypes(input: any): ShotTypesMaintenance {
  const base = { ...DEFAULT_CONFIG.shotTypesMaintenance };
  if (input && typeof input === 'object') {
    base.tres = Boolean(input.tres);
    base.media = Boolean(input.media);
    base.libre = Boolean(input.libre);
  }
  return base;
}

export async function GET() {
  try {
    const ref = adminDb.collection('config').doc('maintenance');
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as Partial<MaintenanceConfig>) : {};
    const config: MaintenanceConfig = {
      ...DEFAULT_CONFIG,
      ...data,
      shotTypesMaintenance: normalizeShotTypes(data?.shotTypesMaintenance),
    };
    return NextResponse.json(config);
  } catch (e) {
    console.error('GET maintenance error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const body = await req.json();
    const config: MaintenanceConfig = {
      ...DEFAULT_CONFIG,
      enabled: Boolean(body?.enabled),
      title: typeof body?.title === 'string' ? body.title : DEFAULT_CONFIG.title,
      message: typeof body?.message === 'string' ? body.message : DEFAULT_CONFIG.message,
      updatedAt: new Date().toISOString(),
      updatedBy: typeof body?.updatedBy === 'string' ? body.updatedBy : DEFAULT_CONFIG.updatedBy,
      shotTypesMaintenance: normalizeShotTypes(body?.shotTypesMaintenance),
    };
    await adminDb.collection('config').doc('maintenance').set(config, { merge: true });
    return NextResponse.json({ ok: true, message: 'Configuración guardada', config });
  } catch (e) {
    console.error('POST maintenance error:', e);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
