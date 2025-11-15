// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import Constants from "expo-constants";

// Firebase configuration from environment variables via expo-constants
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: Constants.expoConfig?.extra?.firebaseAppId,
};

// Debug: log para verificar se as variáveis foram carregadas
console.log("Firebase Config:", {
  apiKey: firebaseConfig.apiKey ? "✓ Loaded" : "✗ Missing",
  authDomain: firebaseConfig.authDomain ? "✓ Loaded" : "✗ Missing",
  projectId: firebaseConfig.projectId ? "✓ Loaded" : "✗ Missing",
  storageBucket: firebaseConfig.storageBucket ? "✓ Loaded" : "✗ Missing",
  messagingSenderId: firebaseConfig.messagingSenderId
    ? "✓ Loaded"
    : "✗ Missing",
  appId: firebaseConfig.appId ? "✓ Loaded" : "✗ Missing",
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth (React Native handles persistence automatically)
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);
