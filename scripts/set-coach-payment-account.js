// Set MercadoPago payment account config for a coach.
// Usage (PowerShell):
//   $env:COACH_ID="COACH_ID_ADRIAN"
//   $env:MP_ACCESS_TOKEN="APP_USR-..."
//   $env:MP_PUBLIC_KEY="APP_USR-..."
//   $env:MP_USER_ID="5523..."
//   $env:MP_STATUS="active"
//   node scripts/set-coach-payment-account.js
// Optional:
//   $env:MP_REFRESH_TOKEN="..."
//   $env:MP_PLATFORM_FEE_PERCENT="30"
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
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

function parseNumberEnv(name) {
  const raw = process.env[name];
  if (!raw) return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

async function main() {
  loadEnv();

  const coachId = requiredEnv('COACH_ID');
  const mpAccessToken = requiredEnv('MP_ACCESS_TOKEN');
  const mpPublicKey = requiredEnv('MP_PUBLIC_KEY');
  const mpUserId = parseNumberEnv('MP_USER_ID');
  const mpRefreshToken = process.env.MP_REFRESH_TOKEN;
  const platformFeePercent = parseNumberEnv('MP_PLATFORM_FEE_PERCENT');
  const status = process.env.MP_STATUS || 'active';
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
  const nowIso = new Date().toISOString();

  const payload = {
    coachId,
    mpAccessToken,
    mpPublicKey,
    ...(typeof mpUserId === 'number' ? { mpUserId } : {}),
    ...(mpRefreshToken ? { mpRefreshToken } : {}),
    ...(typeof platformFeePercent === 'number' ? { platformFeePercent } : {}),
    status,
    updatedAt: nowIso,
    ...(snap.exists ? {} : { createdAt: nowIso }),
  };

  if (dryRun) {
    console.log('DRY_RUN=1. No se escribieron datos.');
    console.log(JSON.stringify({ coachId, status, hasUserId: !!mpUserId, hasRefreshToken: !!mpRefreshToken, hasPlatformFee: typeof platformFeePercent === 'number' }, null, 2));
    return;
  }

  await ref.set(payload, { merge: true });
  console.log(`OK. Configuración MP guardada para coach ${coachId}.`);
}

main().catch((err) => {
  console.error('Error guardando configuración MP:', err);
  process.exit(10);
});
