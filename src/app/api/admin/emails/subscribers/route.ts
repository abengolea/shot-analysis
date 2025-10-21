import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/emails/subscribers
 * Obtiene la lista de todos los emails de usuarios (jugadores y entrenadores)
 * Requiere autenticación de admin
 */
export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación (esto debería coincidir con tu lógica de auth existente)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Admin SDK no inicializado' },
        { status: 500 }
      );
    }

    // Obtener jugadores activos
    const playersSnapshot = await adminDb
      .collection('players')
      .where('status', '==', 'active')
      .get();

    // Obtener entrenadores activos
    const coachesSnapshot = await adminDb
      .collection('coaches')
      .where('status', '==', 'active')
      .get();

    const subscribers: Array<{
      id: string;
      email: string;
      name: string;
      role: string;
    }> = [];

    // Agregar jugadores
    playersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.email) {
        subscribers.push({
          id: doc.id,
          email: data.email,
          name: data.name || 'Sin nombre',
          role: 'player'
        });
      }
    });

    // Agregar entrenadores
    coachesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.email) {
        subscribers.push({
          id: doc.id,
          email: data.email,
          name: data.name || 'Sin nombre',
          role: 'coach'
        });
      }
    });

    return NextResponse.json({
      total: subscribers.length,
      players: playersSnapshot.size,
      coaches: coachesSnapshot.size,
      subscribers
    });

  } catch (error: any) {
    console.error('Error obteniendo suscriptores:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

