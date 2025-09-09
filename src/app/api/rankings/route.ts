import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// GET /api/rankings?category=U15&type=general&limit=50
// GET /api/rankings?category=U15&type=shot&shotType=tres&limit=50
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'U11' | 'U13' | 'U15' | 'U17' | 'U21' | 'Mayores' | null;
    const type = (searchParams.get('type') || 'general').toLowerCase();
    const shotType = (searchParams.get('shotType') || '').toLowerCase();
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

    if (!category) {
      return NextResponse.json({ error: 'category es requerido' }, { status: 400 });
    }

    const baseQuery = adminDb
      .collection('players')
      .where('publicRankingOptIn', '==', true)
      .where('publicCategory', '==', category);

    let query = baseQuery as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

    if (type === 'shot') {
      const key = shotType.includes('libre') ? 'libre' : shotType.includes('media') || shotType.includes('jump') ? 'media' : shotType.includes('tres') ? 'tres' : null;
      if (!key) {
        return NextResponse.json({ error: 'shotType inválido' }, { status: 400 });
      }
      query = query
        .orderBy(`publicBestByShot.${key}`, 'desc')
        .orderBy('publicGeneralAverageScore', 'desc')
        .limit(limit);
    } else {
      // general
      query = query
        .orderBy('publicGeneralAverageScore', 'desc')
        .orderBy('publicHighestScore', 'desc')
        .limit(limit);
    }

    const snap = await query.get();
    const players = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Sanitizar datos públicos
    const sanitized = players.map((p: any) => {
      const nameOrAlias = p.publicAlias || p.name || 'Jugador';
      const showCountry = p.publicShowCountry === true;
      const showClub = p.publicShowClub === true;
      return {
        id: p.id,
        displayName: nameOrAlias,
        category: p.publicCategory,
        publicHighestScore: p.publicHighestScore ?? null,
        publicGeneralAverageScore: p.publicGeneralAverageScore ?? null,
        publicBestByShot: p.publicBestByShot || {},
        publicBestDates: p.publicBestDates || {},
        country: showCountry ? p.country || null : null,
        club: showClub ? p.club || null : null,
        avatarUrl: p.avatarUrl || null,
      };
    });

    return NextResponse.json({ category, type, shotType, limit, players: sanitized });
  } catch (error) {
    console.error('❌ Error en rankings:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}


