// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "shotanalisys.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "shotanalisys",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "shotanalisys.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "602998191800",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:602998191800:web:dd8a758d589b12b3c5264d",
  // measurementId es opcional en desarrollo
};

// Evitar inicializar en build del lado servidor sin variables válidas
const isBrowser = typeof window !== 'undefined';

let app: any = undefined;
if (isBrowser) {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
}

const auth: any = isBrowser && app ? getAuth(app) : undefined as any;
const db: any = isBrowser && app ? getFirestore(app) : undefined as any;
const storage: any = isBrowser && app ? getStorage(app) : undefined as any;

export { app, auth, db, storage };
