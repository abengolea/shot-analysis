# ⚡ Configuración Rápida de Emails (5-10 minutos)

## ✅ Lo que ya está listo

El código ya está completamente implementado y funcionando en modo "LOG ONLY".
Solo necesitas configurar SendGrid para activar el envío real.

---

## 🚀 Pasos para Implementar

### 1. Instalar Dependencia (30 segundos)

```bash
npm install @sendgrid/mail
```

---

### 2. Crear Cuenta en SendGrid (3 minutos)

1. Ve a: **https://sendgrid.com**
2. Click en **"Start for free"**
3. Regístrate con tu email
4. Verifica tu email
5. Completa el cuestionario (selecciona "Marketing" o "Transactional")

**✅ Plan Gratuito: 100 emails/día GRATIS para siempre**

---

### 3. Obtener API Key (1 minuto)

1. Una vez dentro, ve a: **Settings → API Keys**
2. Click en **"Create API Key"**
3. Nombre: `shot-analysis-emails`
4. Permisos: **"Full Access"** (o solo "Mail Send")
5. Click en **"Create & View"**
6. **⚠️ COPIA LA CLAVE AHORA** (se ve algo así: `SG.abc123xyz...`)
   - Solo se muestra una vez
   - Guárdala en un lugar seguro temporalmente

---

### 4. Verificar Email Remitente (2 minutos)

**IMPORTANTE**: SendGrid requiere verificar desde qué email enviarás.

1. Ve a: **Settings → Sender Authentication**
2. Click en **"Verify a Single Sender"**
3. Completa el formulario:
   - **From Name**: `Shot Analysis`
   - **From Email**: Tu email (puede ser Gmail, cualquiera)
   - **Reply To**: (mismo email)
   - **Company Address**: Tu dirección (requerido)
4. Click en **"Create"**
5. **Ve a tu bandeja de entrada** y verifica el email que te enviaron
6. Click en el link de verificación

**✅ Listo! Tu email ya está verificado**

---

### 5. Configurar Variables de Entorno (1 minuto)

Edita tu archivo `.env.local` y agrega al final:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.pega_aqui_tu_clave_completa
SENDGRID_FROM_EMAIL=email-que-verificaste@gmail.com
SENDGRID_FROM_NAME=Shot Analysis
```

**Reemplaza**:
- `SG.pega_aqui_tu_clave_completa` → Tu API Key de SendGrid
- `email-que-verificaste@gmail.com` → El email que verificaste en el paso 4

**Ejemplo real**:
```env
SENDGRID_API_KEY=SG.k3xT4mP13.H3r3G0354R34nD0mK3yF0rS3ndGr1d
SENDGRID_FROM_EMAIL=adrian@ejemplo.com
SENDGRID_FROM_NAME=Shot Analysis
```

---

### 6. Verificar Configuración (30 segundos)

Ejecuta este comando para verificar que todo está correcto:

```bash
node scripts/verify-email-config.js
```

Deberías ver:
```
✅ TODO CONFIGURADO CORRECTAMENTE

El sistema está listo para enviar emails reales.
```

Si ves errores, el script te dirá exactamente qué falta.

---

### 7. Reiniciar Servidor (10 segundos)

```bash
# Detén el servidor (Ctrl+C) y reinicia:
npm run dev
```

---

### 8. ¡Probar! 🎉

1. Ve a: **http://localhost:9999/admin?tab=emails**

2. Deberías ver la nueva pestaña "Emails"

3. **Envía un email de prueba**:
   - Destinatarios: **Solo Jugadores** (o el grupo más pequeño)
   - Asunto: `🧪 Test - Primer Email`
   - Mensaje:
     ```
     Hola!
     
     Este es un email de prueba del sistema.
     
     Si lo recibes, ¡todo funciona!
     ```

4. Click en **"Enviar"**

5. **Revisa la consola del servidor**:
   - Verás: `📤 Enviando lote 1/1 (X emails)...`
   - Y: `✅ Lote 1 enviado exitosamente`

6. **Revisa tu bandeja de entrada** (si eres uno de los usuarios)

---

## 🎯 Resumen de Comandos

```bash
# 1. Instalar
npm install @sendgrid/mail

# 2. Verificar configuración
node scripts/verify-email-config.js

# 3. Reiniciar servidor
npm run dev
```

---

## 📋 Checklist Final

- [ ] SendGrid instalado (`npm install @sendgrid/mail`)
- [ ] Cuenta de SendGrid creada
- [ ] API Key obtenida
- [ ] Email remitente verificado
- [ ] Variables en `.env.local` configuradas
- [ ] Script de verificación ejecutado exitosamente
- [ ] Servidor reiniciado
- [ ] Email de prueba enviado y recibido ✅

---

## 🐛 Problemas Comunes

### "The from email does not match a verified Sender Identity"

**Solución**: El email en `SENDGRID_FROM_EMAIL` no coincide con el que verificaste.
- Verifica que sea EXACTAMENTE el mismo
- Revisa en SendGrid: Settings → Sender Authentication

### "Unauthorized"

**Solución**: La API Key es incorrecta.
- Crea una nueva API key en SendGrid
- Copia la clave COMPLETA
- Actualiza `.env.local`
- Reinicia el servidor

### Los emails no llegan

**Solución**:
1. Revisa la consola del servidor para errores
2. Verifica en SendGrid Dashboard → Activity
3. Revisa tu carpeta de SPAM
4. Verifica que el email esté confirmado en SendGrid

### "Module not found: @sendgrid/mail"

**Solución**:
```bash
npm install @sendgrid/mail
```

---

## 📊 Límites del Plan Gratuito

| Característica | Límite |
|---------------|--------|
| Emails por día | 100 |
| Costo | $0 |
| Validez | Permanente |

**Si necesitas más:**
- Essentials: $19.95/mes → 50,000 emails/mes
- Pro: $89.95/mes → 100,000 emails/mes

**Alternativa más económica para alto volumen:**
- AWS SES: 62,000 emails/mes GRATIS, luego $0.10 por 1,000

---

## 📚 Documentación Completa

Para información detallada, ver:
- **Guía paso a paso**: `docs/IMPLEMENTAR_EMAILS_REAL.md`
- **Manual de uso**: `docs/EMAIL_MASIVO_ADMIN.md`

---

## 🎉 ¡Listo!

Una vez completados estos pasos, podrás:
- ✅ Enviar emails masivos a todos tus usuarios
- ✅ Segmentar por jugadores/entrenadores
- ✅ Ver estadísticas de envío
- ✅ Historial de campañas en Firestore

**Cualquier duda, revisa los logs del servidor o la documentación completa.**

---

**Última actualización**: Octubre 2025

