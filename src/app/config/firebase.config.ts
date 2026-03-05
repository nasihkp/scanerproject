import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

const isConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

// Initialize Firebase
export const app = isConfigured ? initializeApp(firebaseConfig) : null;

// Auth
export const auth = app ? getAuth(app) : null;

// Google Provider (ONLY if configured)
export const googleProvider = isConfigured
  ? new GoogleAuthProvider()
  : null;

if (googleProvider) {
  // ✅ REQUIRED Drive scope (visible in My Drive)
  googleProvider.addScope(
    "https://www.googleapis.com/auth/drive.file"
  );

  // ✅ Force consent screen (VERY IMPORTANT)
  googleProvider.setCustomParameters({
    prompt: "consent",
  });
}

export const isFirebaseConfigured = isConfigured;
export default app;
