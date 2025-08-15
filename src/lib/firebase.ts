// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  projectId: "shotanalisys",
  appId: "1:602998191800:web:92f34de8304fc30ac5264d",
  storageBucket: "shotanalisys.firebasestorage.app",
  apiKey: "AIzaSyBYvIGN0-Yd1b7LG2Seg6VwfKnTYIo4n_4",
  authDomain: "shotanalisys.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "602998191800",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
