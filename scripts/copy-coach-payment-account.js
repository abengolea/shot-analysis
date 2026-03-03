// Copy MercadoPago payment account config between coaches.
// Usage:
//   node scripts/copy-coach-payment-account.js --from-email victor@x.com --to-email adrian@x.com --force
//   node scripts/copy-coach-payment-account.js --from-id COACH_ID_1 --to-id COACH_ID_2 --force
// Optional: --dry-run (no write)

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

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function resolveCoachId(db, inputId, inputEmail) {
  if (inputId) return inputId;
  if (!inputEmail) return null;
  const email = String(inputEmail).toLowerCase();
  const snap = await db.collection('coaches').where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function main() {
  loadEnv();

  const fromIdArg = getArg('--from-id');
  const toIdArg = getArg('--to-id');
  const fromEmailArg = getArg('--from-email');
  const toEmailArg = getArg('--to-email');
  const dryRun = hasFlag('--dry-run');
  const force = hasFlag('--force');

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

  const fromId = await resolveCoachId(db, fromIdArg, fromEmailArg);
  const toId = await resolveCoachId(db, toIdArg, toEmailArg);

  if (!fromId || !toId) {
    console.error('Faltan IDs de coach. Use --from-id/--to-id o --from-email/--to-email.');
    process.exit(1);
  }
  if (fromId === toId) {
    console.error('El origen y destino no pueden ser el mismo coach.');
    process.exit(1);
  }

  const collection = 'coach_payment_accounts';
  const sourceRef = db.collection(collection).doc(fromId);
  const targetRef = db.collection(collection).doc(toId);

  const sourceSnap = await sourceRef.get();
  if (!sourceSnap.exists) {
    console.error(`No existe configuración de pago para coach origen (${fromId}).`);
    process.exit(2);
  }
  const sourceData = sourceSnap.data() || {};

  const targetSnap = await targetRef.get();
  if (targetSnap.exists && !force) {
    console.error(`Ya existe configuración en destino (${toId}). Use --force para sobrescribir.`);
    process.exit(3);
  }

  const nowIso = new Date().toISOString();
  const payload = {
    ...sourceData,
    coachId: toId,
    updatedAt: nowIso,
    ...(sourceData.createdAt ? {} : { createdAt: nowIso }),
  };

  if (dryRun) {
    console.log('Dry run. Datos a escribir:');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  await targetRef.set(payload, { merge: false });
  console.log(`OK. Configuración copiada de ${fromId} a ${toId}.`);
}

main().catch((err) => {
  console.error('Error copiando configuración:', err);
  process.exit(10);
});
