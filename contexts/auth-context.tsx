"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
  type AuthError,
} from "firebase/auth"
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase"

interface AuthContextType {
  user: User | null
  loading: boolean
  isConfigured: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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
  const [pendingCredential, setPendingCredential] = useState<ReturnType<
    typeof GoogleAuthProvider.credentialFromError
  > | null>(null)
  const isConfigured = isFirebaseConfigured()

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user)
        setLoading(false)
        setError(null)
      },
      (error) => {
        console.error("Auth state change error:", error)
        setError(error.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Initialize Google One Tap (requires NEXT_PUBLIC_GOOGLE_CLIENT_ID env var)
  useEffect(() => {
    if (!isConfigured || !auth || typeof window === "undefined") return

    // Google One Tap requires a separate OAuth client ID from Google Cloud Console
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!googleClientId) return // Skip One Tap if not configured

    const currentAuth = auth // Capture for closure

    // Load Google Identity Services script
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleOneTap,
          auto_select: true,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: true, // Use FedCM for better UX in Chrome
        })
        // Only show One Tap if user is not already signed in
        if (!currentAuth.currentUser) {
          window.google.accounts.id.prompt()
        }
      }
    }
    document.head.appendChild(script)

    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel()
      }
      script.remove()
    }
  }, [isConfigured])

  const handleGoogleOneTap = async (response: { credential: string }) => {
    if (!auth) return

    try {
      setError(null)
      const credential = GoogleAuthProvider.credential(response.credential)
      const result = await signInWithCredential(auth, credential)

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

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      setError("Firebase authentication is not configured")
      return
    }

    try {
      setError(null)
      const result = await signInWithPopup(auth, googleProvider)

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

      // Handle account exists with different credential
      if (authError.code === "auth/account-exists-with-different-credential") {
        const credential = GoogleAuthProvider.credentialFromError(authError)
        if (credential) {
          setPendingCredential(credential)
        }
      }

      console.error("Sign in error:", error)
      setError(getAuthErrorMessage(authError))
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) {
      setError("Firebase authentication is not configured")
      return
    }

    try {
      setError(null)
      const result = await signInWithEmailAndPassword(auth, email, password)

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
      console.error("Email sign in error:", error)
      setError(getAuthErrorMessage(authError))
    }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    if (!auth) {
      setError("Firebase authentication is not configured")
      return
    }

    try {
      setError(null)
      // Check if email is already in use with different provider
      const methods = await fetchSignInMethodsForEmail(auth, email)
      if (methods.length > 0 && !methods.includes("password")) {
        setError(
          `This email is already registered with ${methods[0]}. Please sign in with that method first, then link your accounts.`
        )
        return
      }

      await createUserWithEmailAndPassword(auth, email, password)
    } catch (error) {
      const authError = error as AuthError
      console.error("Email sign up error:", error)
      setError(getAuthErrorMessage(authError))
    }
  }

  const resetPassword = async (email: string) => {
    if (!auth) {
      setError("Firebase authentication is not configured")
      return
    }

    try {
      setError(null)
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      const authError = error as AuthError
      console.error("Password reset error:", error)
      setError(getAuthErrorMessage(authError))
    }
  }

  const signOut = async () => {
    if (!auth) {
      return
    }

    try {
      setError(null)
      // Cancel Google One Tap when signing out
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect()
      }
      await firebaseSignOut(auth)
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
