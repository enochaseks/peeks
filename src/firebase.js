import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAbBdc2elEzZZfspJBzHBBzBhzn1CUK1vw",
    authDomain: "peeks-10178.firebaseapp.com",
    projectId: "peeks-10178",
    storageBucket: "peeks-10178.firebasestorage.app",
    messagingSenderId: "112986385937",
    appId: "1:112986385937:web:1c1be07e47a8b878e90bb0",
    measurementId: "G-CCWPYP4MPV"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app; 