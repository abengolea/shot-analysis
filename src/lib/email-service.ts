import { adminAuth } from './firebase-admin';

/**
 * Servicio de email usando Firebase Admin SDK
 * Reemplaza las funciones de Firebase Auth Client que no funcionan
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envía email de verificación usando Firebase Admin SDK
 */
export async function sendVerificationEmail(userId: string, email: string): Promise<boolean> {
  try {
    console.log(`📧 Enviando email de verificación a: ${email}`);
    
    // Generar link de verificación
    const verificationLink = await adminAuth.generateEmailVerificationLink(email);
    
    // Crear contenido del email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verifica tu Email</h2>
        <p>Hola,</p>
        <p>Gracias por registrarte en Shot Analysis. Para completar tu registro, necesitamos verificar tu dirección de email.</p>
        <p>Haz clic en el botón de abajo para verificar tu email:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verificar Email
          </a>
        </div>
        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="word-break: break-all; color: #6b7280;">${verificationLink}</p>
        <p>Este enlace expirará en 24 horas.</p>
        <p>Saludos,<br>El equipo de Shot Analysis</p>
      </div>
    `;
    
    const textContent = `
      Verifica tu Email
      
      Hola,
      
      Gracias por registrarte en Shot Analysis. Para completar tu registro, necesitamos verificar tu dirección de email.
      
      Haz clic en este enlace para verificar tu email:
      ${verificationLink}
      
      Este enlace expirará en 24 horas.
      
      Saludos,
      El equipo de Shot Analysis
    `;
    
    // Enviar email usando Firebase Admin SDK
    await adminAuth.sendCustomVerificationEmail(email, {
      subject: 'Verifica tu Email - Shot Analysis',
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ Email de verificación enviado exitosamente a: ${email}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email de verificación:', error);
    return false;
  }
}

/**
 * Envía email de restablecimiento de contraseña usando Firebase Admin SDK
 */
export async function sendPasswordResetEmail(email: string): Promise<boolean> {
  try {
    console.log(`📧 Enviando email de restablecimiento a: ${email}`);
    
    // Generar link de restablecimiento
    const resetLink = await adminAuth.generatePasswordResetLink(email);
    
    // Crear contenido del email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Restablece tu Contraseña</h2>
        <p>Hola,</p>
        <p>Has solicitado restablecer tu contraseña en Shot Analysis.</p>
        <p>Haz clic en el botón de abajo para crear una nueva contraseña:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Restablecer Contraseña
          </a>
        </div>
        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="word-break: break-all; color: #6b7280;">${resetLink}</p>
        <p>Este enlace expirará en 1 hora.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
        <p>Saludos,<br>El equipo de Shot Analysis</p>
      </div>
    `;
    
    const textContent = `
      Restablece tu Contraseña
      
      Hola,
      
      Has solicitado restablecer tu contraseña en Shot Analysis.
      
      Haz clic en este enlace para crear una nueva contraseña:
      ${resetLink}
      
      Este enlace expirará en 1 hora.
      
      Si no solicitaste este cambio, puedes ignorar este email.
      
      Saludos,
      El equipo de Shot Analysis
    `;
    
    // Enviar email usando Firebase Admin SDK
    await adminAuth.sendCustomVerificationEmail(email, {
      subject: 'Restablece tu Contraseña - Shot Analysis',
      html: htmlContent,
      text: textContent
    });
    
    console.log(`✅ Email de restablecimiento enviado exitosamente a: ${email}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email de restablecimiento:', error);
    return false;
  }
}

/**
 * Envía email personalizado usando Firebase Admin SDK
 */
export async function sendCustomEmail(options: EmailOptions): Promise<boolean> {
  try {
    console.log(`📧 Enviando email personalizado a: ${options.to}`);
    
    // Enviar email usando Firebase Admin SDK
    await adminAuth.sendCustomVerificationEmail(options.to, {
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '')
    });
    
    console.log(`✅ Email personalizado enviado exitosamente a: ${options.to}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error enviando email personalizado:', error);
    return false;
  }
}



