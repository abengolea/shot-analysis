/**
 * Script para asignar el owner de la cuenta de cobro de un entrenador.
 * Uso:
 *   node scripts/set-coach-payment-owner.js \
 *     --targetEmail profevelasco80@gmail.com \
 *     --ownerEmail abengolea1@gmail.com
 *
 * También podés usar --targetId y --ownerId.
 */
const admin = require('firebase-admin');

const fallbackProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'shotanalisys';
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  process.env.GOOGLE_CLOUD_PROJECT = fallbackProjectId;
}
if (!process.env.GCLOUD_PROJECT) {
  process.env.GCLOUD_PROJECT = fallbackProjectId;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;
    const [key, value] = part.replace(/^--/, '').split('=');
    args[key] = value ?? argv[i + 1];
    if (value === undefined) i += 1;
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);
  const targetEmail = args.targetEmail || process.env.TARGET_COACH_EMAIL;
  const ownerEmail = args.ownerEmail || process.env.OWNER_COACH_EMAIL;
  const targetIdArg = args.targetId || process.env.TARGET_COACH_ID;
  const ownerIdArg = args.ownerId || process.env.OWNER_COACH_ID;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || fallbackProjectId;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  if (admin.apps.length === 0) {
    if (!clientEmail || !privateKey) {
      throw new Error('Faltan FIREBASE_ADMIN_CLIENT_EMAIL o FIREBASE_ADMIN_PRIVATE_KEY');
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }
  const db = admin.firestore();

  let targetId = targetIdArg;
  if (!targetId) {
    if (!targetEmail) throw new Error('Debes especificar --targetEmail o --targetId');
    const snap = await db.collection('coaches').where('email', '==', targetEmail).limit(1).get();
    if (snap.empty) throw new Error(`No se encontró coach target con email ${targetEmail}`);
    targetId = snap.docs[0].id;
  }

  let ownerId = ownerIdArg;
  if (!ownerId) {
    if (!ownerEmail) throw new Error('Debes especificar --ownerEmail o --ownerId');
    const snap = await db.collection('coaches').where('email', '==', ownerEmail).limit(1).get();
    if (snap.empty) throw new Error(`No se encontró coach owner con email ${ownerEmail}`);
    ownerId = snap.docs[0].id;
  }

  const ownerDoc = await db.collection('coaches').doc(ownerId).get();
  const ownerData = ownerDoc.exists ? ownerDoc.data() || {} : {};
  const nowIso = new Date().toISOString();

  await db.collection('coaches').doc(targetId).set(
    {
      paymentAccountOwnerId: ownerId,
      paymentAccountOwnerEmail: ownerData.email || null,
      paymentAccountOwnerName: ownerData.name || null,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  console.log(`✅ Owner de cobro asignado: target ${targetId} -> owner ${ownerId}`);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Error asignando owner de cobro:', err);
  process.exit(1);
});
