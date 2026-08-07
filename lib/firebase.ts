// ~136 kB gzip and every tool works signed out, so no static sdk import here; type-only erases
import type { FirebaseApp } from "firebase/app"
import type { Auth, GoogleAuthProvider } from "firebase/auth"
import type { Firestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = (): boolean => {
  return !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
}

// live bindings, null until the matching ensure* call resolves
export let auth: Auth | null = null
export let db: Firestore | null = null
export let googleProvider: GoogleAuthProvider | null = null

export interface FirebaseAuthServices {
  auth: Auth
  googleProvider: GoogleAuthProvider
}

let appPromise: Promise<FirebaseApp> | null = null
let authPromise: Promise<FirebaseAuthServices> | null = null
let firestorePromise: Promise<Firestore> | null = null

// `??=` caches a rejected promise, so one flaky chunk fetch would break sign-in for the session
function retryable<T>(load: () => Promise<T>, clear: () => void): Promise<T> {
  return load().catch((error: unknown) => {
    clear()
    throw error
  })
}

function ensureApp(): Promise<FirebaseApp> {
  appPromise ??= retryable(
    () =>
      import("firebase/app").then(({ initializeApp, getApps, getApp }) =>
        getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
      ),
    () => {
      appPromise = null
    }
  )
  return appPromise
}

// resolves null when the app ships without credentials, the default for a local clone
export function ensureAuth(): Promise<FirebaseAuthServices | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null)
  authPromise ??= retryable(loadAuth, () => {
    authPromise = null
  })
  return authPromise
}

async function loadAuth(): Promise<FirebaseAuthServices> {
  const [app, mod] = await Promise.all([ensureApp(), import("firebase/auth")])
  auth = mod.getAuth(app)
  googleProvider = new mod.GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: "select_account" })
  return { auth, googleProvider }
}

// separate from auth so sign-in waits on the ~26 kB auth chunk, not the ~110 kB firestore one
export function ensureFirestore(): Promise<Firestore | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null)
  firestorePromise ??= retryable(loadFirestore, () => {
    firestorePromise = null
  })
  return firestorePromise
}

async function loadFirestore(): Promise<Firestore> {
  const [app, { initializeFirestore }] = await Promise.all([
    ensureApp(),
    import("firebase/firestore"),
  ])
  // firestore rejects undefined outright, so saving a project with an unset optional sharing
  // field threw, and the swallowed error meant cloud sync silently never happened
  db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  return db
}

const SESSION_HINT_KEY = "netdash-auth-session"
// firebase auth's own persistence, probed by name only when our hint is missing
const FIREBASE_AUTH_DB = "firebaseLocalStorageDb"

// lets the next load answer "signed in?" without the sdk
export function writeSessionHint(signedIn: boolean): void {
  try {
    localStorage.setItem(SESSION_HINT_KEY, signedIn ? "1" : "0")
  } catch {
    // private mode or a full quota must not break sign-in
  }
}

function readSessionHint(): "signed-in" | "signed-out" | "unknown" {
  try {
    const value = localStorage.getItem(SESSION_HINT_KEY)
    if (value === "1") return "signed-in"
    if (value === "0") return "signed-out"
  } catch {
    // fall through to the probe
  }
  return "unknown"
}

// sessions predating the hint leave no marker, so ask indexeddb instead; self-heals on next load
async function hasLegacyAuthDatabase(): Promise<boolean> {
  try {
    // the guard must be inside the try: reading the global throws when storage is
    // blocked, which used to reject and hang the auth provider
    if (typeof indexedDB === "undefined") return false
    if (typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases()
      return databases.some((entry) => entry.name === FIREBASE_AUTH_DB)
    }
  } catch {
    // fall through
  }
  // cannot tell: load the sdk rather than show a signed-in user as signed out
  return true
}

// answered without loading the sdk; decides whether a fresh page load pays for firebase at all
export async function hasStoredSession(): Promise<boolean> {
  if (!isFirebaseConfigured()) return false
  const hint = readSessionHint()
  if (hint !== "unknown") return hint === "signed-in"

  const legacy = await hasLegacyAuthDatabase()
  // record the answer so the next load is a plain localStorage read
  if (!legacy) writeSessionHint(false)
  return legacy
}
