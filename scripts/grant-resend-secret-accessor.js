/**
 * Da a la cuenta de servicio de App Hosting el rol Secret Manager Secret Accessor
 * para que la app pueda leer RESEND_API_KEY, RESEND_FROM, etc. en staging/producción.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/grant-resend-secret-accessor.js
 *   node scripts/grant-resend-secret-accessor.js [PROJECT_ID] [SERVICE_ACCOUNT_EMAIL]
 *
 * Por defecto usa PROJECT_ID=shotanalisys y la cuenta App Engine por defecto
 * (shotanalisys@appspot.gserviceaccount.com).
 *
 * Requisitos: credenciales de aplicación por defecto (no usa gcloud en el PATH).
 *   - Opción 1: Instalá gcloud (https://cloud.google.com/sdk/docs/install), abrí una terminal,
 *     ejecutá "gcloud auth application-default login" una vez. Después podés usar este script sin gcloud en el PATH.
 *   - Opción 2: Creá una cuenta de servicio en GCP con rol "Project IAM Admin", descargá el JSON,
 *     y configurá GOOGLE_APPLICATION_CREDENTIALS=ruta/al/json antes de ejecutar el script.
 */

const { GoogleAuth } = require('google-auth-library');

const projectId = process.argv[2] || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'shotanalisys';
const serviceAccount = process.argv[3] || `${projectId.replace(/@.*$/, '')}@appspot.gserviceaccount.com`;
const member = `serviceAccount:${serviceAccount}`;
const role = 'roles/secretmanager.secretAccessor';
const baseUrl = 'https://cloudresourcemanager.googleapis.com/v1';

async function main() {
  console.log('Proyecto:', projectId);
  console.log('Cuenta de servicio:', serviceAccount);
  console.log('Rol a asignar:', role);
  console.log('');

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) {
    console.error('No se pudo obtener un token de acceso. Ejecutá: gcloud auth application-default login');
    console.error('(Si no tenés gcloud, instalalo desde https://cloud.google.com/sdk/docs/install)');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token.token}`,
    'Content-Type': 'application/json',
  };

  // Obtener política actual
  const getRes = await fetch(`${baseUrl}/projects/${projectId}:getIamPolicy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!getRes.ok) {
    const errText = await getRes.text();
    console.error('Error al leer la política IAM:', getRes.status, errText);
    if (getRes.status === 403) {
      console.error('Tu cuenta necesita permiso resourcemanager.projects.getIamPolicy y setIamPolicy (ej. rol "Project IAM Admin").');
    }
    process.exit(1);
  }

  const policy = await getRes.json();
  const bindings = policy.bindings || [];

  // Ver si el rol ya existe y si el member ya está
  let binding = bindings.find((b) => b.role === role);
  if (binding) {
    if (binding.members && binding.members.includes(member)) {
      console.log('La cuenta ya tiene el rol Secret Manager Secret Accessor. Nada que hacer.');
      return;
    }
    binding.members = binding.members || [];
    binding.members.push(member);
  } else {
    bindings.push({ role, members: [member] });
  }

  // Actualizar política
  const setRes = await fetch(`${baseUrl}/projects/${projectId}:setIamPolicy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      policy: {
        bindings,
        etag: policy.etag,
        version: policy.version ?? 1,
      },
    }),
  });

  if (!setRes.ok) {
    const errText = await setRes.text();
    console.error('Error al escribir la política IAM:', setRes.status, errText);
    if (setRes.status === 403) {
      console.error('Tu cuenta necesita permiso resourcemanager.projects.setIamPolicy (ej. rol "Project IAM Admin").');
    }
    process.exit(1);
  }

  console.log('Listo. La cuenta ya puede leer Secret Manager.');
  console.log('Probá de nuevo el email de prueba en Admin → Mantenimiento.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
