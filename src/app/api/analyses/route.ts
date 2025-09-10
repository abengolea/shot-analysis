import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const adminFlag = searchParams.get('admin');

    const requestIsAdmin = adminFlag === '1' || adminFlag === 'true' ? await isAdminRequest(request) : false;
    if (!userId && !requestIsAdmin) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    let analysesSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
    if (requestIsAdmin) {
      console.log('🔍 Listando TODOS los análisis (admin)');
      analysesSnapshot = await adminDb
        .collection('analyses')
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get();
    } else {
      console.log('🔍 Buscando análisis para usuario:', userId);
      analysesSnapshot = await adminDb
        .collection('analyses')
        .where('playerId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
    }

    const analyses = analysesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Encontrados ${analyses.length} análisis para usuario ${userId}`);

    return NextResponse.json({
      analyses,
      count: analyses.length
    });

  } catch (error) {
    console.error('❌ Error al obtener análisis:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
