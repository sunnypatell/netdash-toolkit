import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { initializeFirestore } from "firebase/firestore"

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
}

// Initialize Firebase only if configured
const app = isFirebaseConfigured()
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null

// Export Firebase services (will be null if not configured)
export const auth = app ? getAuth(app) : null
// ignoreUndefinedProperties: Project carries optional sharing fields
// (sharedWith, isShared, ownerEmail), and firestore rejects an undefined value
// outright. every save of a project with an unset optional field used to throw
// and the error was swallowed, so cloud sync silently never happened.
export const db = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null
export const googleProvider = app ? new GoogleAuthProvider() : null

// Configure Google provider for better UX
if (googleProvider) {
  googleProvider.setCustomParameters({
    prompt: "select_account",
  })
}
