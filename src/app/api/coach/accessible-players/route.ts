import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type PlayerSummary = {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
};

export async function GET(request: NextRequest) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const coachSnap = await adminDb.collection('coaches').doc(uid).get();
    const role = coachSnap.exists ? (coachSnap.data() as any)?.role : null;
    if (role !== 'coach' && role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const playerIds = new Set<string>();

    const unlockSnap = await adminDb.collection('coach_unlocks')
      .where('coachId', '==', uid)
      .get();
    for (const doc of unlockSnap.docs) {
      const data = doc.data() as any;
      if (data?.status === 'paid' && data?.playerId) {
        playerIds.add(String(data.playerId));
      }
    }

    const ownAnalysesSnap = await adminDb.collection('analyses')
      .where('coachId', '==', uid)
      .get();
    for (const doc of ownAnalysesSnap.docs) {
      const data = doc.data() as any;
      if (data?.playerId) {
        playerIds.add(String(data.playerId));
      }
    }

    if (playerIds.size === 0) {
      return NextResponse.json({ players: [] });
    }

    const players = await Promise.all(
      Array.from(playerIds).map(async (playerId) => {
        const snap = await adminDb.collection('players').doc(playerId).get();
        if (!snap.exists) return null;
        const data = snap.data() as any;
        const summary: PlayerSummary = {
          id: playerId,
          name: data?.name,
          displayName: data?.displayName,
          email: data?.email,
          avatarUrl: data?.avatarUrl,
        };
        return summary;
      })
    );

    return NextResponse.json({ players: players.filter(Boolean) });
  } catch (e) {
    console.error('Error listando jugadores con acceso:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
