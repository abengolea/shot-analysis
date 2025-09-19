import { NextRequest, NextResponse } from 'next/server';
import { adminApp, adminDb, adminStorage, adminAuth } from '@/lib/firebase-admin';

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

export async function GET(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
    const projectId = (adminApp as any)?.options?.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_ADMIN_PROJECT_ID || null;
    const env = {
      FIREBASE_ADMIN_PROJECT_ID: !!process.env.FIREBASE_ADMIN_PROJECT_ID,
      FIREBASE_ADMIN_CLIENT_EMAIL: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      FIREBASE_ADMIN_PRIVATE_KEY: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      FIREBASE_ADMIN_STORAGE_BUCKET: process.env.FIREBASE_ADMIN_STORAGE_BUCKET || null,
      NODE_ENV: process.env.NODE_ENV || null,
      RESOLVED_PROJECT_ID: projectId,
    } as const;

    const adminInitialized = !!adminApp && !!adminDb;

    let storageInfo: { ok: boolean; bucket?: string; expected?: string; error?: string } = { ok: false };
    try {
      if (adminStorage) {
        const bucket = adminStorage.bucket();
        storageInfo = {
          ok: true,
          bucket: bucket.name,
          expected: process.env.FIREBASE_ADMIN_STORAGE_BUCKET || 'shotanalisys.appspot.com',
        };
      } else {
        storageInfo = { ok: false, error: 'adminStorage no inicializado' };
      }
    } catch (e: any) {
      storageInfo = { ok: false, error: e?.message || String(e) };
    }

    // Probar varias consultas de Firestore para detectar falta de índices o permisos
    type ProbeResult = { ok: boolean; count?: number; needsIndex?: boolean; indexHint?: string; error?: string };
    const runProbe = async (fn: () => Promise<FirebaseFirestore.QuerySnapshot>, indexHint: string): Promise<ProbeResult> => {
      try {
        const snap = await fn();
        return { ok: true, count: snap.size };
      } catch (e: any) {
        const msg = e?.message || String(e);
        const needsIndex = /index/i.test(msg) && /create/i.test(msg);
        return { ok: false, needsIndex, indexHint: needsIndex ? indexHint : undefined, error: msg };
      }
    };

    const probes: Record<string, ProbeResult> = {};
    if (!adminDb) throw new Error('adminDb no inicializado');

    // 1) analyses por playerId + createdAt desc
    probes.analysesByPlayer = await runProbe(
      () => adminDb.collection('analyses').where('playerId', '==', '__diagnostic_user__').orderBy('createdAt', 'desc').limit(1).get(),
      'analyses: playerId ASC, createdAt DESC'
    );

    // 2) analyses por coachId + createdAt desc
    probes.analysesByCoach = await runProbe(
      () => adminDb.collection('analyses').where('coachId', '==', '__diagnostic_coach__').orderBy('createdAt', 'desc').limit(1).get(),
      'analyses: coachId ASC, createdAt DESC'
    );

    // 3) payments por coachId + createdAt desc
    probes.paymentsByCoach = await runProbe(
      () => adminDb.collection('payments').where('coachId', '==', '__diagnostic_coach__').orderBy('createdAt', 'desc').limit(1).get(),
      'payments: coachId ASC, createdAt DESC'
    );

    // 4) payments por status + createdAt desc
    probes.paymentsByStatus = await runProbe(
      () => adminDb.collection('payments').where('status', '==', '__diagnostic_status__').orderBy('createdAt', 'desc').limit(1).get(),
      'payments: status ASC, createdAt DESC'
    );

    // 4b) payments por userId + createdAt desc
    probes.paymentsByUser = await runProbe(
      () => adminDb.collection('payments').where('userId', '==', '__diagnostic_user__').orderBy('createdAt', 'desc').limit(1).get(),
      'payments: userId ASC, createdAt DESC'
    );

    // 5) keyframeComments por keyframeUrl + createdAt desc (subcolección)
    probes.keyframeCommentsByUrl = await runProbe(
      () => adminDb.collection('analyses').doc('__diagnostic__').collection('keyframeComments').where('keyframeUrl', '==', '__url__').orderBy('createdAt', 'desc').limit(1).get(),
      'keyframeComments: keyframeUrl ASC, createdAt DESC'
    );

    // 6) keyframeAnnotations por keyframeUrl + createdAt desc (subcolección)
    probes.keyframeAnnotationsByUrl = await runProbe(
      () => adminDb.collection('analyses').doc('__diagnostic__').collection('keyframeAnnotations').where('keyframeUrl', '==', '__url__').orderBy('createdAt', 'desc').limit(1).get(),
      'keyframeAnnotations: keyframeUrl ASC, createdAt DESC'
    );

    return NextResponse.json({
      adminInitialized,
      env,
      storageInfo,
      probes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error desconocido' }, { status: 500 });
  }
}


