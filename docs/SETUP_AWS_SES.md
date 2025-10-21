# 📧 Configuración de AWS SES para Emails Masivos

## Por qué AWS SES?

- ✅ **62,000 emails GRATIS por mes** (vs 3,000 de SendGrid)
- ✅ **$0.10 por 1,000 emails** después del tier gratuito
- ✅ Ya usas AWS (tienes Rekognition configurado)
- ✅ Excelente deliverability
- ✅ Escalable a millones de emails

---

## 🚀 Configuración Paso a Paso

### 1️⃣ Habilitar AWS SES (3 minutos)

1. Ve a la **Consola de AWS**: https://console.aws.amazon.com
2. En la barra de búsqueda, escribe **"SES"** o **"Simple Email Service"**
3. Haz clic en **Amazon Simple Email Service**
4. **IMPORTANTE**: Selecciona la región más cercana a tus usuarios
   - Para Latinoamérica: **us-east-1 (N. Virginia)**
   - Para Europa: **eu-west-1 (Irlanda)**

---

### 2️⃣ Salir del Sandbox (IMPORTANTE)

Por defecto, AWS SES está en modo "Sandbox" que solo permite:
- Enviar a emails verificados
- Máximo 200 emails/día

**Para enviar a cualquier email y tener el límite completo:**

1. En AWS SES, ve a **Account dashboard**
2. Busca **"Sending statistics"**
3. Si dice **"Sandbox"**, haz clic en **"Request production access"**
4. Completa el formulario:
   - **Mail Type**: Transactional
   - **Website URL**: Tu sitio web (o en desarrollo)
   - **Use case description**:
     ```
     Platform for basketball shot analysis. Sending transactional and 
     marketing emails to users who registered on our platform. 
     Emails include: account notifications, analysis results, and 
     platform updates. Users can unsubscribe at any time.
     ```
   - **Compliance**: Confirma que seguirás las políticas
5. **Enviar request**

**Aprobación**: Normalmente se aprueba en 24 horas (a veces minutos).

---

### 3️⃣ Verificar Email o Dominio

#### Opción A: Verificar Email Individual (Más Rápido)

1. Ve a **Configuration** → **Verified identities**
2. Haz clic en **Create identity**
3. Selecciona **Email address**
4. Ingresa tu email: `noreply@tudominio.com` (o tu Gmail)
5. Haz clic en **Create identity**
6. **Ve a tu bandeja** y verifica el email

#### Opción B: Verificar Dominio Completo (Recomendado)

1. Ve a **Configuration** → **Verified identities**
2. Haz clic en **Create identity**
3. Selecciona **Domain**
4. Ingresa tu dominio: `tudominio.com`
5. AWS te dará registros DNS (CNAME) para agregar
6. Agrega estos registros en tu proveedor de DNS:
   - Si usas **Cloudflare**: DNS → Add record
   - Si usas **GoDaddy**: DNS Management
   - Si usas **Namecheap**: Advanced DNS
7. Espera 10-30 minutos para propagación

**Ventaja del dominio**: Puedes enviar desde cualquier email @tudominio.com

---

### 4️⃣ Obtener Credenciales (2 minutos)

Tienes dos opciones:

#### Opción A: Usar tus credenciales AWS existentes

Si ya tienes configurado AWS para Rekognition, puedes usar las mismas credenciales.
Solo asegúrate de que el usuario IAM tenga el permiso **"ses:SendEmail"**.

1. Ve a **IAM** → **Users** → Tu usuario
2. Agrega la política **"AmazonSESFullAccess"**

Ya tienes las credenciales en tu `.env.local` como:
```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

#### Opción B: Crear credenciales específicas para SES

1. Ve a **IAM** → **Users** → **Create user**
2. Nombre: `shot-analysis-ses`
3. Access type: **Programmatic access**
4. Permisos: **AmazonSESFullAccess**
5. Copia las credenciales

---

### 5️⃣ Instalar AWS SES SDK

```bash
npm install @aws-sdk/client-ses
```

---

### 6️⃣ Configurar Variables de Entorno

Edita tu `.env.local`:

```env
# AWS SES Configuration
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@tudominio.com
AWS_SES_FROM_NAME=Shot Analysis

# Si no tienes AWS credentials ya configuradas, agrégalas:
# AWS_ACCESS_KEY_ID=tu_access_key
# AWS_SECRET_ACCESS_KEY=tu_secret_key
```

**Nota**: Si ya tienes `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` configuradas para Rekognition, no necesitas agregarlas de nuevo.

---

### 7️⃣ Actualizar el Código

El código ya está preparado para usar AWS SES. Ver más abajo.

---

## 📝 Código Actualizado

### Actualizar `src/lib/email-service.ts`

Agregar al inicio del archivo (después de los imports existentes):

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
```

Y reemplazar la función `sendBulkEmail` con esta versión que soporta tanto SendGrid como AWS SES:

```typescript
export async function sendBulkEmail(options: BulkEmailOptions): Promise<BulkEmailResult> {
  try {
    console.log(`📧 Iniciando envío masivo a ${options.to.length} destinatarios`);
    console.log(`📧 Asunto: ${options.subject}`);
    
    // Verificar configuración de email providers
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const sendgridFromEmail = process.env.SENDGRID_FROM_EMAIL;
    
    const awsSesRegion = process.env.AWS_SES_REGION;
    const awsSesFromEmail = process.env.AWS_SES_FROM_EMAIL;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    // Determinar qué proveedor usar
    const useSendGrid = sendgridApiKey && sendgridFromEmail;
    const useAwsSes = awsSesRegion && awsSesFromEmail && awsAccessKeyId && awsSecretKey;
    
    if (!useSendGrid && !useAwsSes) {
      console.warn('⚠️  Ningún proveedor de email configurado. Modo LOG ONLY activado.');
      console.log('   Configura SendGrid O AWS SES:');
      console.log('   SendGrid:', sendgridApiKey ? '✓' : '✗', sendgridFromEmail ? '✓' : '✗');
      console.log('   AWS SES:', awsSesRegion ? '✓' : '✗', awsSesFromEmail ? '✓' : '✗', awsAccessKeyId ? '✓' : '✗');
      console.log('   Ver: docs/SETUP_AWS_SES.md o docs/IMPLEMENTAR_EMAILS_REAL.md\n');
      
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
    
    // Usar AWS SES (preferido si está configurado)
    if (useAwsSes) {
      console.log('📤 Usando AWS SES para envío...');
      return await sendBulkEmailWithAwsSes(options, {
        region: awsSesRegion!,
        fromEmail: awsSesFromEmail!,
        fromName: process.env.AWS_SES_FROM_NAME || 'Shot Analysis'
      });
    }
    
    // Usar SendGrid (fallback)
    if (useSendGrid) {
      console.log('📤 Usando SendGrid para envío...');
      return await sendBulkEmailWithSendGrid(options, {
        apiKey: sendgridApiKey!,
        fromEmail: sendgridFromEmail!,
        fromName: process.env.SENDGRID_FROM_NAME || 'Shot Analysis'
      });
    }
    
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

// Función auxiliar para AWS SES
async function sendBulkEmailWithAwsSes(
  options: BulkEmailOptions,
  config: { region: string; fromEmail: string; fromName: string }
): Promise<BulkEmailResult> {
  try {
    const sesClient = new SESClient({ region: config.region });
    
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ email: string; error: string }> = [];
    
    // AWS SES puede enviar a múltiples destinatarios pero es mejor uno por uno
    // para tener mejor control de errores
    const batchSize = 50; // Enviar en lotes de 50
    
    for (let i = 0; i < options.to.length; i += batchSize) {
      const batch = options.to.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(options.to.length / batchSize);
      
      console.log(`📤 Enviando lote ${batchNumber}/${totalBatches} (${batch.length} emails)...`);
      
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
      
      // Pequeña pausa entre lotes
      if (i + batchSize < options.to.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Envío AWS SES completado: ${successCount} exitosos, ${failureCount} fallidos`);
    
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

// Función auxiliar para SendGrid (la que ya tenías)
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
      
      console.log(`📤 Enviando lote ${batchNumber}/${totalBatches} (${batch.length} emails)...`);
      
      try {
        await sgMail.default.send(batch);
        successCount += batch.length;
        console.log(`✅ Lote ${batchNumber} enviado exitosamente`);
        
        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`❌ Error en lote ${batchNumber}:`, error.message);
        failureCount += batch.length;
        
        batch.forEach(msg => {
          errors.push({
            email: typeof msg.to === 'string' ? msg.to : (Array.isArray(msg.to) ? msg.to[0] : msg.to.email),
            error: error.message || 'Error desconocido'
          });
        });
      }
    }
    
    console.log(`✅ Envío SendGrid completado: ${successCount} exitosos, ${failureCount} fallidos`);
    
    return {
      success: failureCount === 0,
      successCount,
      failureCount,
      errors
    };
    
  } catch (importError: any) {
    if (importError.code === 'MODULE_NOT_FOUND') {
      console.error('❌ SendGrid no instalado. Ejecuta: npm install @sendgrid/mail');
      throw new Error('SendGrid no instalado');
    }
    throw importError;
  }
}
```

---

## ✅ Verificar Configuración

Crea este script para verificar AWS SES:

```bash
node scripts/verify-email-config.js
```

El script ya detectará automáticamente si usas AWS SES o SendGrid.

---

## 🧪 Probar AWS SES

### Mientras estás en Sandbox:

Puedes probar enviando emails solo a direcciones verificadas:

1. Verifica tu propio email en AWS SES
2. Envía un test desde el admin panel a ti mismo
3. Si funciona, solicita salir del Sandbox

### Después de salir del Sandbox:

Podrás enviar a cualquier email sin restricciones.

---

## 📊 Límites de AWS SES

| Concepto | Límite Inicial | Expandible |
|----------|----------------|------------|
| Emails/día | 200 (Sandbox) → 50,000+ (Producción) | Sí, automático |
| Rate | 1 email/seg (Sandbox) → 14/seg+ (Producción) | Sí, solicitable |
| Tier Gratuito | 62,000 emails/mes | Permanente si envías desde EC2 |
| Costo después | $0.10 por 1,000 | - |

**Los límites aumentan automáticamente según tu uso y reputación.**

---

## 🎯 Mejores Prácticas

### 1. Warm-up del dominio
- Día 1-3: 50-100 emails/día
- Día 4-7: 200-500 emails/día
- Día 8-14: 1,000-2,000 emails/día
- Día 15+: Aumenta gradualmente

### 2. Monitorear métricas
- Ve a AWS SES → Reputation metrics
- Mantén bounce rate < 5%
- Mantén complaint rate < 0.1%

### 3. Configurar feedback loops
- AWS SES → Configuration → Configuration sets
- Configura SNS para recibir bounces y complaints

---

## 🔄 Comparación Final

| Característica | SendGrid Free | AWS SES |
|----------------|---------------|---------|
| Emails gratis/mes | 3,000 | 62,000 |
| Costo 100k emails | $89.95 | $3.80 |
| Setup | 5 min | 10 min |
| Salir Sandbox | No aplica | 24 hrs |
| Dashboard | Mejor | Básico |
| Soporte | Email | AWS Support |

---

## 🚀 Conclusión

**Recomendación**: 
- **Desarrollo/Testing**: SendGrid (más fácil)
- **Producción**: AWS SES (95% más barato)
- **O usa ambos**: El código soporta los dos simultáneamente

---

**¿Necesitas ayuda?** AWS tiene excelente documentación: https://docs.aws.amazon.com/ses/

