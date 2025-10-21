# 📧 Guía de Implementación: Envío Real de Emails con SendGrid

## Paso a Paso Completo

### 1️⃣ Crear Cuenta en SendGrid (5 minutos)

1. Ve a https://sendgrid.com/
2. Haz clic en "Start for free"
3. Completa el registro:
   - Email
   - Contraseña
   - Nombre de empresa: "Shot Analysis"
4. Verifica tu email
5. Completa el cuestionario inicial (elige "Marketing" o "Transactional")

**Plan Gratuito**: 100 emails/día gratis para siempre

---

### 2️⃣ Obtener API Key (2 minutos)

1. Una vez dentro, ve a **Settings** → **API Keys**
2. Haz clic en **"Create API Key"**
3. Configuración:
   - Name: `shot-analysis-bulk-emails`
   - API Key Permissions: **Full Access** (o solo "Mail Send")
4. Haz clic en **"Create & View"**
5. **IMPORTANTE**: Copia la API key AHORA (solo se muestra una vez)
   - Se ve algo así: `SG.abc123xyz...`

---

### 3️⃣ Verificar Remitente (10 minutos)

**IMPORTANTE**: SendGrid requiere verificar el email desde el que enviarás.

#### Opción A: Single Sender Verification (Más Rápido)

1. Ve a **Settings** → **Sender Authentication**
2. Haz clic en **"Verify a Single Sender"**
3. Completa el formulario:
   - From Name: `Shot Analysis`
   - From Email: `tu-email@gmail.com` (o el que uses)
   - Reply To: (mismo email)
   - Company Address: Tu dirección
4. Haz clic en **"Create"**
5. **Ve a tu email y verifica** el link que te envían

#### Opción B: Domain Authentication (Recomendado para Producción)

1. Ve a **Settings** → **Sender Authentication**
2. Haz clic en **"Authenticate Your Domain"**
3. Sigue las instrucciones para agregar registros DNS
4. Espera la verificación (puede tardar hasta 48 horas)

**Por ahora usa la Opción A para probar rápido.**

---

### 4️⃣ Instalar Dependencia

En tu terminal:

```bash
npm install @sendgrid/mail
```

---

### 5️⃣ Configurar Variables de Entorno

Edita tu archivo `.env.local`:

```env
# Agrega estas líneas al final

# SendGrid Configuration
SENDGRID_API_KEY=SG.tu_clave_aqui_que_copiaste
SENDGRID_FROM_EMAIL=tu-email-verificado@gmail.com
SENDGRID_FROM_NAME=Shot Analysis
```

**Reemplaza**:
- `SG.tu_clave_aqui_que_copiaste` con tu API key real
- `tu-email-verificado@gmail.com` con el email que verificaste

---

### 6️⃣ Actualizar el Código

Ahora actualiza el archivo de servicio de email.

El código completo está más abajo ⬇️

---

## 📝 Código Completo

### Archivo: `src/lib/email-service.ts`

Reemplaza la función `sendBulkEmail` con esta versión completa:

```typescript
import sgMail from '@sendgrid/mail';

// ... resto del archivo sin cambios ...

/**
 * Envía emails masivos a múltiples destinatarios usando SendGrid
 */
export async function sendBulkEmail(options: BulkEmailOptions): Promise<BulkEmailResult> {
  try {
    console.log(`📧 Iniciando envío masivo a ${options.to.length} destinatarios`);
    
    // Verificar configuración
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const fromName = process.env.SENDGRID_FROM_NAME || 'Shot Analysis';
    
    if (!apiKey || !fromEmail) {
      console.error('❌ SendGrid no configurado. Faltan variables de entorno.');
      console.log('   SENDGRID_API_KEY:', apiKey ? '✓' : '✗');
      console.log('   SENDGRID_FROM_EMAIL:', fromEmail ? '✓' : '✗');
      
      // Fallback a logs
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
    
    // Configurar SendGrid
    sgMail.setApiKey(apiKey);
    
    // Crear mensajes
    const messages = options.to.map(email => ({
      to: email,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: options.subject,
      text: options.text || '',
      html: options.html,
    }));
    
    // Enviar en lotes de 100 (límite de SendGrid por request)
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
        await sgMail.send(batch);
        successCount += batch.length;
        console.log(`✅ Lote ${batchNumber} enviado exitosamente`);
        
        // Pequeña pausa entre lotes para evitar rate limits
        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`❌ Error en lote ${batchNumber}:`, error.message);
        failureCount += batch.length;
        
        // Registrar errores individuales
        batch.forEach(msg => {
          errors.push({
            email: typeof msg.to === 'string' ? msg.to : msg.to[0],
            error: error.message || 'Error desconocido'
          });
        });
      }
    }
    
    console.log(`✅ Envío masivo completado: ${successCount} exitosos, ${failureCount} fallidos`);
    
    return {
      success: failureCount === 0,
      successCount,
      failureCount,
      errors
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
```

---

## ✅ Verificar la Instalación

### Prueba 1: Verificar Variables de Entorno

Crea un archivo temporal para probar:

```typescript
// test-sendgrid-config.ts
console.log('🔍 Verificando configuración de SendGrid...\n');

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;
const fromName = process.env.SENDGRID_FROM_NAME;

console.log('SENDGRID_API_KEY:', apiKey ? `✓ Configurado (${apiKey.substring(0, 10)}...)` : '✗ NO configurado');
console.log('SENDGRID_FROM_EMAIL:', fromEmail ? `✓ ${fromEmail}` : '✗ NO configurado');
console.log('SENDGRID_FROM_NAME:', fromName ? `✓ ${fromName}` : '○ Usando default');

if (apiKey && fromEmail) {
  console.log('\n✅ SendGrid está correctamente configurado');
} else {
  console.log('\n❌ Faltan configuraciones. Revisa tu .env.local');
}
```

Ejecuta:
```bash
node -r dotenv/config test-sendgrid-config.ts
```

### Prueba 2: Enviar Email de Prueba

Una vez configurado, prueba desde el panel de admin:

1. Reinicia tu servidor:
   ```bash
   npm run dev
   ```

2. Ve a: `http://localhost:9999/admin?tab=emails`

3. Configura un email de prueba:
   - Destinatarios: Solo Jugadores (o el que tenga menos usuarios)
   - Asunto: `🧪 Test - Sistema de Emails`
   - Mensaje:
     ```
     Hola!
     
     Este es un email de prueba del nuevo sistema.
     
     Si lo recibes, todo está funcionando correctamente.
     
     Saludos!
     ```

4. Envía y verifica en los logs del servidor

5. **Revisa tu bandeja de entrada** (si eres uno de los usuarios)

---

## 🐛 Solución de Problemas

### Error: "The from email does not match a verified Sender Identity"

**Causa**: El email en `SENDGRID_FROM_EMAIL` no está verificado.

**Solución**:
1. Ve a SendGrid → Settings → Sender Authentication
2. Verifica que el email coincida EXACTAMENTE
3. Si no está verificado, haz clic en "Resend Verification Email"
4. Verifica desde tu email

### Error: "Unauthorized"

**Causa**: API key incorrecta o sin permisos.

**Solución**:
1. Verifica que copiaste la API key completa
2. Crea una nueva API key con permisos "Mail Send"
3. Actualiza `.env.local`
4. Reinicia el servidor

### Error: Rate limit exceeded

**Causa**: Has superado el límite del plan gratuito (100 emails/día).

**Solución**:
- Espera 24 horas
- O actualiza a un plan de pago
- O usa otro proveedor como AWS SES (más económico para volúmenes altos)

### Los emails van a SPAM

**Soluciones**:
1. **Domain Authentication**: Verifica tu dominio en SendGrid
2. **Content**: Evita palabras spam ("gratis", "urgente", etc.)
3. **Balance texto/imágenes**: Más texto, menos imágenes
4. **Link de desuscripción**: Agrégalo siempre
5. **Warm-up**: Empieza con pocos emails y aumenta gradualmente

---

## 🎯 Límites del Plan Gratuito

| Característica | Plan Gratuito |
|---------------|---------------|
| Emails/día | 100 |
| Validez | Permanente |
| API Access | ✅ |
| Analytics | ✅ (básicos) |
| Support | Email |

**Si necesitas más**:
- Essentials ($19.95/mes): 50,000 emails/mes
- Pro ($89.95/mes): 100,000 emails/mes

---

## 🔄 Alternativa: AWS SES (Más Económico)

Si tienes muchos usuarios, AWS SES es más barato:

**Costos**:
- Primeros 62,000 emails/mes: GRATIS
- Después: $0.10 por 1,000 emails

**Instalación**:
```bash
npm install @aws-sdk/client-ses
```

Ver `docs/EMAIL_MASIVO_ADMIN.md` para implementación completa.

---

## 📊 Monitoreo y Estadísticas

### En SendGrid Dashboard

1. Ve a **Activity** para ver emails enviados
2. Ve a **Stats** para métricas (aperturas, clicks, bounces)
3. Ve a **Suppressions** para ver emails bloqueados

### En tu App

Los resultados se guardan en Firestore:
```
Collection: email_campaigns
Docs: { subject, target, recipientsCount, sentAt, success, ... }
```

---

## ✅ Checklist Final

Antes de usar en producción, verifica:

- [ ] SendGrid API key configurada
- [ ] Email verificado en SendGrid
- [ ] Variables de entorno en `.env.local`
- [ ] Código actualizado con SendGrid
- [ ] Servidor reiniciado
- [ ] Email de prueba enviado exitosamente
- [ ] Sistema de desuscripción implementado (legal)
- [ ] Privacy policy actualizada (mencionar emails)
- [ ] Monitoreo de métricas activo

---

## 🚀 Siguiente Nivel

Una vez funcionando, considera:

1. **Sistema de desuscripción** (requerido legalmente)
2. **Plantillas HTML profesionales**
3. **Segmentación avanzada**
4. **A/B testing**
5. **Automatizaciones** (bienvenida, follow-ups)

---

**¿Problemas?** Revisa los logs del servidor y la documentación de SendGrid: https://docs.sendgrid.com/

