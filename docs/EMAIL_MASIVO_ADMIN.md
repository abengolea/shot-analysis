# 📧 Sistema de Envío Masivo de Emails

## Descripción

Se ha implementado un sistema completo para enviar correos electrónicos masivos a todos los suscriptores desde el panel de administración.

## Ubicación

Accede al panel de administración y selecciona la pestaña **"Emails"**:

```
/admin?tab=emails
```

## Características

### 1. Información de Suscriptores
- Muestra el total de usuarios activos
- Divide entre jugadores y entrenadores
- Se actualiza automáticamente al cargar la página

### 2. Opciones de Destinatarios
Puedes enviar emails a:
- **Todos**: Todos los usuarios activos (jugadores + entrenadores)
- **Solo Jugadores**: Únicamente jugadores con estado "activo"
- **Solo Entrenadores**: Únicamente entrenadores con estado "activo"

### 3. Formulario de Envío
- **Asunto**: Título del email
- **Mensaje**: Contenido del email (soporta múltiples líneas)
- **Vista Previa**: Permite ver cómo se verá el email antes de enviarlo

### 4. Diseño del Email
Los emails se envían con un diseño profesional que incluye:
- Encabezado con el logo de Shot Analysis
- Contenido con formato limpio y legible
- Pie de página con información de la empresa

### 5. Confirmación de Seguridad
Antes de enviar, el sistema pide confirmación mostrando:
- A cuántos usuarios se enviará
- Qué tipo de usuarios (todos, jugadores o entrenadores)

### 6. Historial de Campañas
Cada envío se registra en Firestore en la colección `email_campaigns` con:
- Asunto del email
- Tipo de destinatarios
- Cantidad de emails enviados
- Fecha y hora
- Resultados (éxitos y fallos)

## Archivos Creados/Modificados

### Nuevos Archivos:
1. **`src/app/api/admin/emails/subscribers/route.ts`**
   - API para obtener la lista de suscriptores activos
   - Retorna total de usuarios, jugadores y entrenadores

2. **`src/app/api/admin/emails/send-bulk/route.ts`**
   - API para enviar emails masivos
   - Maneja el envío por lotes
   - Registra resultados en Firestore

### Archivos Modificados:
1. **`src/lib/email-service.ts`**
   - Agregada función `sendBulkEmail()`
   - Incluye interfaces para opciones y resultados

2. **`src/app/admin/page.tsx`**
   - Agregada pestaña "Emails"
   - Componente `EmailCampaignForm` con todo el formulario

## Estado Actual

⚠️ **IMPORTANTE**: Actualmente el sistema está configurado para **solo registrar en logs del servidor**. No envía emails reales.

Los emails se registran en la consola del servidor con:
```
📧 Iniciando envío masivo a X destinatarios
📧 [LOG ONLY] Email a: usuario@ejemplo.com
✅ Envío masivo completado
```

## Configurar Envío Real de Emails

Para habilitar el envío real de correos electrónicos, necesitas integrar un proveedor de email. Las opciones más populares son:

### Opción 1: SendGrid (Recomendado)

**Ventajas**:
- Fácil de integrar
- 100 emails gratis por día
- Excelente deliverability

**Pasos**:

1. **Crear cuenta en SendGrid**:
   - Ve a https://sendgrid.com
   - Regístrate (plan gratuito disponible)

2. **Obtener API Key**:
   - Ve a Settings > API Keys
   - Crea una nueva API key con permisos de "Mail Send"
   - Copia la clave

3. **Instalar dependencia**:
   ```bash
   npm install @sendgrid/mail
   ```

4. **Configurar variables de entorno**:
   Agrega a tu `.env.local`:
   ```env
   SENDGRID_API_KEY=SG.tu_clave_aqui
   SENDGRID_FROM_EMAIL=noreply@tudominio.com
   SENDGRID_FROM_NAME=Shot Analysis
   ```

5. **Verificar dominio en SendGrid**:
   - Ve a Settings > Sender Authentication
   - Verifica tu dominio o email

6. **Actualizar el código en `src/lib/email-service.ts`**:
   ```typescript
   import sgMail from '@sendgrid/mail';
   
   export async function sendBulkEmail(options: BulkEmailOptions): Promise<BulkEmailResult> {
     try {
       sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
       
       const messages = options.to.map(email => ({
         to: email,
         from: {
           email: process.env.SENDGRID_FROM_EMAIL!,
           name: process.env.SENDGRID_FROM_NAME || 'Shot Analysis'
         },
         subject: options.subject,
         text: options.text || '',
         html: options.html,
       }));
       
       // Enviar en lotes de 100 para evitar límites de rate
       const batchSize = 100;
       let successCount = 0;
       let failureCount = 0;
       const errors: Array<{ email: string; error: string }> = [];
       
       for (let i = 0; i < messages.length; i += batchSize) {
         const batch = messages.slice(i, i + batchSize);
         try {
           await sgMail.send(batch);
           successCount += batch.length;
         } catch (error: any) {
           failureCount += batch.length;
           batch.forEach(msg => {
             errors.push({
               email: msg.to,
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
     } catch (error: any) {
       console.error('❌ Error en envío masivo:', error);
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

### Opción 2: AWS SES (Simple Email Service)

**Ventajas**:
- Muy económico (62,000 emails gratis al mes)
- Alta confiabilidad
- Ya usas AWS

**Pasos**:

1. **Habilitar AWS SES**:
   - Ve a la consola de AWS
   - Busca "Simple Email Service"
   - Verifica tu dominio o email

2. **Instalar SDK**:
   ```bash
   npm install @aws-sdk/client-ses
   ```

3. **Configurar credenciales**:
   Agrega a tu `.env.local`:
   ```env
   AWS_SES_REGION=us-east-1
   AWS_SES_FROM_EMAIL=noreply@tudominio.com
   ```

4. **Actualizar código** (similar a SendGrid, usando AWS SDK)

### Opción 3: Resend (Moderna y Simple)

**Ventajas**:
- Muy fácil de usar
- 100 emails gratis por día
- API moderna

**Pasos**:

1. **Crear cuenta**: https://resend.com
2. **Instalar**: `npm install resend`
3. **Configurar y usar** (documentación en resend.com)

## Mejores Prácticas

### 1. Segmentación
- Usa las opciones de filtrado (todos, jugadores, entrenadores)
- Considera agregar más filtros en el futuro (por país, nivel, etc.)

### 2. Contenido
- Mantén mensajes claros y concisos
- Usa la vista previa antes de enviar
- Incluye siempre un llamado a la acción claro

### 3. Frecuencia
- No envíes más de 1-2 emails por semana
- Evita enviar emails innecesarios
- Considera agregar opción de desuscripción

### 4. Seguimiento
- Revisa el historial en `email_campaigns` collection
- Monitorea tasas de éxito/fallo
- Ajusta según los resultados

## Futuras Mejoras Sugeridas

1. **Plantillas predefinidas**:
   - Crear templates para diferentes tipos de mensajes
   - Permitir usar variables (nombre del usuario, etc.)

2. **Programación de envíos**:
   - Permitir programar emails para más tarde
   - Envíos recurrentes (newsletters)

3. **Estadísticas avanzadas**:
   - Tasas de apertura
   - Clicks en enlaces
   - Desuscripciones

4. **Segmentación avanzada**:
   - Por actividad reciente
   - Por tipo de suscripción
   - Por país o idioma

5. **Editor WYSIWYG**:
   - Editor visual para crear emails más complejos
   - Soporte para imágenes y botones

6. **Pruebas A/B**:
   - Probar diferentes asuntos
   - Probar diferentes contenidos

7. **Lista de exclusión**:
   - Permitir excluir usuarios específicos
   - Respetar preferencias de notificaciones

## Soporte

Si tienes problemas o necesitas ayuda adicional:
1. Revisa los logs del servidor
2. Verifica que las variables de entorno estén configuradas
3. Asegúrate de que el dominio esté verificado en tu proveedor de email
4. Consulta la documentación del proveedor elegido

## Seguridad

- ✅ Requiere autenticación de admin
- ✅ Confirmación antes de enviar
- ✅ Logs de todas las operaciones
- ✅ Solo usuarios con estado "activo"
- ⚠️ Considera agregar rate limiting en producción
- ⚠️ Implementa sistema de desuscripción (requerido por leyes de email marketing)

---

**Última actualización**: Octubre 2025




