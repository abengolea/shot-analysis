# Configuración de credenciales para despliegue

Tras la auditoría de seguridad, las credenciales fueron removidas del repositorio. Para desplegar correctamente:

## 1. Variables de entorno locales (.env.local)

Copia `env.example` a `.env.local` y configura los valores reales. **Nunca commitees `.env.local`.**

## 2. Producción: Firebase App Hosting + Secret Manager

El `apphosting.yaml` tiene variables públicas en `value:` y credenciales sensibles como referencias a **Google Cloud Secret Manager**. Los secretos se crean con la CLI y **nunca** van al repositorio.

### Crear secretos en producción

Desde la raíz del proyecto, con Firebase CLI logueado:

```bash
# Selecciona el proyecto
firebase use shotanalisys

# Crear cada secreto (te pedirá el valor o lo pasas por stdin)
# Responde "yes" cuando pregunte por permisos.

firebase apphosting:secrets:set FIREBASE_ADMIN_CLIENT_EMAIL
firebase apphosting:secrets:set FIREBASE_ADMIN_PRIVATE_KEY
firebase apphosting:secrets:set MP_ACCESS_TOKEN_AR
firebase apphosting:secrets:set GEMINI_API_KEY
firebase apphosting:secrets:set GOOGLE_API_KEY
firebase apphosting:secrets:set GOOGLE_GENAI_API_KEY
firebase apphosting:secrets:set DLOCAL_API_KEY
firebase apphosting:secrets:set DLOCAL_SECRET_KEY
```

**Pasar valor por archivo (sin mostrar en pantalla):**

```powershell
# PowerShell - ejemplo para FIREBASE_ADMIN_PRIVATE_KEY
Get-Content -Raw .\mi-clave-privada.txt | firebase apphosting:secrets:set --force --data-file - FIREBASE_ADMIN_PRIVATE_KEY
```

**Pasar valor por variable de entorno:**

```bash
echo $env:MP_ACCESS_TOKEN_AR | firebase apphosting:secrets:set --force --data-file - MP_ACCESS_TOKEN_AR
```

### Orden recomendado

1. Crear todos los secretos con los comandos anteriores.
2. Hacer deploy (push a la rama o desde Firebase Console).
3. El build leerá los secretos de Secret Manager automáticamente.

### Secretos requeridos

| Secreto | Origen |
|---------|--------|
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Console > Cuentas de servicio |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Console > Cuentas de servicio (clave privada) |
| `MP_ACCESS_TOKEN_AR` | Dashboard Mercado Pago |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Google AI Studio |
| `DLOCAL_API_KEY`, `DLOCAL_SECRET_KEY` | Dashboard dLocal |

## 3. Verificación

Antes de desplegar, ejecuta:

```bash
# No debería encontrar credenciales reales en código
grep -r "AIzaSy\|-----BEGIN\|APP_USR-\|mNbeb6yx" . --include="*.ts" --include="*.tsx" --include="*.yaml" --include="*.md" --include="*.example" 2>/dev/null || true
```

Si aparecen resultados con valores reales, remuévelos.
