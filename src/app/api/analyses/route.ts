import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

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

    let analyses = analysesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    // Enriquecer con datos del jugador (solo para admin)
    if (requestIsAdmin) {
      const playerIds = Array.from(new Set(analyses.map((a: any) => String(a.playerId || '')).filter(Boolean)));

      const idToPlayer: Record<string, { name?: string; email?: string }> = {};
      // Firestore permite hasta 10 IDs en consultas 'in'
      const chunkSize = 10;
      for (let i = 0; i < playerIds.length; i += chunkSize) {
        const chunk = playerIds.slice(i, i + chunkSize);
        try {
          const snap = await adminDb
            .collection('players')
            .where(FieldPath.documentId(), 'in', chunk)
            .get();
          snap.docs.forEach(d => {
            const data = d.data() as any;
            idToPlayer[d.id] = { name: data?.name, email: data?.email };
          });
        } catch (e) {
          // Fallback: si falla la consulta 'in' por cualquier razón, intentar gets individuales
          await Promise.all(
            chunk.map(async (pid) => {
              try {
                const d = await adminDb.collection('players').doc(pid).get();
                if (d.exists) {
                  const data = d.data() as any;
                  idToPlayer[pid] = { name: data?.name, email: data?.email };
                }
              } catch {
                // ignorar
              }
            })
          );
        }
      }

      analyses = analyses.map((a: any) => {
        const info = idToPlayer[String(a.playerId || '')] || {};
        return { ...a, playerName: info.name || null, playerEmail: info.email || null };
      });
    }

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
