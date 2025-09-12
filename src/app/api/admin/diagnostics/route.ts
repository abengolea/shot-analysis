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

    // Probar consulta de Firestore para detectar falta de índice o permisos
    let firestoreProbe: { ok: boolean; count?: number; needsIndex?: boolean; indexHint?: string; error?: string } = { ok: false };
    try {
      if (!adminDb) throw new Error('adminDb no inicializado');
      const q = await adminDb
        .collection('analyses')
        .where('playerId', '==', '__diagnostic_user__')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      firestoreProbe = { ok: true, count: q.size };
    } catch (e: any) {
      const msg = e?.message || String(e);
      const needsIndex = /index/i.test(msg) && /create/i.test(msg);
      firestoreProbe = {
        ok: false,
        needsIndex,
        indexHint: needsIndex ? 'Crear índice en collection analyses: playerId ASC, createdAt DESC' : undefined,
        error: msg,
      };
    }

    return NextResponse.json({
      adminInitialized,
      env,
      storageInfo,
      firestoreProbe,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error desconocido' }, { status: 500 });
  }
}


