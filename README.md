# ShotVision AI / chaaaas

Plataforma de análisis de lanzamiento en básquet con IA: subida de videos, extracción de keyframes, feedback personalizado y seguimiento de progreso. Incluye rol de entrenador, pagos con Mercado Pago (Argentina) y soporte por tickets.

## Requisitos

- Node.js 18+
- Cuenta Firebase (Auth, Firestore, Storage)
- (Opcional) Mercado Pago, Resend, Genkit/Google AI para pagos, emails e IA

## Setup rápido

1. **Clonar e instalar**
   ```bash
   npm install
   ```

2. **Variables de entorno**
   - Copiar `env.example` a `.env.local`
   - Completar al menos:
     - Firebase: `NEXT_PUBLIC_FIREBASE_*` y `FIREBASE_ADMIN_*` (ver [FIREBASE_SETUP.md](./FIREBASE_SETUP.md))
     - App: `NEXT_PUBLIC_APP_URL` (ej. `http://localhost:9999` en local)
   - Para IA: `GEMINI_API_KEY` o `GOOGLE_GENAI_API_KEY`
   - Para pagos (Argentina): `MP_ACCESS_TOKEN_AR`, `MP_WEBHOOK_URL`, `MP_WEBHOOK_SECRET` (clave secreta del webhook en Tus integraciones)
   - Para emails: Resend (`RESEND_API_KEY`, `RESEND_FROM`) o SMTP

3. **Firebase**
   ```bash
   npm run setup:firebase
   ```
   Desplegar reglas cuando corresponda:
   ```bash
   npm run firebase:deploy
   ```

4. **Arrancar**
   ```bash
   npm run dev
   ```
   App en `http://localhost:9999` (puerto por defecto 9999).

## Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Next.js con Turbopack en puerto 9999 |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run test` | Tests unitarios (Vitest) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run setup:firebase` | Configuración inicial Firebase |
| `npm run firebase:deploy` | Despliega reglas Firestore y Storage |
| `npm run firebase:emulators` | Emuladores Firebase |

## Documentación interna

- **[docs/blueprint.md](./docs/blueprint.md)** – Producto, pagos, estilo, flujo IA
- **[docs/operator-manual.md](./docs/operator-manual.md)** – Uso para operadores (subir video, análisis, etiquetado)
- **[docs/email-flows.md](./docs/email-flows.md)** – Flujos de envío de correo
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** – Pasos detallados de Firebase
- **[docs/labeling-guidelines.md](./docs/labeling-guidelines.md)** – Guía de etiquetado para entrenamiento

## Rutas sensibles (solo admin)

Las rutas de debug y prueba de email requieren **Bearer token** de un usuario con `role === 'admin'` (en `coaches` o `players`) y tienen **rate limiting** (30 req/min por admin):

- `GET /api/debug/env` – Comprueba variables de entorno de IA (enmascaradas)
- `GET /api/debug/ai-env` – Estado de claves de IA
- `GET /api/debug/ai-ping` – Prueba de generación con Genkit
- `POST /api/debug/ai-raw` – Prueba de prompt de análisis
- `POST /api/debug/recompute-score` – Recalcula score de un análisis
- `GET|POST /api/email/test` – Envío de email de prueba (Resend)

Ejemplo con token de Firebase ID:
```bash
curl -H "Authorization: Bearer <ID_TOKEN>" http://localhost:9999/api/debug/env
```

## Webhook Mercado Pago

- URL: `POST /api/payments/webhook`
- En producción conviene configurar `MP_WEBHOOK_SECRET` (clave secreta en Tus integraciones > Webhooks). Si está definida, se valida el header `x-signature`; si no, el webhook se procesa sin validación (útil en desarrollo).

## Reglas Firestore

El archivo `firestore.rules` incluye reglas de **producción** por defecto (colecciones `analyses`, `coaches`, `players`, `tickets`, etc.). Para desarrollo local con “todo permitido” a usuarios autenticados, en `firestore.rules` se puede comentar el bloque de reglas específicas y descomentar el bloque que permite `read, write` a `request.auth != null` (ver comentarios en el archivo).

## Licencia

Privado / uso interno según el proyecto.
