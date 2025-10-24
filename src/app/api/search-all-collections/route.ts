import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminAvailable, getFirebaseAdminError } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [SEARCH-ALL] Buscando en TODAS las colecciones');
    
    const userId = 'eGQanqjLcEfez0y7MfjtEqjOaNj2';
    
    if (!isFirebaseAdminAvailable()) {
      return NextResponse.json({ error: 'Firebase Admin no disponible' });
    }

    // Listar TODAS las colecciones
    const collections = await adminDb.listCollections();
    console.log('📋 Colecciones encontradas:', collections.map(c => c.id));
    
    const results: any = {};
    
    // Buscar en cada colección
    for (const collection of collections) {
      try {
        // Buscar por diferentes campos de usuario
        const queries = [
          { field: 'userId', value: userId },
          { field: 'playerId', value: userId },
          { field: 'user_id', value: userId },
          { field: 'player_id', value: userId },
          { field: 'email', value: 'abengolea1@gmail.com' }
        ];
        
        let totalFound = 0;
        const collectionResults: any[] = [];
        
        for (const query of queries) {
          try {
            const snapshot = await adminDb
              .collection(collection.id)
              .where(query.field, '==', query.value)
              .limit(10)
              .get();
            
            if (snapshot.docs.length > 0) {
              totalFound += snapshot.docs.length;
              collectionResults.push({
                query: query,
                count: snapshot.docs.length,
                sample: snapshot.docs[0].data()
              });
            }
          } catch (error) {
            // Ignorar errores de consulta (campos que no existen)
          }
        }
        
        if (totalFound > 0) {
          results[collection.id] = {
            totalFound,
            queries: collectionResults
          };
        }
        
      } catch (error) {
        console.log(`❌ Error en colección ${collection.id}:`, error);
      }
    }
    
    return NextResponse.json({
      userId: userId,
      email: 'abengolea1@gmail.com',
      collectionsFound: Object.keys(results).length,
      results: results,
      allCollections: collections.map(c => c.id)
    });
    
  } catch (error) {
    console.error('❌ [SEARCH-ALL] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
