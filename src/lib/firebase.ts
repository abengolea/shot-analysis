// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

export { app, auth, db, storage };
