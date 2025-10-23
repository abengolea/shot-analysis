import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminAvailable, getFirebaseAdminError } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ANALYSES] Endpoint llamado');
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    console.log('🔍 [ANALYSES] userId:', userId);
    
    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // Verificar Firebase Admin
    if (!isFirebaseAdminAvailable()) {
      console.error('❌ [ANALYSES] Firebase Admin no disponible:', getFirebaseAdminError());
      return NextResponse.json({
        analyses: [],
        count: 0,
        error: 'Base de datos no disponible',
        details: getFirebaseAdminError()
      });
    }

    console.log('🔍 [ANALYSES] Firebase Admin disponible, buscando...');

    // Buscar solo en colección 'analyses' por ahora
    const analysesSnapshot = await adminDb
      .collection('analyses')
      .where('playerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    console.log(`📊 [ANALYSES] Encontrados: ${analysesSnapshot.docs.length} documentos`);
    
    const analyses = analysesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ [ANALYSES] Retornando ${analyses.length} análisis`);
    
    return NextResponse.json({
      analyses: analyses,
      count: analyses.length,
      userId: userId
    });

  } catch (error) {
    console.error('❌ [ANALYSES] Error:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
        analyses: [],
        count: 0
      },
      { status: 500 }
    );
  }
}