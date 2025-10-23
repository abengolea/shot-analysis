import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, isFirebaseAdminAvailable, getFirebaseAdminError } from '@/lib/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  try {
    if (!adminAuth || !adminDb) return false;
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
    // Verificar que Firebase Admin esté disponible
    if (!isFirebaseAdminAvailable()) {
      console.error('❌ Firebase Admin no disponible:', getFirebaseAdminError());
      return NextResponse.json(
        { 
          error: 'Base de datos no disponible', 
          details: getFirebaseAdminError(),
          suggestion: 'Por favor, contacta al administrador del sistema'
        },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const adminFlag = searchParams.get('admin');
    const queueFlag = searchParams.get('queue');

    const requestIsAdmin = adminFlag === '1' || adminFlag === 'true' ? await isAdminRequest(request) : false;
    if (!userId && !requestIsAdmin) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // Cola IA para admin
    if ((queueFlag === 'ia') && await isAdminRequest(request)) {
      const qs = await adminDb.collection('ia_review_queue').orderBy('createdAt', 'desc').limit(500).get();
      const iaQueue = qs.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      return NextResponse.json({ iaQueue });
    }

    let analyses: any[] = [];
    
    if (requestIsAdmin) {
      console.log('🔍 Listando TODOS los análisis (admin)');
      const analysesSnapshot = await adminDb
        .collection('analyses')
        .orderBy('createdAt', 'desc')
        .limit(500)
        .get();
      
      analyses = analysesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
    } else {
      console.log(`🔍 Buscando análisis para userId: ${userId}`);
      
      // Buscar en colección 'analyses' (nuevos análisis)
      const analysesSnapshot = await adminDb
        .collection('analyses')
        .where('playerId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      console.log(`📊 Colección 'analyses': ${analysesSnapshot.docs.length} documentos encontrados`);
      
      const analysesFromAnalyses = analysesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'analyses' // Marcar origen para debugging
      })) as any[];
      
      // Buscar en colección 'video-analysis' (análisis legacy)
      const videoAnalysisSnapshot = await adminDb
        .collection('video-analysis')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      console.log(`📊 Colección 'video-analysis': ${videoAnalysisSnapshot.docs.length} documentos encontrados`);
      
      const analysesFromVideoAnalysis = videoAnalysisSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          playerId: data.userId, // Mapear userId a playerId para consistencia
          shotType: data.shotType || 'Tipo no especificado',
          status: data.analysis ? 'analyzed' : 'uploaded',
          createdAt: data.createdAt,
          videoUrl: data.videoUrl,
          analysis: data.analysis,
          metadata: data.metadata,
          originalFileName: data.originalFileName,
          source: 'video-analysis' // Marcar origen para debugging
        };
      }) as any[];
      
      // Combinar ambos resultados
      analyses = [...analysesFromAnalyses, ...analysesFromVideoAnalysis];
      
      // Ordenar por fecha de creación (más reciente primero)
      analyses.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      console.log(`📊 Análisis encontrados: ${analysesFromAnalyses.length} en 'analyses', ${analysesFromVideoAnalysis.length} en 'video-analysis', ${analyses.length} total`);
    }

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
