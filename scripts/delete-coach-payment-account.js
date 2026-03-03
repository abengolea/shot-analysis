// Delete MercadoPago payment account config for a coach.
// Usage (PowerShell):
//   $env:COACH_ID="COACH_ID"
//   node scripts/delete-coach-payment-account.js
// Optional:
//   $env:DRY_RUN="1"

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
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

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta variable requerida: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  loadEnv();

  const coachId = requiredEnv('COACH_ID');
  const dryRun = process.env.DRY_RUN === '1';

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'shotanalisys';
  const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || 'shotanalisys.firebasestorage.app';
  const rawClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;
  const hasServiceAccount = Boolean(rawClientEmail && privateKey && !rawClientEmail.includes('REEMPLAZAR'));

  if (!admin.apps.length) {
    if (hasServiceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail: rawClientEmail,
          privateKey,
        }),
        storageBucket,
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
        storageBucket,
      });
    }
  }

  const db = admin.firestore();
  const ref = db.collection('coach_payment_accounts').doc(coachId);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log(`No existe configuración para coach ${coachId}. Nada para borrar.`);
    return;
  }

  if (dryRun) {
    console.log('DRY_RUN=1. No se borró el doc.');
    console.log(JSON.stringify({ coachId, exists: true }, null, 2));
    return;
  }

  await ref.delete();
  console.log(`OK. Configuración borrada para coach ${coachId}.`);
}

main().catch((err) => {
  console.error('Error borrando configuración:', err);
  process.exit(10);
});
