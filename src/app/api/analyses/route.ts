import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 Buscando análisis para usuario:', userId);

    // Obtener análisis del usuario desde Firestore
    const analysesSnapshot = await adminDb
      .collection('analyses')
      .where('playerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

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
