import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export type AdminAuthResult =
  | { ok: true; uid: string }
  | { ok: false; status: number; response: NextResponse };

/**
 * Verifica que la request tenga Bearer token y que el usuario sea admin (role en coaches o players).
 * Útil para proteger rutas de debug, email/test, etc.
 */
export async function requireAdminRequest(request: NextRequest): Promise<AdminAuthResult> {
  if (!adminAuth || !adminDb) {
    return {
      ok: false,
      status: 500,
      response: NextResponse.json(
        { error: 'Admin SDK no inicializado' },
        { status: 500 }
      ),
    };
  }
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return {
        ok: false,
        status: 401,
        response: NextResponse.json(
          { error: 'Authorization requerido (Bearer token)' },
          { status: 401 }
        ),
      };
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const [coachSnap, playerSnap] = await Promise.all([
      adminDb.collection('coaches').doc(uid).get(),
      adminDb.collection('players').doc(uid).get(),
    ]);
    const role = coachSnap.exists
      ? (coachSnap.data() as { role?: string })?.role
      : playerSnap.exists
        ? (playerSnap.data() as { role?: string })?.role
        : undefined;
    if (role !== 'admin') {
      return {
        ok: false,
        status: 403,
        response: NextResponse.json(
          { error: 'Solo administradores' },
          { status: 403 }
        ),
      };
    }
    return { ok: true, uid };
  } catch {
    return {
      ok: false,
      status: 401,
      response: NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      ),
    };
  }
}
