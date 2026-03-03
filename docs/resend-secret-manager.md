# Resend con Secret Manager (producción)

En producción la app **no** usa variables de entorno para Resend en el panel. Lee `RESEND_API_KEY`, `RESEND_FROM` y `RESEND_REPLY_TO` desde **Google Cloud Secret Manager** en tiempo de ejecución.

## 1. Subir los secretos a GCP (una vez)

Desde la raíz del proyecto, con `.env.local` ya configurado (RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO):

```bash
node scripts/setup-resend-secrets.js
```

El script:

- Lee `.env.local` (no lo sube al repo).
- Crea en tu proyecto GCP los secretos `RESEND_API_KEY`, `RESEND_FROM` y opcionalmente `RESEND_REPLY_TO`.
- Añade una versión con el valor actual.

Requisitos:

- Estar autenticado: `gcloud auth application-default login` (o usar `GOOGLE_APPLICATION_CREDENTIALS`).
- Que el proyecto tenga la **Secret Manager API** habilitada.
- Que tu usuario tenga rol **Secret Manager Admin** (o equivalente) para crear/actualizar secretos.

## 2. Dar acceso a la app (Firebase App Hosting)

La cuenta de servicio con la que corre la app en producción debe poder **leer** esos secretos.

### Opción A: Por terminal

**Con gcloud (un solo comando):**

1. Instalá [gcloud](https://cloud.google.com/sdk/docs/install) si no lo tenés. En Windows, después de instalar, reabrí la terminal.
2. Autenticá (solo la primera vez): `gcloud auth login` y `gcloud auth application-default login`
3. Ejecutá:

```bash
gcloud projects add-iam-policy-binding shotanalisys --member="serviceAccount:shotanalisys@appspot.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

Si gcloud está instalado pero no en el PATH (Windows), usá la ruta completa, por ejemplo:

```bash
"C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" projects add-iam-policy-binding shotanalisys --member="serviceAccount:shotanalisys@appspot.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

**Sin gcloud (script Node, también desde la terminal):**

```bash
node scripts/grant-resend-secret-accessor.js
```

Antes necesitás credenciales: `gcloud auth application-default login` (una vez) o `GOOGLE_APPLICATION_CREDENTIALS` con un JSON de cuenta de servicio. Ver comentarios en el script.

### Opción B: Por consola web

1. En [Google Cloud Console](https://console.cloud.google.com/) → tu proyecto (ej. `shotanalisys`).
2. **IAM y administración** → **IAM**.
3. Localizá la cuenta de servicio que usa **Firebase App Hosting** (por ejemplo `shotanalisys@appspot.gserviceaccount.com` o la que aparezca en **App Hosting** → tu backend → configuración).
4. Editá esa cuenta y añadí el rol **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`).

Con eso, en runtime la app usa `getResendConfig()` en `src/lib/resend-secrets.ts`: si no hay `RESEND_*` en env, lee desde Secret Manager.

## 3. No poner Resend en el panel

- **No** definas `RESEND_API_KEY` ni `RESEND_FROM` en las variables de entorno del hosting (Vercel, Firebase App Hosting, etc.).
- Así la app en producción solo usa Secret Manager para Resend.

## 4. Local vs producción

| Entorno     | Origen de RESEND_*                          |
|------------|---------------------------------------------|
| **Local**  | `.env.local` (RESEND_API_KEY, RESEND_FROM)  |
| **Online** | Secret Manager (mismo proyecto GCP)         |

En local seguís usando `.env.local`. En producción la app detecta que no hay env y lee desde Secret Manager (con `GOOGLE_CLOUD_PROJECT` / `FIREBASE_ADMIN_PROJECT_ID`, que ya tenés en `apphosting.yaml`).

## 5. Actualizar valores en Secret Manager

Si cambiás la API key o el remitente:

1. Actualizá `.env.local` con los nuevos valores.
2. Volvé a ejecutar: `node scripts/setup-resend-secrets.js`.

Eso añade una nueva versión a cada secreto; la app siempre usa la versión `latest`.
