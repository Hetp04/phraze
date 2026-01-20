// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


const firebaseConfig = {
  apiKey: "AIzaSyDo14yGOxdQDTJ7YfczJReS7UmLPrPvuy8",
  authDomain: "phraze-d7b77.firebaseapp.com",
  databaseURL: "https://phraze-d7b77-default-rtdb.firebaseio.com",
  projectId: "phraze-d7b77",
  storageBucket: "phraze-d7b77.firebasestorage.app",
  messagingSenderId: "143602089096",
  appId: "1:143602089096:web:d078397665ab66ddbdb33d",
  measurementId: "G-HZEM3PFL6N"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

export { app, database, auth, firestore };
export default app;