import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: playerId } = params;

    if (!playerId) {
      return NextResponse.json(
        { error: 'ID de jugador es requerido' },
        { status: 400 }
      );
    }

        // Obtener el jugador desde Firestore
    const playerDoc = await adminDb
      .collection('players')
      .doc(playerId)
      .get();

    if (!playerDoc.exists) {
      return NextResponse.json(
        { error: 'Jugador no encontrado' },
        { status: 404 }
      );
    }

    const playerData = playerDoc.data();
    const player = {
      id: playerDoc.id,
      ...playerData
    };

        return NextResponse.json({
      player,
      success: true
    });

  } catch (error) {
    console.error('❌ Error al obtener jugador:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
