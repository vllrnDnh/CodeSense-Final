import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyCCEGAZ1a4ga7jiEFuKSY43wKn4ekDKY5s",
  authDomain: "codesense-d3d05.firebaseapp.com",
  projectId: "codesense-d3d05",
  storageBucket: "codesense-d3d05.firebasestorage.app",
  messagingSenderId: "411099370082",
  appId: "1:411099370082:web:831cdf906256d66702b73b",
  measurementId: "G-120L9QS8GB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// EXPORT: This makes 'db' available to your DatabaseService.ts file
export const db = getFirestore(app);