// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase config: las variables deben estar en .env.local o en el entorno de despliegue.
// No usar fallbacks hardcodeados por seguridad.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (typeof window !== 'undefined' && !firebaseConfig.apiKey) {
  console.error('[Firebase] NEXT_PUBLIC_FIREBASE_API_KEY no está configurada. Revisa .env.local');
}

// Evitar inicializar en build del lado servidor sin variables válidas
const isBrowser = typeof window !== 'undefined';

let app: any = undefined;
if (isBrowser && firebaseConfig.apiKey) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
}

const auth: any = isBrowser && app ? getAuth(app) : undefined as any;
const db: any = isBrowser && app ? getFirestore(app) : undefined as any;
const storage: any = isBrowser && app ? getStorage(app) : undefined as any;

// Configurar Firestore para manejar mejor los errores
if (isBrowser && db) {
  try {
    // En Firebase v9+ del cliente, no se usa db.settings()
    // La configuración se maneja automáticamente
    console.log('✅ Firestore inicializado correctamente');
  } catch (error) {
    console.warn('No se pudo configurar Firestore:', error);
  }
}

export { app, auth, db, storage };
