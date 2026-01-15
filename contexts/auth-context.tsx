"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth"
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase"

interface AuthContextType {
  user: User | null
  loading: boolean
  isConfigured: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isConfigured = isFirebaseConfigured()

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

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      setError("Firebase authentication is not configured")
      return
    }

    try {
      setError(null)
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign in"
      console.error("Sign in error:", error)
      setError(message)
    }
  }

  const signOut = async () => {
    if (!auth) {
      return
    }

    try {
      setError(null)
      await firebaseSignOut(auth)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign out"
      console.error("Sign out error:", error)
      setError(message)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        signInWithGoogle,
        signOut,
        error,
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
