// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgP4QjssP5LkDPaZE45VXClNYawoCA0NM",
  authDomain: "new-questions-analyzer.firebaseapp.com",
  projectId: "new-questions-analyzer",
  storageBucket: "new-questions-analyzer.appspot.com",
  messagingSenderId: "559655327356",
  appId: "1:559655327356:web:1c46404af7f0de0be81bf9"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
