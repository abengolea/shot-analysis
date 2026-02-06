/**
 * Crea o actualiza los secretos de Resend en Google Cloud Secret Manager.
 * Lee RESEND_API_KEY, RESEND_FROM, RESEND_REPLY_TO desde .env.local.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/setup-resend-secrets.js
 *
 * Requisitos:
 *   - gcloud auth application-default login (o GOOGLE_APPLICATION_CREDENTIALS)
 *   - Proyecto con Secret Manager API habilitada
 *   - Rol "Secret Manager Admin" para crear secretos (o crear manualmente y solo añadir versiones)
 */

const fs = require('fs');
const path = require('path');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('No se encontró .env.local en la raíz del proyecto.');
    process.exit(1);
  }
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function ensureSecret(client, projectId, secretId, value) {
  const parent = `projects/${projectId}`;
  const fullName = `${parent}/secrets/${secretId}`;

  try {
    await client.getSecret({ name: fullName });
  } catch (e) {
    const isNotFound =
      e.code === 5 ||
      e.code === 404 ||
      (e.details && String(e.details).toLowerCase().includes('not found')) ||
      (e.message && String(e.message).toLowerCase().includes('not found'));
    if (!isNotFound) throw e;
    await client.createSecret({
      parent,
      secretId,
      secret: {
        replication: { automatic: {} },
      },
    });
    console.log(`  Creado secreto: ${secretId}`);
  }

  await client.addSecretVersion({
    parent: fullName,
    payload: { data: Buffer.from(value, 'utf8') },
  });
  console.log(`  Nueva versión añadida: ${secretId}`);
}

async function main() {
  loadEnvLocal();

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    'shotanalisys';

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  const replyTo = process.env.RESEND_REPLY_TO?.trim();

  if (!apiKey || !from) {
    console.error('En .env.local deben estar definidos RESEND_API_KEY y RESEND_FROM.');
    process.exit(1);
  }

  console.log(`Proyecto GCP: ${projectId}`);
  console.log('Subiendo secretos Resend a Secret Manager...\n');

  const client = new SecretManagerServiceClient();

  await ensureSecret(client, projectId, 'RESEND_API_KEY', apiKey);
  await ensureSecret(client, projectId, 'RESEND_FROM', from);
  if (replyTo) {
    await ensureSecret(client, projectId, 'RESEND_REPLY_TO', replyTo);
  } else {
    console.log('  RESEND_REPLY_TO no definido en .env.local; se omite.');
  }

  console.log('\nListo. Siguiente paso: dar a la cuenta de servicio de App Hosting el rol "Secret Manager Secret Accessor".');
  console.log('Ver docs/resend-secret-manager.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
