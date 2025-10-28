import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { ITEM_WEIGHTS_TRES } from '@/lib/scoring';

// GET: Cargar pesos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shotType = searchParams.get('shotType') || 'tres';
    
    const docId = `scoringWeights_${shotType}`;
    const docRef = adminDb.collection('config').doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      // Si no existe, devolver pesos por defecto
      return NextResponse.json({
        weights: ITEM_WEIGHTS_TRES,
        lastModified: null,
      });
    }

    const data = docSnap.data();
    return NextResponse.json({
      weights: data?.weights || ITEM_WEIGHTS_TRES,
      lastModified: data?.updatedAt || null,
    });

  } catch (error) {
    console.error('Error cargando pesos:', error);
    return NextResponse.json(
      { error: 'Error al cargar pesos' },
      { status: 500 }
    );
  }
}

// POST: Guardar pesos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shotType, weights } = body;

    if (!shotType || !weights) {
      return NextResponse.json(
        { error: 'shotType y weights son requeridos' },
        { status: 400 }
      );
    }

    // Validar que los pesos sumen 100 (con margen de error mínimo)
    const total = Object.values(weights).reduce((sum: number, val: any) => sum + Number(val), 0);
    if (Math.abs(total - 100) > 0.1) {
      return NextResponse.json(
        { error: `Los pesos deben sumar 100%, actualmente suman ${total.toFixed(2)}%` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const docId = `scoringWeights_${shotType}`;
    
    await adminDb.collection('config').doc(docId).set({
      weights,
      shotType,
      updatedAt: now,
      createdAt: now,
    }, { merge: true });

        return NextResponse.json({
      success: true,
      lastModified: now,
    });

  } catch (error) {
    console.error('Error guardando pesos:', error);
    return NextResponse.json(
      { error: 'Error al guardar pesos' },
      { status: 500 }
    );
  }
}





