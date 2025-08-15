// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp, App as AdminApp, credential } from 'firebase-admin/app';
import { getAuth as getAdminAuth, Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, Storage as AdminStorage } from 'firebase-admin/storage';
import { getAppCheck } from "firebase-admin/app-check";


// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  projectId: "shotanalisys",
  appId: "1:602998191800:web:92f34de8304fc30ac5264d",
  storageBucket: "shotanalisys.appspot.com",
  // The API key is sensitive and should not be stored in source code.
  // We will load it from the server.
  // apiKey: "AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4",
  authDomain: "shotanalisys.firebaseapp.com",
  measurementId: "G-4J79G4X1B6",
  messagingSenderId: "602998191800",
};


// A server-side endpoint to fetch the Firebase config.
async function getFirebaseConfig(): Promise<FirebaseOptions> {
    const response = await fetch('/__/firebase/init.json');
    if (!response.ok) {
        throw new Error('Failed to fetch Firebase config.');
    }
    return response.json();
}

// Initialize Firebase for the client, potentially loading the config async.
let app;
if (typeof window !== 'undefined' && !getApps().length) {
    // On the client, fetch the config and then initialize.
    // This top-level await is supported in modern bundlers like Next.js.
    app = initializeApp(await getFirebaseConfig());
} else if (getApps().length > 0) {
    app = getApp();
} else {
    // On the server, initialize with the basic config (without apiKey).
    // Server-side operations will use the Admin SDK.
    app = initializeApp(firebaseConfig);
}


const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Firebase Admin SDK for the server
let adminApp: AdminApp | undefined;
let adminAuth: AdminAuth | undefined;
let adminDb: AdminFirestore | undefined;
let adminStorage: AdminStorage | undefined;


if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (!getAdminApps().length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        adminApp = initializeAdminApp({
            credential: credential.cert(serviceAccount),
            storageBucket: firebaseConfig.storageBucket,
        });
    } else {
        adminApp = getAdminApp();
    }
}


if (adminApp) {
    adminAuth = getAdminAuth(adminApp);
    adminDb = getAdminFirestore(adminApp);
    adminStorage = getAdminStorage(adminApp);
}


export { app, auth, db, storage, adminApp, adminAuth, adminDb, adminStorage };
