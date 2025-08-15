// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { credential } from 'firebase-admin';

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  projectId: "shotanalisys",
  appId: "1:602998191800:web:92f34de8304fc30ac5264d",
  storageBucket: "shotanalisys.appspot.com",
  apiKey: "AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4",
  authDomain: "shotanalisys.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "602998191800",
};


// Initialize Firebase for the client
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Firebase Admin SDK for the server
let adminApp: AdminApp;

if (!getAdminApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : {};

    adminApp = initializeAdminApp({
        credential: credential.cert(serviceAccount),
        storageBucket: firebaseConfig.storageBucket,
    });
} else {
    adminApp = getAdminApp();
}

const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);
const adminStorage = getAdminStorage(adminApp);


export { app, auth, db, storage, adminApp, adminAuth, adminDb, adminStorage };