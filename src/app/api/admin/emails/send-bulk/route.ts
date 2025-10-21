import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendBulkEmail } from '@/lib/email-service';

/**
 * POST /api/admin/emails/send-bulk
 * Envía un email masivo a todos los suscriptores activos
 * Body: { subject: string, html: string, text?: string, target: 'all' | 'players' | 'coaches' }
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación
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

    const body = await req.json();
    const { subject, html, text, target = 'all' } = body;

    if (!subject || !html) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: subject y html' },
        { status: 400 }
      );
    }

    // Obtener emails según el objetivo
    const emails: string[] = [];

    if (target === 'all' || target === 'players') {
      const playersSnapshot = await adminDb
        .collection('players')
        .where('status', '==', 'active')
        .get();

      playersSnapshot.forEach((doc) => {
        const email = doc.data().email;
        if (email && !emails.includes(email)) {
          emails.push(email);
        }
      });
    }

    if (target === 'all' || target === 'coaches') {
      const coachesSnapshot = await adminDb
        .collection('coaches')
        .where('status', '==', 'active')
        .get();

      coachesSnapshot.forEach((doc) => {
        const email = doc.data().email;
        if (email && !emails.includes(email)) {
          emails.push(email);
        }
      });
    }

    if (emails.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron destinatarios' },
        { status: 400 }
      );
    }

    // Enviar emails en lotes
    const result = await sendBulkEmail({
      to: emails,
      subject,
      html,
      text: text || undefined
    });

    // Registrar el envío en Firestore para historial
    await adminDb.collection('email_campaigns').add({
      subject,
      target,
      recipientsCount: emails.length,
      sentAt: new Date().toISOString(),
      success: result.success,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });

    return NextResponse.json({
      success: true,
      message: `Correos enviados exitosamente`,
      totalRecipients: emails.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    });

  } catch (error: any) {
    console.error('Error enviando emails masivos:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

