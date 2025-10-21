// Firebase Admin SDK - Solo para uso en el servidor
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp, App as AdminApp } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import { getAuth as getAdminAuth, Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, Storage as AdminStorage } from 'firebase-admin/storage';

// Configuración del proyecto
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "shotanalisys";
// Bucket real (dominio nuevo)
const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || "shotanalisys.firebasestorage.app";

console.log("  - FIREBASE_ADMIN_PROJECT_ID:", process.env.FIREBASE_ADMIN_PROJECT_ID);
console.log("  - FIREBASE_ADMIN_STORAGE_BUCKET:", process.env.FIREBASE_ADMIN_STORAGE_BUCKET);
// Initialize Firebase Admin SDK for the server
let adminApp: AdminApp | undefined;
let _adminAuth: AdminAuth | undefined;
let _adminDb: AdminFirestore | undefined;
let _adminStorage: AdminStorage | undefined;

try {
  const rawClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;
  const hasRealServiceAccount = Boolean(
    rawClientEmail && privateKey &&
    !rawClientEmail.includes('REEMPLAZAR') &&
    !rawPrivateKey.includes('REEMPLAZAR')
  );

  if (hasRealServiceAccount) {
    const firebaseAdminConfig = {
      credential: credential.cert({
        projectId,
        clientEmail: rawClientEmail,
        privateKey: privateKey as string,
      }),
      storageBucket,
    } as any;

    console.log("🔍 Firebase Admin - Configuración (Service Account):");
    console.log("  - projectId:", projectId);
    console.log("  - storageBucket:", storageBucket);

    if (getAdminApps().length === 0) {
      adminApp = initializeAdminApp(firebaseAdminConfig);
      console.log("✅ Firebase Admin App creado (service account)");
    } else {
      adminApp = getAdminApp();
          }
  } else {
    // En desarrollo local, no inicializar Firebase Admin
        console.log("ℹ️ El upload funcionará solo con Firebase Client SDK");
    adminApp = undefined;
  }

  if (adminApp) {
    _adminAuth = getAdminAuth(adminApp);
    _adminDb = getAdminFirestore(adminApp);
    _adminStorage = getAdminStorage(adminApp);
        // Verificar que adminStorage esté disponible
    if (_adminStorage) {
      const bucket = _adminStorage.bucket();
                  // Aviso si el bucket no es el estándar
      if (bucket.name !== storageBucket) {
        console.warn("⚠️ Bucket en uso distinto al configurado:", storageBucket, "Actual:", bucket.name);
      }
    } else {
      console.error("❌ Admin Storage NO está disponible");
    }
  }

} catch (error) {
  console.error("❌ Error al inicializar Firebase Admin SDK:", error);
}

// Exportar como no opcionales para simplificar tipos en rutas; en runtime usar ADC o fallar temprano
export const adminAuth: AdminAuth = _adminAuth as unknown as AdminAuth;
export const adminDb: AdminFirestore = _adminDb as unknown as AdminFirestore;
export const adminStorage: AdminStorage = _adminStorage as unknown as AdminStorage;
export { adminApp };
