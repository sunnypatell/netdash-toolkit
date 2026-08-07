"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import type { AuthError, OAuthCredential, User } from "firebase/auth"
import {
  ensureAuth,
  hasStoredSession,
  isFirebaseConfigured,
  writeSessionHint,
} from "@/lib/firebase"

interface AuthContextType {
  user: User | null
  loading: boolean
  isConfigured: boolean
  // returns success rather than making callers read `error`, which is stale in their render closure
  signInWithGoogle: () => Promise<boolean>
  signInWithEmail: (email: string, password: string) => Promise<boolean>
  signUpWithEmail: (email: string, password: string) => Promise<boolean>
  resetPassword: (email: string) => Promise<boolean>
  signOut: () => Promise<void>
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// held rather than re-requested, so concurrent sign-in paths share one instance
let authApi: Promise<typeof import("firebase/auth")> | null = null

function loadAuthApi() {
  authApi ??= import("firebase/auth")
  return authApi
}

// Helper to get user-friendly error messages
const getAuthErrorMessage = (error: AuthError): string => {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Try signing in instead."
    case "auth/invalid-email":
      return "Please enter a valid email address."
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled."
    case "auth/weak-password":
      return "Password should be at least 6 characters."
    case "auth/user-disabled":
      return "This account has been disabled."
    case "auth/user-not-found":
      return "No account found with this email."
    case "auth/wrong-password":
      return "Incorrect password."
    case "auth/invalid-credential":
      return "Invalid email or password."
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later."
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method."
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled."
    default:
      return error.message || "An error occurred during authentication."
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingCredential, setPendingCredential] = useState<OAuthCredential | null>(null)
  // flipped by any sign-in attempt, so the listener attaches for a visitor who
  // arrived signed out and therefore never loaded the sdk on mount
  const [authRequested, setAuthRequested] = useState(false)
  const isConfigured = isFirebaseConfigured()

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false)
      return
    }

    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const attach = async () => {
      const services = await ensureAuth()
      if (cancelled || !services) {
        if (!cancelled) setLoading(false)
        return
      }
      const { onAuthStateChanged } = await loadAuthApi()
      if (cancelled) return

      unsubscribe = onAuthStateChanged(
        services.auth,
        (user) => {
          setUser(user)
          setLoading(false)
          setError(null)
          // the next cold load reads this instead of the sdk
          writeSessionHint(!!user)
        },
        (error) => {
          console.error("Auth state change error:", error)
          setError(error.message)
          setLoading(false)
        }
      )
    }

    const start = async () => {
      // a visitor who has never signed in must not download the sdk to learn
      // that they are signed out
      if (!authRequested && !(await hasStoredSession())) {
        if (!cancelled) setLoading(false)
        return
      }
      await attach()
    }

    // every await here fetches a chunk; an unhandled rejection left `loading` true forever
    start().catch((error: unknown) => {
      console.error("Failed to initialise Firebase auth:", error)
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [authRequested])

  // pendingCredential is deliberately not a dep: it would reload the gsi script on every change
  const oneTapRef = useRef<(response: { credential: string }) => void>(() => {})

  useEffect(() => {
    if (!isConfigured || typeof window === "undefined") return

    // Wait for auth state to be determined before showing One Tap
    if (loading) return

    // Don't show One Tap if user is already signed in
    if (user) {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
      return
    }

    // Skip One Tap on localhost - it requires HTTPS and verified domains
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    if (isLocalhost) return

    // Google One Tap requires a separate OAuth client ID from Google Cloud Console
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) return // Skip One Tap if not configured

    // Load Google Identity Services script
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response: { credential: string }) => oneTapRef.current(response),
          auto_select: true,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: true, // Use FedCM for better UX in Chrome
        })
        window.google.accounts.id.prompt()
      }
    }
    document.head.appendChild(script)

    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
      script.remove()
    }
  }, [isConfigured, loading, user])

  const handleGoogleOneTap = async (response: { credential: string }) => {
    const services = await ensureAuth()
    if (!services) return
    setAuthRequested(true)

    try {
      setError(null)
      const { GoogleAuthProvider, signInWithCredential, linkWithCredential } = await loadAuthApi()
      const credential = GoogleAuthProvider.credential(response.credential)
      const result = await signInWithCredential(services.auth, credential)

      // Check if we need to link accounts
      if (pendingCredential && result.user) {
        try {
          await linkWithCredential(result.user, pendingCredential)
          setPendingCredential(null)
        } catch (linkError) {
          console.error("Account linking error:", linkError)
        }
      }
    } catch (error) {
      const authError = error as AuthError
      console.error("Google One Tap error:", error)
      setError(getAuthErrorMessage(authError))
    }
  }
  oneTapRef.current = handleGoogleOneTap

  const signInWithGoogle = async (): Promise<boolean> => {
    const services = await ensureAuth()
    if (!services) {
      setError("Firebase authentication is not configured")
      return false
    }
    setAuthRequested(true)

    try {
      setError(null)
      const { signInWithPopup, linkWithCredential } = await loadAuthApi()
      const result = await signInWithPopup(services.auth, services.googleProvider)

      // Check if we need to link accounts
      if (pendingCredential && result.user) {
        try {
          await linkWithCredential(result.user, pendingCredential)
          setPendingCredential(null)
        } catch (linkError) {
          console.error("Account linking error:", linkError)
        }
      }
      return true
    } catch (error) {
      const authError = error as AuthError

      // Handle account exists with different credential
      if (authError.code === "auth/account-exists-with-different-credential") {
        const { GoogleAuthProvider } = await loadAuthApi()
        const credential = GoogleAuthProvider.credentialFromError(authError)
        if (credential) {
          setPendingCredential(credential)
        }
      }

      console.error("Sign in error:", error)
      setError(getAuthErrorMessage(authError))
      return false
    }
  }

  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    const services = await ensureAuth()
    if (!services) {
      setError("Firebase authentication is not configured")
      return false
    }
    setAuthRequested(true)

    try {
      setError(null)
      const { signInWithEmailAndPassword, linkWithCredential } = await loadAuthApi()
      const result = await signInWithEmailAndPassword(services.auth, email, password)

      // Check if we need to link accounts
      if (pendingCredential && result.user) {
        try {
          await linkWithCredential(result.user, pendingCredential)
          setPendingCredential(null)
        } catch (linkError) {
          console.error("Account linking error:", linkError)
        }
      }
      return true
    } catch (error) {
      const authError = error as AuthError
      console.error("Email sign in error:", error)
      setError(getAuthErrorMessage(authError))
      return false
    }
  }

  const signUpWithEmail = async (email: string, password: string): Promise<boolean> => {
    const services = await ensureAuth()
    if (!services) {
      setError("Firebase authentication is not configured")
      return false
    }
    setAuthRequested(true)

    try {
      setError(null)
      const { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } = await loadAuthApi()
      // Check if email is already in use with different provider
      const methods = await fetchSignInMethodsForEmail(services.auth, email)
      if (methods.length > 0 && !methods.includes("password")) {
        setError(
          `This email is already registered with ${methods[0]}. Please sign in with that method first, then link your accounts.`
        )
        return false
      }

      await createUserWithEmailAndPassword(services.auth, email, password)
      return true
    } catch (error) {
      const authError = error as AuthError
      console.error("Email sign up error:", error)
      setError(getAuthErrorMessage(authError))
      return false
    }
  }

  const resetPassword = async (email: string): Promise<boolean> => {
    const services = await ensureAuth()
    if (!services) {
      setError("Firebase authentication is not configured")
      return false
    }

    try {
      setError(null)
      const { sendPasswordResetEmail } = await loadAuthApi()
      // Use custom action URL for styled password reset page
      const actionCodeSettings = {
        url:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/action`
            : "https://netdash-toolkit.vercel.app/auth/action",
        handleCodeInApp: false,
      }
      await sendPasswordResetEmail(services.auth, email, actionCodeSettings)
      return true
    } catch (error) {
      const authError = error as AuthError
      console.error("Password reset error:", error)
      setError(getAuthErrorMessage(authError))
      return false
    }
  }

  const signOut = async () => {
    const services = await ensureAuth()
    if (!services) {
      return
    }

    try {
      setError(null)
      // Cancel Google One Tap when signing out
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect()
      }
      const { signOut: firebaseSignOut } = await loadAuthApi()
      await firebaseSignOut(services.auth)
      // cleared here as well as in the listener, so a cold load after signing
      // out never pays for the sdk again
      writeSessionHint(false)
      // Re-enable One Tap prompt after sign out
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt()
      }
    } catch (error) {
      const authError = error as AuthError
      console.error("Sign out error:", error)
      setError(getAuthErrorMessage(authError))
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
