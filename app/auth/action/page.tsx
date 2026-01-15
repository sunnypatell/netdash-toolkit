"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { confirmPasswordReset, verifyPasswordResetCode, applyActionCode } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, AlertCircle, KeyRound, Mail, ArrowLeft } from "lucide-react"

type ActionMode = "resetPassword" | "verifyEmail" | "recoverEmail" | null

function AuthActionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const mode = searchParams.get("mode") as ActionMode
  const oobCode = searchParams.get("oobCode")

  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null)

  // Verify the action code on mount
  useEffect(() => {
    const verifyCode = async () => {
      if (!auth || !oobCode) {
        setError("Invalid or missing reset code")
        setLoading(false)
        return
      }

      try {
        if (mode === "resetPassword") {
          // Verify the password reset code and get the email
          const email = await verifyPasswordResetCode(auth, oobCode)
          setVerifiedEmail(email)
        } else if (mode === "verifyEmail") {
          // Apply the email verification code
          await applyActionCode(auth, oobCode)
          setSuccess(true)
        }
      } catch (err) {
        console.error("Verification error:", err)
        setError("This link has expired or is invalid. Please request a new one.")
      } finally {
        setLoading(false)
      }
    }

    verifyCode()
  }, [mode, oobCode])

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!auth || !oobCode) {
      setError("Authentication not configured")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await confirmPasswordReset(auth, oobCode, newPassword)
      setSuccess(true)
    } catch (err) {
      console.error("Password reset error:", err)
      setError("Failed to reset password. The link may have expired.")
    } finally {
      setSubmitting(false)
    }
  }

  const goToApp = () => {
    router.push("/")
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4">Verifying your request...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Invalid mode
  if (!mode || !oobCode) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              This link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={goToApp} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to NetDash Toolkit
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Email verification success
  if (mode === "verifyEmail" && success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Email Verified</CardTitle>
            <CardDescription>
              Your email has been successfully verified. You can now sign in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={goToApp} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to NetDash Toolkit
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password reset success
  if (mode === "resetPassword" && success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Password Reset Complete</CardTitle>
            <CardDescription>
              Your password has been successfully reset. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={goToApp} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Sign In to NetDash Toolkit
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error && !verifiedEmail) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={goToApp} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to NetDash Toolkit
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password reset form
  if (mode === "resetPassword" && verifiedEmail) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <KeyRound className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle>Reset Your Password</CardTitle>
            <CardDescription>
              Enter a new password for <strong>{verifiedEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-destructive text-xs">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || newPassword !== confirmPassword}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={goToApp}
                className="text-muted-foreground hover:text-primary text-sm underline underline-offset-4"
              >
                Cancel and return to app
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fallback
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Unknown Action</CardTitle>
          <CardDescription>This action is not supported.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={goToApp} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to NetDash Toolkit
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground mt-4">Loading...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthActionContent />
    </Suspense>
  )
}
