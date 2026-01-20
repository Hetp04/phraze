// Firebase configuration

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

// Initialize Firebase if not already initialized
if (typeof firebase !== 'undefined' && !firebase.apps?.length) {
  firebase.initializeApp(firebaseConfig);
}

// Get database instance
const database = firebase.database();

// Make these available globally
self.firebaseConfig = firebaseConfig;
self.firebaseDB = database; 