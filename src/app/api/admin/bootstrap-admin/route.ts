import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-bootstrap-token') || '';
    if (authHeader !== 'ADMIN_BOOTSTRAP_123') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'email y password requeridos' }, { status: 400 });
    }

    // Crear o actualizar usuario en Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      // Actualizar contraseña si se envía
      await adminAuth.updateUser(userRecord.uid, { password, emailVerified: true });
    } catch (e: any) {
      if (e?.errorInfo?.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({ email, password, emailVerified: true, disabled: false });
      } else {
        throw e;
      }
    }

    const uid = userRecord.uid;
    const now = new Date().toISOString();

    // Crear/actualizar documento en players con rol admin
    await adminDb.collection('players').doc(uid).set({
      id: uid,
      email,
      role: 'admin',
      status: 'active',
      updatedAt: now,
      createdAt: now,
      name: 'Admin',
    }, { merge: true });

    return NextResponse.json({ ok: true, uid });
  } catch (e: any) {
    console.error('bootstrap-admin error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Error' }, { status: 500 });
  }
}


