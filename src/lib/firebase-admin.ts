// Firebase Admin SDK - Solo para uso en el servidor
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp, App as AdminApp } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import { getAuth as getAdminAuth, Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, Storage as AdminStorage } from 'firebase-admin/storage';

// Configuración del proyecto
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "shotanalisys";
// Usar la variable de entorno del .env.local
const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || "shotanalisys.firebasestorage.app";

console.log("🔍 Firebase Admin - Variables de entorno:");
console.log("  - FIREBASE_ADMIN_PROJECT_ID:", process.env.FIREBASE_ADMIN_PROJECT_ID);
console.log("  - FIREBASE_ADMIN_STORAGE_BUCKET:", process.env.FIREBASE_ADMIN_STORAGE_BUCKET);
console.log("  - FIREBASE_ADMIN_CLIENT_EMAIL:", process.env.FIREBASE_ADMIN_CLIENT_EMAIL ? "✅ Configurado" : "❌ No configurado");
console.log("  - FIREBASE_ADMIN_PRIVATE_KEY:", process.env.FIREBASE_ADMIN_PRIVATE_KEY ? "✅ Configurado" : "❌ No configurado");

// Initialize Firebase Admin SDK for the server
let adminApp: AdminApp | undefined;
let adminAuth: AdminAuth | undefined;
let adminDb: AdminFirestore | undefined;
let adminStorage: AdminStorage | undefined;

try {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && privateKey) {
    const firebaseAdminConfig = {
      credential: credential.cert({
        projectId,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      storageBucket,
    };

    console.log("🔍 Firebase Admin - Configuración:");
    console.log("  - projectId:", projectId);
    console.log("  - storageBucket:", storageBucket);
    console.log("  - ✅ Usando bucket de .env.local:", storageBucket);

    if (getAdminApps().length === 0) {
      adminApp = initializeAdminApp(firebaseAdminConfig);
      console.log("✅ Firebase Admin App creado");
    } else {
      adminApp = getAdminApp();
      console.log("✅ Firebase Admin App obtenido existente");
    }
    
    console.log("✅ Firebase Admin SDK inicializado correctamente");
  } else {
      console.warn("⚠️ Las variables de entorno de administrador de Firebase no están completamente configuradas.");
      console.warn("📝 Asegúrate de que FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY estén definidos en .env.local");
  }

  if (adminApp) {
    adminAuth = getAdminAuth(adminApp);
    adminDb = getAdminFirestore(adminApp);
    adminStorage = getAdminStorage(adminApp);
    console.log("✅ Servicios de Firebase Admin inicializados");
    
    // Verificar que adminStorage esté disponible
    if (adminStorage) {
      const bucket = adminStorage.bucket();
      console.log("✅ Admin Storage disponible, bucket:", bucket.name);
      console.log("🔍 Verificando bucket name:", bucket.name);
      
      // Verificar que el bucket sea el correcto
      if (bucket.name === "shotanalisys.firebasestorage.app") {
        console.log("✅ Bucket correcto configurado!");
      } else {
        console.error("❌ BUCKET INCORRECTO! Esperado: shotanalisys.firebasestorage.app, Actual:", bucket.name);
      }
    } else {
      console.error("❌ Admin Storage NO está disponible");
    }
  }

} catch (error) {
  console.error("❌ Error al inicializar Firebase Admin SDK:", error);
}

export { adminApp, adminAuth, adminDb, adminStorage };
