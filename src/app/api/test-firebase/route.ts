import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminAvailable, getFirebaseAdminError } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [TEST] Iniciando test de Firebase');
    
    // Test 1: Verificar Firebase Admin
    const isAvailable = isFirebaseAdminAvailable();
    const error = getFirebaseAdminError();
    
    console.log('🔍 [TEST] Firebase Admin disponible:', isAvailable);
    console.log('🔍 [TEST] Error:', error);
    
    if (!isAvailable) {
      return NextResponse.json({
        success: false,
        error: error,
        step: 'firebase-admin-check'
      });
    }
    
    // Test 2: Verificar conexión a Firestore
    console.log('🔍 [TEST] Probando conexión a Firestore...');
    
    // Test simple: contar documentos en colección 'analyses'
    const analysesSnapshot = await adminDb
      .collection('analyses')
      .limit(1)
      .get();
    
    console.log('🔍 [TEST] Conexión a Firestore exitosa');
    console.log('🔍 [TEST] Documentos en analyses:', analysesSnapshot.docs.length);
    
    // Test 3: Buscar análisis del usuario específico
    const userId = 'eGQanqjLcEfez0y7MfjtEqjOaNj2';
    console.log('🔍 [TEST] Buscando análisis para userId:', userId);
    
    const userAnalysesSnapshot = await adminDb
      .collection('analyses')
      .where('playerId', '==', userId)
      .limit(5)
      .get();
    
    console.log('🔍 [TEST] Análisis encontrados para usuario:', userAnalysesSnapshot.docs.length);
    
    return NextResponse.json({
      success: true,
      firebaseAdmin: isAvailable,
      firestoreConnection: true,
      totalAnalyses: analysesSnapshot.docs.length,
      userAnalyses: userAnalysesSnapshot.docs.length,
      userId: userId
    });
    
  } catch (error) {
    console.error('❌ [TEST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      step: 'firestore-query'
    }, { status: 500 });
  }
}
