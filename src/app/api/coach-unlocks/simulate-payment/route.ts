import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Endpoint para simular que un pago se completó
 * Útil para desarrollo/testing sin necesidad de hacer pagos reales
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    
    // Solo permitir a admins o al mismo coach
    const body = await req.json();
    const { unlockId, analysisId, coachId, playerId } = body;

    if (!analysisId || !coachId) {
      return NextResponse.json(
        { error: 'analysisId y coachId son requeridos' },
        { status: 400 }
      );
    }

    // Buscar unlockId si no se proporciona
    let resolvedUnlockId = unlockId;
    if (!resolvedUnlockId) {
      resolvedUnlockId = `${analysisId}__${coachId}`;
    }

    // Verificar que el análisis existe y obtener datos
    const analysisSnap = await adminDb.collection('analyses').doc(analysisId).get();
    if (!analysisSnap.exists) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });
    }
    const analysisData = analysisSnap.data() as any;
    const resolvedPlayerId = playerId || analysisData?.playerId || decoded.uid;
    
    // Verificar que el jugador es dueño del análisis
    if (String(analysisData.playerId) !== String(resolvedPlayerId)) {
      return NextResponse.json({ error: 'No podés simular pago para este análisis' }, { status: 403 });
    }

    // Verificar que el coach existe y obtener datos
    const coachSnap = await adminDb.collection('coaches').doc(coachId).get();
    if (!coachSnap.exists) {
      return NextResponse.json({ error: 'Entrenador no encontrado' }, { status: 404 });
    }
    const coachData = coachSnap.data() as any;
    const parseCoachRate = (raw: unknown): number => {
      if (typeof raw === 'number') return raw;
      if (typeof raw !== 'string') return Number(raw);
      const trimmed = raw.trim();
      if (!trimmed) return NaN;
      const cleaned = trimmed.replace(/[^\d.,\s]/g, '');
      const noSpaces = cleaned.replace(/\s+/g, '');
      if (noSpaces.includes(',') && noSpaces.includes('.')) {
        const normalized = noSpaces.replace(/\./g, '').replace(',', '.');
        return Number(normalized);
      }
      if (noSpaces.includes(',') && !noSpaces.includes('.')) {
        if (/,\d{3}$/.test(noSpaces)) {
          return Number(noSpaces.replace(/,/g, ''));
        }
        return Number(noSpaces.replace(',', '.'));
      }
      if (noSpaces.includes('.') && !noSpaces.includes(',')) {
        if (/\.\d{3}$/.test(noSpaces)) {
          return Number(noSpaces.replace(/\./g, ''));
        }
      }
      return Number(noSpaces);
    };
    const coachRate = parseCoachRate(coachData?.ratePerAnalysis);
    if (!Number.isFinite(coachRate) || coachRate <= 0) {
      return NextResponse.json({ error: 'El entrenador no tiene una tarifa configurada' }, { status: 400 });
    }

    // Verificar si ya está pagado
    const coachAccess = (analysisData.coachAccess || {})[coachId];
    if (coachAccess && coachAccess.status === 'paid') {
      return NextResponse.json({ 
        error: `Ya pagaste para que ${coachData?.name || 'este entrenador'} analice tu lanzamiento. El entrenador ya tiene acceso al análisis.` 
      }, { status: 409 });
    }
    
    // Verificar que el unlock existe, si no, crearlo
    const unlockSnap = await adminDb.collection('coach_unlocks').doc(resolvedUnlockId).get();
    let unlockData = unlockSnap.exists ? unlockSnap.data() : null;
    
    // Si el unlock ya está pagado, retornar error
    if (unlockSnap.exists && unlockData?.status === 'paid') {
      return NextResponse.json({ 
        error: `Ya pagaste para que ${coachData?.name || 'este entrenador'} analice tu lanzamiento. El entrenador ya tiene acceso al análisis.` 
      }, { status: 409 });
    }
    
    if (!unlockSnap.exists) {
      // Crear el unlock si no existe
      const platformFeePercent = 30;
      const platformFee = Math.max(1, Math.round(coachRate * (platformFeePercent / 100)));
      const totalAmount = coachRate + platformFee;
      const createNowIso = new Date().toISOString();
      
      unlockData = {
        analysisId,
        coachId,
        playerId: resolvedPlayerId,
        status: 'pending',
        coachRate,
        platformFee,
        totalAmount,
        currency: 'ARS',
        coachName: coachData?.name || '',
        playerName: analysisData?.playerName || '',
        platformFeePercent,
        createdAt: createNowIso,
        updatedAt: createNowIso,
      };
      
      await adminDb.collection('coach_unlocks').doc(resolvedUnlockId).set(unlockData, { merge: true });
    }
    
    // Verificar permisos: solo el jugador dueño del análisis, el coach, o un admin
    if (decoded.uid !== resolvedPlayerId && decoded.uid !== coachId && decoded.uid !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();

    // Marcar unlock como pagado
    await adminDb.collection('coach_unlocks').doc(resolvedUnlockId).set(
      {
        status: 'paid',
        paymentId: `simulated_${Date.now()}`,
        paidAt: nowIso,
        updatedAt: nowIso,
        simulated: true, // Marca que fue simulado
      },
      { merge: true }
    );

    // Actualizar análisis con acceso del coach
    const simulatedPaymentId = `simulated_${Date.now()}`;
    await adminDb.collection('analyses').doc(analysisId).set(
      {
        coachAccess: {
          [coachId]: {
            status: 'paid',
            unlockedAt: nowIso,
            paymentId: simulatedPaymentId,
            unlockId: resolvedUnlockId,
          },
        },
      },
      { merge: true }
    );

    // Obtener datos para mensajes (ya tenemos coachSnap y coachData de antes, solo necesitamos playerData)
    const playerSnap = resolvedPlayerId ? await adminDb.collection('players').doc(resolvedPlayerId).get() : null;
    const playerData = playerSnap?.data() || null;

    // Notificar al coach
    if (coachId) {
      await adminDb.collection('messages').add({
        fromId: 'system',
        fromName: 'Chaaaas.com',
        toId: coachId,
        toCoachDocId: coachId, // Campo adicional para que aparezca en la notificación del coach
        toName: coachData?.name || coachId,
        text: `El jugador ${playerData?.name || resolvedPlayerId || ''} ya abonó la revisión manual del análisis ${analysisId || ''}. Podés ingresar y dejar tu devolución.`,
        analysisId: analysisId || null, // Guardar el ID del análisis para acceso directo
        createdAt: nowIso,
        read: false,
      });
    }

    // Notificar al jugador
    if (resolvedPlayerId) {
      await adminDb.collection('messages').add({
        fromId: 'system',
        fromName: 'Chaaaas.com',
        toId: resolvedPlayerId,
        toName: playerData?.name || resolvedPlayerId,
        text: `Tu pago ya fue abonado correctamente. Estamos esperando la devolución o análisis del entrenador.`,
        analysisId: analysisId || null, // Guardar el ID del análisis para acceso directo
        createdAt: nowIso,
        read: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Pago simulado correctamente. El análisis está desbloqueado para el entrenador.',
      unlockId: resolvedUnlockId,
      analysisId,
      coachId,
    });
  } catch (e) {
    console.error('Error simulando pago:', e);
    return NextResponse.json(
      { error: 'Error interno al simular pago' },
      { status: 500 }
    );
  }
}

