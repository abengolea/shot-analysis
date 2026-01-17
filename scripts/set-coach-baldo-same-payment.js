/**
 * Configura a Baldo para usar la misma forma de cobro que Velasco y Bengolea
 * y la misma tarifa (25.000 ARS).
 *
 * Uso:
 *   node scripts/set-coach-baldo-same-payment.js
 */
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

const fallbackProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'shotanalisys';
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  process.env.GOOGLE_CLOUD_PROJECT = fallbackProjectId;
}
if (!process.env.GCLOUD_PROJECT) {
  process.env.GCLOUD_PROJECT = fallbackProjectId;
}

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || fallbackProjectId,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw new Error('Faltan FIREBASE_ADMIN_CLIENT_EMAIL o FIREBASE_ADMIN_PRIVATE_KEY');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

const db = admin.firestore();

async function findCoachByEmail(email) {
  const snap = await db.collection('coaches').where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() || {} };
}

async function findCoachByName(name) {
  const snap = await db.collection('coaches').where('name', '==', name).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() || {} };
}

async function main() {
  const baldoEmail = 'Victorbaldo25@gmail.com'.toLowerCase();
  const velascoEmail = 'profevelasco80@gmail.com'.toLowerCase();
  const bengoleaEmail = 'abengolea1@gmail.com'.toLowerCase();

  const baldo = await findCoachByEmail(baldoEmail);
  const velasco =
    (await findCoachByEmail(velascoEmail)) ||
    (await findCoachByName('Esteban Daniel Velasco'));
  const bengolea =
    (await findCoachByEmail(bengoleaEmail)) ||
    (await findCoachByName('Adrian Bengolea'));

  if (!baldo) {
    throw new Error(`No se encontró al coach Baldo con email ${baldoEmail}`);
  }
  if (!velasco || !bengolea) {
    throw new Error('No se encontraron los coaches Velasco y/o Bengolea por email o nombre');
  }

  const velascoOwnerId = velasco.data.paymentAccountOwnerId || null;
  const bengoleaOwnerId = bengolea.data.paymentAccountOwnerId || null;
  const velascoOwnerEmail = velasco.data.paymentAccountOwnerEmail || null;
  const bengoleaOwnerEmail = bengolea.data.paymentAccountOwnerEmail || null;
  const velascoOwnerName = velasco.data.paymentAccountOwnerName || null;
  const bengoleaOwnerName = bengolea.data.paymentAccountOwnerName || null;

  if (velascoOwnerId !== bengoleaOwnerId) {
    throw new Error(
      `Owner distinto: Velasco(${velascoOwnerId}) vs Bengolea(${bengoleaOwnerId}). ` +
      'Definí cuál usar antes de actualizar Baldo.'
    );
  }

  const ownerId = velascoOwnerId || null;
  const ownerEmail = velascoOwnerEmail || bengoleaOwnerEmail || null;
  const ownerName = velascoOwnerName || bengoleaOwnerName || null;
  const nowIso = new Date().toISOString();

  const newRate = 25000;
  const update = {
    ratePerAnalysis: newRate,
    showRate: true,
    updatedAt: nowIso,
  };
  if (ownerId) {
    update.paymentAccountOwnerId = ownerId;
    update.paymentAccountOwnerEmail = ownerEmail;
    update.paymentAccountOwnerName = ownerName;
  } else {
    update.paymentAccountOwnerId = null;
    update.paymentAccountOwnerEmail = null;
    update.paymentAccountOwnerName = null;
  }
  await db.collection('coaches').doc(baldo.id).set(update, { merge: true });

  console.log('✅ Baldo actualizado');
  console.log(`   ID: ${baldo.id}`);
  console.log(`   Email: ${baldoEmail}`);
  console.log(`   Tarifa: $${newRate} ARS`);
  console.log(`   Owner: ${ownerId} (${ownerEmail || 'sin email'})`);
}

main().catch((err) => {
  console.error('❌ Error actualizando Baldo:', err.message || err);
  process.exit(1);
});
