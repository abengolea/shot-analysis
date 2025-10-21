import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: analysisId } = await params;

    if (!analysisId) {
      return NextResponse.json(
        { error: 'ID de análisis es requerido' },
        { status: 400 }
      );
    }

        // Obtener el análisis específico desde Firestore
    const analysisDoc = await adminDb
      .collection('analyses')
      .doc(analysisId)
      .get();

    if (!analysisDoc.exists) {
      return NextResponse.json(
        { error: 'Análisis no encontrado' },
        { status: 404 }
      );
    }

    const analysisData = analysisDoc.data();
    const analysis = {
      id: analysisDoc.id,
      ...analysisData
    };

                return NextResponse.json(analysis);

  } catch (error) {
    console.error('❌ Error al obtener análisis:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
