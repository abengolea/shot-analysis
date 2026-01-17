/**
 * Script para registrar/actualizar la cuenta de Mercado Pago de un entrenador.
 * Uso:
 *   node scripts/set-coach-payment-account.js \
 *     --email adrian.bengolea@gmail.com \
 *     --mpUserId 4998140714247100 \
 *     --accessToken APP_USR-... \
 *     --refreshToken ... \
 *     --publicKey APP_USR-...
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
  const email = args.email || process.env.COACH_EMAIL;
  const coachIdArg = args.coachId || process.env.COACH_ID;
  const mpUserId = args.mpUserId || process.env.MP_USER_ID;
  const accessToken = args.accessToken || process.env.MP_ACCESS_TOKEN_COACH;
  const refreshToken = args.refreshToken || process.env.MP_REFRESH_TOKEN_COACH;
  const publicKey = args.publicKey || process.env.MP_PUBLIC_KEY_COACH;
  const platformFeePercent = Number(args.platformFeePercent ?? '30');

  if (!email) {
    throw new Error('Debes especificar --email');
  }
  if (!mpUserId || !accessToken) {
    throw new Error('Debes especificar --mpUserId y --accessToken');
  }

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

  let coachId = coachIdArg;
  if (!coachId) {
    const coachSnap = await db.collection('coaches').where('email', '==', email).limit(1).get();
    if (coachSnap.empty) {
      throw new Error(`No se encontró coach con email ${email}. Podés pasar --coachId para especificarlo manualmente.`);
    }
    coachId = coachSnap.docs[0].id;
  }
  const nowIso = new Date().toISOString();

  await db
    .collection('coach_payment_accounts')
    .doc(coachId)
    .set(
      {
        coachId,
        mpUserId: Number(mpUserId),
        mpAccessToken: accessToken,
        ...(refreshToken ? { mpRefreshToken: refreshToken } : {}),
        ...(publicKey ? { mpPublicKey: publicKey } : {}),
        platformFeePercent,
        status: 'active',
        updatedAt: nowIso,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  console.log(`✅ Cuenta MP configurada para coach ${coachId} (${email})`);
  process.exit(0);
})().catch((err) => {
  console.error('❌ Error configurando cuenta MP:', err);
  process.exit(1);
});

