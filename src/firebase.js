import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace with your actual Firebase configuration keys from the Firebase Console
// Go to console.firebase.google.com -> Project Settings -> General -> Web App
const firebaseConfig = {
  apiKey: "AIzaSyCkp3lbL_VGQhHy-Pa10zl6pgKTMb_dpHY",
  authDomain: "test-p-6f80c.firebaseapp.com",
  projectId: "test-p-6f80c",
  storageBucket: "test-p-6f80c.firebasestorage.app",
  messagingSenderId: "519571570102",
  appId: "1:519571570102:web:11bfabcbf4782e1bc7d517",
  measurementId: "G-64L9VSH7M6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);
