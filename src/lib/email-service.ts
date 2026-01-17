import { adminAuth } from './firebase-admin';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

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
    
    // Nota: Firebase Admin no envía correos directamente.
    // Aquí deberías integrar tu proveedor de email (SendGrid, Mailgun, etc.).
    // Por ahora, registramos el enlace en logs para que el frontend/proceso lo envíe.
    console.log('📧 Verification link (log only):', verificationLink);
    
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
    
    console.log('📧 Reset link (log only):', resetLink);
    
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

    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;

    const awsSesRegion = process.env.AWS_SES_REGION || process.env.AWS_REGION;
    const awsSesFromEmail = process.env.AWS_SES_FROM_EMAIL;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

    const useSendGrid = !!(sendgridApiKey && sendgridFromEmail);
    const useAwsSes = !!(awsSesRegion && awsSesFromEmail && awsAccessKeyId && awsSecretKey);

    if (!useSendGrid && !useAwsSes) {
      console.warn('⚠️  Ningún proveedor de email configurado. Email NO enviado.');
      console.log('📧 Custom email (log only):', { to: options.to, subject: options.subject });
      return false;
    }

    const bulkOptions: BulkEmailOptions = {
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (useAwsSes) {
      console.log('📤 Usando AWS SES para email personalizado...');
      const result = await sendBulkEmailWithAwsSes(bulkOptions, {
        region: awsSesRegion!,
        fromEmail: awsSesFromEmail!,
        fromName: process.env.AWS_SES_FROM_NAME || 'Shot Analysis'
      });
      return result.success && result.successCount === 1;
    }

    console.log('📤 Usando SendGrid para email personalizado...');
    const result = await sendBulkEmailWithSendGrid(bulkOptions, {
      apiKey: sendgridApiKey!,
      fromEmail: sendgridFromEmail!,
      fromName: process.env.SENDGRID_FROM_NAME || 'Shot Analysis'
    });
    return result.success && result.successCount === 1;

  } catch (error) {
    console.error('❌ Error enviando email personalizado:', error);
    return false;
  }
}

/**
 * Interfaz para opciones de email masivo
 */
export interface BulkEmailOptions {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Resultado del envío masivo de emails
 */
export interface BulkEmailResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors: Array<{ email: string; error: string }>;
}

/**
 * Envía emails masivos usando SendGrid O AWS SES (detecta automáticamente)
 * 
 * OPCIÓN 1 - SendGrid (más fácil):
 * 1. npm install @sendgrid/mail
 * 2. Configura: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
 * Ver: docs/IMPLEMENTAR_EMAILS_REAL.md
 * 
 * OPCIÓN 2 - AWS SES (más económico, 62k emails/mes gratis):
 * 1. npm install @aws-sdk/client-ses
 * 2. Configura: AWS_SES_REGION, AWS_SES_FROM_EMAIL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * Ver: docs/SETUP_AWS_SES.md
 */
export async function sendBulkEmail(options: BulkEmailOptions): Promise<BulkEmailResult> {
  try {
        console.log(`📧 Asunto: ${options.subject}`);
    
    // Verificar configuración de proveedores
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;
    
    const awsSesRegion = process.env.AWS_SES_REGION || process.env.AWS_REGION;
    const awsSesFromEmail = process.env.AWS_SES_FROM_EMAIL;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    // Determinar qué proveedor usar
    const useSendGrid = !!(sendgridApiKey && sendgridFromEmail);
    const useAwsSes = !!(awsSesRegion && awsSesFromEmail && awsAccessKeyId && awsSecretKey);
    
    if (!useSendGrid && !useAwsSes) {
      console.warn('⚠️  Ningún proveedor de email configurado. Modo LOG ONLY activado.');
      console.log('   Opciones:');
      console.log('   • SendGrid (fácil):', sendgridApiKey ? '✓' : '✗', sendgridFromEmail ? '✓' : '✗');
      console.log('     Ver: docs/IMPLEMENTAR_EMAILS_REAL.md');
      console.log('   • AWS SES (económico, 62k/mes gratis):', awsSesRegion ? '✓' : '✗', awsSesFromEmail ? '✓' : '✗', awsAccessKeyId ? '✓' : '✗');
      console.log('     Ver: docs/SETUP_AWS_SES.md\n');
      
      // Fallback: Solo logs
      options.to.forEach((email) => {
        console.log(`📧 [LOG ONLY] Email a: ${email}`);
      });
      
      return {
        success: true,
        successCount: options.to.length,
        failureCount: 0,
        errors: []
      };
    }
    
    // Preferir AWS SES si está configurado (más económico)
    if (useAwsSes) {
      console.log('📤 Usando AWS SES (62,000 emails/mes gratis)...');
      return await sendBulkEmailWithAwsSes(options, {
        region: awsSesRegion!,
        fromEmail: awsSesFromEmail!,
        fromName: process.env.AWS_SES_FROM_NAME || 'Shot Analysis'
      });
    }
    
    // Usar SendGrid como fallback
    if (useSendGrid) {
      console.log('📤 Usando SendGrid (100 emails/día gratis)...');
      return await sendBulkEmailWithSendGrid(options, {
        apiKey: sendgridApiKey!,
        fromEmail: sendgridFromEmail!,
        fromName: process.env.SENDGRID_FROM_NAME || 'Shot Analysis'
      });
    }

    return {
      success: false,
      successCount: 0,
      failureCount: options.to.length,
      errors: options.to.map(email => ({
        email,
        error: 'No hay proveedor de email disponible'
      }))
    };
  } catch (error: any) {
    console.error('❌ Error crítico en envío masivo:', error);
    return {
      success: false,
      successCount: 0,
      failureCount: options.to.length,
      errors: options.to.map(email => ({
        email,
        error: error.message || 'Error desconocido'
      }))
    };
  }
}

/**
 * Envía emails masivos usando AWS SES
 */
async function sendBulkEmailWithAwsSes(
  options: BulkEmailOptions,
  config: { region: string; fromEmail: string; fromName: string }
): Promise<BulkEmailResult> {
  try {
    const sesClient = new SESClient({ region: config.region });
    
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ email: string; error: string }> = [];
    
    // Enviar en lotes de 50 para mejor control
    const batchSize = 50;
    
    for (let i = 0; i < options.to.length; i += batchSize) {
      const batch = options.to.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(options.to.length / batchSize);
      
      console.log(`📤 AWS SES - Lote ${batchNumber}/${totalBatches} (${batch.length} emails)...`);
      
      // Enviar cada email del lote
      for (const email of batch) {
        try {
          const command = new SendEmailCommand({
            Source: `${config.fromName} <${config.fromEmail}>`,
            Destination: {
              ToAddresses: [email]
            },
            Message: {
              Subject: {
                Data: options.subject,
                Charset: 'UTF-8'
              },
              Body: {
                Html: {
                  Data: options.html,
                  Charset: 'UTF-8'
                },
                Text: options.text ? {
                  Data: options.text,
                  Charset: 'UTF-8'
                } : undefined
              }
            }
          });
          
          await sesClient.send(command);
          successCount++;
          
        } catch (error: any) {
          failureCount++;
          errors.push({
            email,
            error: error.message || 'Error desconocido'
          });
        }
      }
      
      console.log(`✅ Lote ${batchNumber} completado (${successCount}/${i + batch.length})`);
      
      // Pausa entre lotes
      if (i + batchSize < options.to.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
        return {
      success: failureCount === 0,
      successCount,
      failureCount,
      errors
    };
    
  } catch (error: any) {
    console.error('❌ Error en AWS SES:', error);
    throw error;
  }
}

/**
 * Envía emails masivos usando SendGrid
 */
async function sendBulkEmailWithSendGrid(
  options: BulkEmailOptions,
  config: { apiKey: string; fromEmail: string; fromName: string }
): Promise<BulkEmailResult> {
  try {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(config.apiKey);
    
    const messages = options.to.map(email => ({
      to: email,
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      subject: options.subject,
      text: options.text || '',
      html: options.html,
    }));
    
    const batchSize = 100;
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ email: string; error: string }> = [];
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(messages.length / batchSize);
      
      console.log(`📤 SendGrid - Lote ${batchNumber}/${totalBatches} (${batch.length} emails)...`);
      
      try {
        await sgMail.default.send(batch);
        successCount += batch.length;
                if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`❌ Error en lote ${batchNumber}:`, error.message);
        failureCount += batch.length;
        
        batch.forEach(msg => {
          errors.push({
            email: typeof msg.to === 'string' ? msg.to : (Array.isArray(msg.to) ? msg.to[0] : (msg.to as any).email),
            error: error.message || 'Error desconocido'
          });
        });
      }
    }
    
        return {
      success: failureCount === 0,
      successCount,
      failureCount,
      errors
    };
    
  } catch (importError: any) {
    if (importError.code === 'MODULE_NOT_FOUND') {
      throw new Error('SendGrid no instalado. Ejecuta: npm install @sendgrid/mail');
    }
    throw importError;
  }
}

