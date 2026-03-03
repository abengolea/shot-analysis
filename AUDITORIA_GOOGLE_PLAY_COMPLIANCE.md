# Auditoría Google Play / Android Compliance — Shot Analysis (Chaaaas)

**Fecha:** 17 de febrero de 2025  
**Repositorio:** shot-analysis-main  
**Dominio:** chaaaas.com

---

## HALLAZGO CRÍTICO PREVIO

**Este repositorio NO contiene empaquetado Android nativo.** Es una aplicación web Next.js desplegada en Firebase App Hosting. No existen:

- `android/` (carpeta Android)
- `AndroidManifest.xml`
- `build.gradle` / `app/build.gradle`
- `ios/` (carpeta iOS)
- Capacitor, React Native, Flutter ni PWA/TWA configurado

**Para publicar en Google Play** será necesario:

1. **Opción A:** Crear un wrapper (Capacitor, TWA, PWA instalable) que cargue la URL web.
2. **Opción B:** Desarrollar una app nativa/híbrida que consuma la API existente.

Esta auditoría cubre **compliance y requisitos de políticas** que aplican tanto a la app web actual como a cualquier futuro empaquetado móvil.

---

## A) RESUMEN EJECUTIVO

| Estado | **NO LISTO** |
|--------|--------------|
| **Veredicto** | El proyecto tiene bloqueantes severos de seguridad y compliance que impiden publicar en Google Play. |

### Top 10 Riesgos (ordenados por severidad)

| # | Riesgo | Severidad | Archivo(s) |
|---|--------|-----------|------------|
| 1 | Credenciales secretas hardcodeadas en repo (Firebase Admin, MP, Gemini, dLocal) | **BLOCKER** | `apphosting.yaml`, `GUIA_PRUEBAS_DLOCAL.md`, `env.example`, `src/lib/firebase.ts` |
| 2 | No existe app Android / wrapper para Play Store | **BLOCKER** | N/A (estructura del proyecto) |
| 3 | Falta Privacy Policy como página dedicada y URL pública | **BLOCKER** | N/A |
| 4 | No hay flujo de eliminación de cuenta (requisito Google Play) | **BLOCKER** | `src/app/player/profile/page.tsx`, `src/hooks/use-auth.tsx` |
| 5 | Reglas Firestore permiten read/write a cualquier usuario autenticado en toda la DB | **HIGH** | `firestore.rules` |
| 6 | Contraseña de admin hardcodeada en desarrollo | **HIGH** | `src/app/admin/login/page.tsx` |
| 7 | Pagos in-app (MercadoPago, dLocal) sin Google Play Billing — riesgo de violación | **HIGH** | `src/app/player/upload-analysis3/page.tsx`, `src/lib/mercadopago.ts`, `src/lib/dlocal.ts` |
| 8 | API keys de Firebase/Gemini como fallback en código cliente | **MED** | `src/lib/firebase.ts` |
| 9 | Data Safety: tracking de métricas sin declaración ni consent | **MED** | `src/components/metrics-tracker.tsx`, `src/app/api/metrics/track/route.ts` |
| 10 | No hay enlace a Privacy Policy en footer ni en registro | **MED** | `src/app/page.tsx`, `src/components/register-form.tsx` |

---

## B) CHECKLIST PLAY STORE

### 1. Build & Release

| Item | Estado | Notas |
|------|--------|-------|
| AAB generado | ❌ | No hay proyecto Android |
| versionCode / versionName | ❌ | N/A |
| Signing configurado | ❌ | N/A |
| Play App Signing | ❌ | N/A |
| Flavors staging/prod | ❌ | N/A |

### 2. Target SDK / min SDK / Dependencias

| Item | Estado | Notas |
|------|--------|-------|
| targetSdkVersion | ❌ | No aplica (web) |
| compileSdk | ❌ | No aplica |
| minSdk | ❌ | No aplica |
| Dependencias desactualizadas | ⚠️ | Revisar `package.json` (Next 15, React 18) |

### 3. Permisos Android

| Item | Estado | Notas |
|------|--------|-------|
| Lista de permisos | ❌ | No hay AndroidManifest |
| Justificación | ❌ | N/A |
| Permisos innecesarios | ❌ | N/A |

### 4. Data Safety

| Item | Estado | Notas |
|------|--------|-------|
| Recolección de datos declarada | ❌ | No hay declaración |
| SDKs de analytics | ⚠️ | `metrics-tracker.tsx` → Firestore `metrics_events` (sessionId, path, userAgent, durationMs) |
| Crashlytics | ❌ | No detectado |
| Ads | ❌ | No detectado |
| Push | ❌ | No detectado |
| Firebase Auth | ✅ | Usado para login |
| Firebase Storage | ✅ | Videos, imágenes de perfil |
| Firestore | ✅ | Perfiles, análisis, pagos |

### 5. Privacy Policy

| Item | Estado | Notas |
|------|--------|-------|
| Existe página dedicada | ❌ | **FALTA** — Solo Bases y Condiciones |
| URL pública | ❌ | No hay `/privacy` ni `/politica-privacidad` |
| Contenido mínimo | ⚠️ | Bases y Condiciones mencionan Ley 25.326 y supresión por email |
| Alineación con código | ⚠️ | Falta detallar: métricas, Firebase, AWS, Gemini, pagos |

### 6. Account Deletion

| Item | Estado | Notas |
|------|--------|-------|
| Botón en app | ❌ | **FALTA** — No existe en `/player/profile` ni `/coach/profile` |
| Flujo de borrado | ❌ | No hay `deleteUser()` de Firebase Auth |
| Borrado de datos Firestore | ❌ | No implementado |
| Borrado de Storage | ❌ | No implementado |
| Tiempo de procesamiento | ❌ | N/A |

### 7. Contenido

| Item | Estado | Notas |
|------|--------|-------|
| Descripciones | ⚠️ | Definir para ficha de Play |
| Screenshots | ⚠️ | Preparar para Play Console |
| Íconos | ⚠️ | Existe `favicon.svg` |
| Categorías | ⚠️ | Deportes / Fitness |
| IARC | ⚠️ | Evaluar según contenido |

### 8. Pagos

| Item | Estado | Notas |
|------|--------|-------|
| Cobros digitales in-app | ✅ | Sí — análisis pagos, coach review |
| Google Play Billing | ❌ | **NO** — Usa MercadoPago y dLocal |
| Riesgo bypass | **HIGH** | Compras digitales (créditos, análisis) fuera de Play Billing violan políticas |

### 9. Seguridad

| Item | Estado | Notas |
|------|--------|-------|
| API keys en código | ❌ | `apphosting.yaml` — Firebase Admin, MP, Gemini, dLocal |
| Tokens hardcodeados | ❌ | `env.example`, `GUIA_PRUEBAS_DLOCAL.md` — dLocal keys |
| Firebase config fallback | ❌ | `src/lib/firebase.ts` líneas 9–14 |
| Reglas Firestore | ⚠️ | `match /{document=**}` permite todo a usuarios autenticados |
| Logging de datos sensibles | ⚠️ | Revisar `stack` en respuestas de error |

### 10. UX "No Demo"

| Item | Estado | Notas |
|------|--------|-------|
| App usable sin aprobación manual | ⚠️ | Requiere registro |
| Manejo de errores | ⚠️ | Revisar pantallas vacías y mensajes |
| Crashes al inicio | ⚠️ | Probar flujo completo |

---

## C) MAPEO TÉCNICO

### Stack

| Componente | Valor |
|------------|-------|
| Tipo | **Web app (Next.js 15)** |
| Framework | Next.js, React 18 |
| Backend | Next.js API Routes, Firebase App Hosting |
| Base de datos | Firestore |
| Auth | Firebase Auth |
| Storage | Firebase Storage, AWS S3 (opcional) |
| Pagos | MercadoPago, dLocal |
| IA | Google Gemini (Genkit) |

### Comandos de build

```bash
npm run build    # next build
npm run start    # next start
```

No hay comandos para generar AAB/APK.

### Archivos de configuración

| Archivo | Ubicación | Propósito |
|---------|-----------|-----------|
| `package.json` | raíz | Dependencias, scripts |
| `next.config.ts` | raíz | Next.js, CSP, webpack |
| `firebase.json` | raíz | Firestore, Storage, App Hosting |
| `firestore.rules` | raíz | Reglas Firestore |
| `storage.rules` | raíz | Reglas Storage |
| `apphosting.yaml` | raíz | Variables de entorno (⚠️ credenciales) |
| `env.example` | raíz | Plantilla env (⚠️ keys de ejemplo) |
| `src/lib/firebase.ts` | src | Config Firebase cliente |

### SDKs y servicios

| Servicio | Uso | Datos |
|----------|-----|-------|
| Firebase Auth | Login, registro | email, uid |
| Firestore | Perfiles, análisis, pagos | Datos de usuario, análisis |
| Firebase Storage | Videos, imágenes | Archivos subidos |
| Firebase Admin | Backend | Service account |
| MercadoPago | Pagos | Preferencias, webhooks |
| dLocal | Pagos | Checkout, webhooks |
| Google Gemini | Análisis de video | Videos, prompts |
| AWS Rekognition | Opcional | Análisis de video |
| AWS SES / SendGrid | Emails | Emails transaccionales |
| Métricas custom | `metrics_events` | sessionId, path, userAgent, durationMs |

---

## D) PLAN DE ACCIÓN (ordenado por prioridad)

### 1. [BLOCKER] Eliminar credenciales del repositorio

**Riesgo:** Exposición de claves, acceso no autorizado, violación de políticas.

**Archivos a modificar:**

- `apphosting.yaml` — Mover todas las variables a Firebase App Hosting / Secret Manager. **No commitear valores reales.**
- `GUIA_PRUEBAS_DLOCAL.md` — Reemplazar keys por placeholders (`DLOCAL_API_KEY=***`).
- `env.example` — Usar solo placeholders, sin keys reales.
- `src/lib/firebase.ts` — Eliminar fallbacks hardcodeados.

**Cambios propuestos:**

```yaml
# apphosting.yaml — NO incluir value, usar Secret Manager o variables de entorno del proyecto
env:
  - variable: FIREBASE_ADMIN_PRIVATE_KEY
    secret: FIREBASE_ADMIN_PRIVATE_KEY  # Referencia a secret
```

```typescript
// src/lib/firebase.ts — Eliminar fallbacks
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
if (!firebaseConfig.apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY required');
```

**Test:** Buscar con `grep -r "AIzaSy\|-----BEGIN\|APP_USR-\|mNbeb6yx" .` y asegurar 0 resultados.

---

### 2. [BLOCKER] Crear Privacy Policy

**Riesgo:** Rechazo por falta de política de privacidad.

**Acción:** Crear página `/privacy` o `/politica-privacidad`.

**Archivos a crear/modificar:**

- `src/app/privacy/page.tsx` (o `politica-privacidad/page.tsx`)
- `src/app/page.tsx` — Agregar enlace en footer
- `src/components/register-form.tsx` — Checkbox + enlace al registrarse

**Contenido mínimo:**

- Qué datos se recogen (email, nombre, videos, métricas)
- Para qué se usan
- Con quién se comparten (Firebase, Google, MercadoPago, dLocal)
- Cómo solicitar eliminación
- Contacto: contacto@chaaaas.com
- Ley 25.326 (Argentina), GDPR si aplica

**Test:** Verificar que `/privacy` carga y el enlace está en footer y registro.

---

### 3. [BLOCKER] Implementar eliminación de cuenta

**Riesgo:** Requisito obligatorio de Google Play para apps con cuentas.

**Archivos a crear/modificar:**

- `src/app/player/profile/page.tsx` — Botón "Eliminar mi cuenta"
- `src/app/coach/profile/page.tsx` — Idem
- `src/app/api/account/delete/route.ts` — Nuevo endpoint
- `src/hooks/use-auth.tsx` — Función `deleteAccount` si se hace desde cliente

**Flujo propuesto:**

1. Botón en perfil → modal de confirmación (escribir "ELIMINAR" o similar)
2. Llamada a `POST /api/account/delete` con token
3. Backend: borrar datos Firestore (players/coaches, video-analysis, etc.), Storage, luego `adminAuth.deleteUser(uid)`
4. Respuesta y redirect a home

**Snippet de referencia:**

```typescript
// src/app/api/account/delete/route.ts
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  
  const decoded = await adminAuth.verifyIdToken(token);
  const uid = decoded.uid;
  
  // 1. Borrar documentos Firestore del usuario
  // 2. Borrar archivos Storage del usuario
  // 3. adminAuth.deleteUser(uid);
  
  return NextResponse.json({ success: true });
}
```

**Test:** Crear cuenta de prueba, eliminar, verificar que no puede volver a iniciar sesión y que los datos se borraron.

---

### 4. [BLOCKER] Definir estrategia de empaquetado para Play Store

**Opciones:**

- **TWA (Trusted Web Activity):** PWA + bubblewrap → AAB. Más simple si la web ya es responsive.
- **Capacitor:** Wrapper nativo que carga la URL o assets estáticos.
- **PWA instalable:** Si la app cumple criterios PWA, se puede publicar como "web app" en Play (con limitaciones).

**Acción:** Elegir una opción e implementar la estructura mínima (ej. proyecto Capacitor o TWA).

---

### 5. [HIGH] Endurecer reglas de Firestore

**Riesgo:** Cualquier usuario autenticado puede leer/escribir en toda la base.

**Archivo:** `firestore.rules`

**Cambio:** Activar las reglas específicas que están comentadas (líneas 10–95) y desactivar `match /{document=**}`.

```javascript
// Eliminar o comentar:
// match /{document=**} {
//   allow read, write: if request.auth != null;
// }

// Descomentar y usar las reglas específicas por colección
```

**Test:** Con emuladores, verificar que un usuario solo puede leer/escribir sus propios datos.

---

### 6. [HIGH] Remover contraseña hardcodeada en admin login

**Archivo:** `src/app/admin/login/page.tsx`

**Líneas 12–13:**

```typescript
// ANTES
const [email, setEmail] = useState(process.env.NODE_ENV !== 'production' ? "abengolea@hotmail.com" : "");
const [password, setPassword] = useState(process.env.NODE_ENV !== 'production' ? "afdlue4333379832" : "");
```

```typescript
// DESPUÉS
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
```

**Test:** En desarrollo, el formulario debe iniciar vacío.

---

### 7. [HIGH] Evaluar pagos y Google Play Billing

**Riesgo:** Política de Google sobre compras in-app.

**Situación actual:** MercadoPago y dLocal para compra de análisis/créditos.

**Opciones:**

- Si la app se publica en Play: productos digitales (créditos, análisis) deben usar **Google Play Billing**.
- Excepciones: bienes físicos, servicios fuera de la app (ej. suscripción a gimnasio). Los "análisis de video" son contenido digital → aplica Billing.

**Acción:** Consultar con legal/compliance y, si corresponde, integrar Google Play Billing para compras digitales en la versión Android.

---

### 8. [MED] Declarar métricas en Data Safety y Privacy Policy

**Archivos:** `src/components/metrics-tracker.tsx`, `src/app/api/metrics/track/route.ts`

**Datos recolectados:** sessionId, path, userAgent, durationMs, userId (si se envía).

**Acción:** Incluir en Privacy Policy y en la sección Data Safety de Play Console. Considerar consent (cookie banner o ajustes) si se amplía el tracking.

---

### 9. [MED] Agregar enlace a Privacy Policy en footer y registro

**Archivos:** `src/app/page.tsx`, `src/components/register-form.tsx`

```tsx
// En footer (page.tsx)
<Link href="/privacy" className="...">Política de Privacidad</Link>
```

```tsx
// En register-form.tsx — checkbox antes de enviar
<label>
  <input type="checkbox" required />
  Acepto la <Link href="/privacy">Política de Privacidad</Link>
</label>
```

---

### 10. [LOW] Evitar exponer stack en respuestas de error

**Archivos:** Varios `route.ts` que devuelven `stack` en JSON.

**Cambio:** Solo incluir `stack` cuando `NODE_ENV === 'development'`.

---

## CHECKLIST FINAL GO/NO-GO

| # | Requisito | Estado |
|---|-----------|--------|
| 1 | Credenciales fuera del repo | ❌ NO-GO |
| 2 | Privacy Policy pública | ❌ NO-GO |
| 3 | Eliminación de cuenta implementada | ❌ NO-GO |
| 4 | Empaquetado Android/TWA/Capacitor | ❌ NO-GO |
| 5 | Reglas Firestore seguras | ❌ NO-GO |
| 6 | Sin credenciales en código cliente | ❌ NO-GO |
| 7 | Pagos alineados con políticas (Billing o excepción) | ❌ NO-GO |
| 8 | Data Safety declarado | ⚠️ Pendiente |
| 9 | Enlaces legales en app | ⚠️ Parcial (solo Bases) |

**Veredicto final: NO-GO** — No publicar hasta resolver los bloqueantes 1–4 y 7.

---

## INVENTARIO DE ARCHIVOS CLAVE (PASO 1)

| Categoría | Archivos |
|-----------|----------|
| **Android/iOS** | No existen |
| **Manifest** | No existe |
| **Build** | `package.json`, `next.config.ts` |
| **Firebase** | `firebase.json`, `firestore.rules`, `storage.rules`, `apphosting.yaml`, `src/lib/firebase.ts`, `src/lib/firebase-admin.ts` |
| **Auth** | `src/hooks/use-auth.tsx`, `src/components/login-form.tsx`, `src/components/register-form.tsx`, `src/app/admin/login/page.tsx` |
| **Perfil** | `src/app/player/profile/page.tsx`, `src/app/coach/profile/page.tsx` (si existe) |
| **Pagos** | `src/lib/mercadopago.ts`, `src/lib/dlocal.ts`, `src/app/api/payments/*` |
| **Legales** | `src/app/bases-y-condiciones/page.tsx` |
| **Métricas** | `src/components/metrics-tracker.tsx`, `src/app/api/metrics/track/route.ts` |
| **Env** | `env.example`, `apphosting.yaml` (⚠️ credenciales) |

---

*Auditoría realizada sobre el estado del repositorio al 17/02/2025.*
