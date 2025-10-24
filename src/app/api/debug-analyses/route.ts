import { NextRequest, NextResponse } from 'next/server';
import { adminDb, isFirebaseAdminAvailable, getFirebaseAdminError } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Iniciando debug de análisis');
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'eGQanqjLcEfez0y7MfjtEqjOaNj2';
    
    console.log('🔍 [DEBUG] userId:', userId);
    
    if (!isFirebaseAdminAvailable()) {
      return NextResponse.json({ error: 'Firebase Admin no disponible' });
    }

    // Debug colección 'analyses'
    const analysesSnapshot = await adminDb
      .collection('analyses')
      .where('playerId', '==', userId)
      .get();
    
    const analysesData = analysesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Debug colección 'video-analysis'
    const videoAnalysisSnapshot = await adminDb
      .collection('video-analysis')
      .where('userId', '==', userId)
      .get();
    
    const videoAnalysisData = videoAnalysisSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      userId: userId,
      analyses: {
        count: analysesData.length,
        data: analysesData
      },
      videoAnalysis: {
        count: videoAnalysisData.length,
        data: videoAnalysisData
      },
      total: analysesData.length + videoAnalysisData.length
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
