import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { coachName, newRate } = body;

    if (!coachName || typeof newRate !== 'number' || newRate <= 0) {
      return NextResponse.json(
        { error: 'coachName y newRate (número > 0) son requeridos' },
        { status: 400 }
      );
    }

    console.log(`🔍 Buscando entrenador "${coachName}" para actualizar tarifa a $${newRate} ARS...`);

    // Buscar por nombre
    const coachesSnapshot = await adminDb
      .collection('coaches')
      .where('name', '==', coachName)
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      // Intentar buscar por email si el nombre no funciona
      const emailSnapshot = await adminDb
        .collection('coaches')
        .where('email', '==', 'abengolea1@gmail.com')
        .limit(1)
        .get();

      if (emailSnapshot.empty) {
        return NextResponse.json(
          { error: `No se encontró el entrenador "${coachName}"` },
          { status: 404 }
        );
      }

      const coachDoc = emailSnapshot.docs[0];
      const coachId = coachDoc.id;
      const coachData = coachDoc.data();

      await adminDb.collection('coaches').doc(coachId).update({
        ratePerAnalysis: newRate,
        updatedAt: new Date().toISOString(),
      });

      const platformFee = Math.round(newRate * 0.3);
      const totalAmount = newRate + platformFee;

      return NextResponse.json({
        success: true,
        message: `Tarifa actualizada para ${coachData.name || coachName}`,
        coachId,
        coachName: coachData.name || coachName,
        oldRate: coachData.ratePerAnalysis || 'No configurada',
        newRate,
        platformFee,
        totalAmount,
      });
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachId = coachDoc.id;
    const coachData = coachDoc.data();

    const oldRate = coachData.ratePerAnalysis || null;

    await adminDb.collection('coaches').doc(coachId).update({
      ratePerAnalysis: newRate,
      updatedAt: new Date().toISOString(),
    });

    const platformFee = Math.round(newRate * 0.3);
    const totalAmount = newRate + platformFee;

    return NextResponse.json({
      success: true,
      message: `Tarifa actualizada para ${coachData.name || coachName}`,
      coachId,
      coachName: coachData.name || coachName,
      oldRate,
      newRate,
      platformFee,
      totalAmount,
      breakdown: {
        coachRate: newRate,
        platformFeePercent: 30,
        platformFee,
        totalAmount,
      },
    });
  } catch (error: any) {
    console.error('Error actualizando tarifa:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}


