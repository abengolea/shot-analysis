// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp, App as AdminApp, credential } from 'firebase-admin/app';
import { getAuth as getAdminAuth, Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, Storage as AdminStorage } from 'firebase-admin/storage';

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  projectId: "shotanalisys",
  appId: "1:602998191800:web:92f34de8304fc30ac5264d",
  storageBucket: "shotanalisys.appspot.com",
  apiKey: "AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4", // This is a public key
  authDomain: "shotanalisys.firebaseapp.com",
  messagingSenderId: "602998191800",
  measurementId: "G-4J79G4X1B6",
};

// Initialize Firebase Client SDK
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Firebase Admin SDK for the server
let adminApp: AdminApp | undefined;
let adminAuth: AdminAuth | undefined;
let adminDb: AdminFirestore | undefined;
let adminStorage: AdminStorage | undefined;

try {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && privateKey) {
    const firebaseAdminConfig = {
      credential: credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      storageBucket: firebaseConfig.storageBucket,
    };

    if (getAdminApps().length === 0) {
      adminApp = initializeAdminApp(firebaseAdminConfig);
    } else {
      adminApp = getAdminApp();
    }
  } else {
      console.warn("Las variables de entorno de administrador de Firebase no están completamente configuradas. Las funciones de administrador de Firebase no estarán disponibles.");
  }

  if (adminApp) {
    adminAuth = getAdminAuth(adminApp);
    adminDb = getAdminFirestore(adminApp);
    adminStorage = getAdminStorage(adminApp);
  }

} catch (error) {
  console.error("Error al inicializar Firebase Admin SDK:", error);
}


export { app, auth, db, storage, adminApp, adminAuth, adminDb, adminStorage };
