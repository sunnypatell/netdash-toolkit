"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  LogIn,
  LogOut,
  User,
  Cloud,
  CloudOff,
  Loader2,
  Mail,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useProjects } from "@/contexts/project-context"

type AuthView = "signin" | "signup" | "reset"

export function UserMenu() {
  const {
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
  } = useAuth()
  const { syncEnabled, syncing, projects } = useProjects()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [authView, setAuthView] = useState<AuthView>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // Don't show anything if Firebase is not configured
  if (!isConfigured) {
    return null
  }

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setResetSent(false)
    clearError()
  }

  const switchView = (view: AuthView) => {
    resetForm()
    setAuthView(view)
  }

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true)
    await signInWithGoogle()
    setIsSubmitting(false)
    if (!error) {
      setDialogOpen(false)
      resetForm()
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsSubmitting(true)
    await signInWithEmail(email, password)
    setIsSubmitting(false)
    if (!error) {
      setDialogOpen(false)
      resetForm()
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !confirmPassword) return

    if (password !== confirmPassword) {
      return
    }

    if (password.length < 6) {
      return
    }

    setIsSubmitting(true)
    await signUpWithEmail(email, password)
    setIsSubmitting(false)
    if (!error) {
      setDialogOpen(false)
      resetForm()
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    await resetPassword(email)
    setIsSubmitting(false)
    if (!error) {
      setResetSent(true)
    }
  }

  if (!user) {
    return (
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {authView === "signin" && "Sign in to your account"}
              {authView === "signup" && "Create an account"}
              {authView === "reset" && "Reset your password"}
            </DialogTitle>
            <DialogDescription>
              {authView === "signin" && "Sign in to sync your projects across devices"}
              {authView === "signup" && "Create an account to save and sync your projects"}
              {authView === "reset" && "Enter your email to receive a password reset link"}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {authView === "signin" && (
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background text-muted-foreground px-2">Or continue with</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Sign In with Email
                </Button>
              </form>

              <div className="flex flex-col space-y-2 text-center text-sm">
                <button
                  type="button"
                  onClick={() => switchView("reset")}
                  className="text-muted-foreground hover:text-primary underline underline-offset-4"
                >
                  Forgot your password?
                </button>
                <p className="text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchView("signup")}
                    className="text-primary underline underline-offset-4"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </div>
          )}

          {authView === "signup" && (
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background text-muted-foreground px-2">Or continue with</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-destructive text-xs">Passwords do not match</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || password !== confirmPassword}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Create Account
                </Button>
              </form>

              <p className="text-muted-foreground text-center text-sm">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchView("signin")}
                  className="text-primary underline underline-offset-4"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}

          {authView === "reset" && (
            <div className="space-y-4">
              {resetSent ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    Password reset email sent! Check your inbox for a link to reset your password.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Send Reset Link
                  </Button>
                </form>
              )}

              <p className="text-muted-foreground text-center text-sm">
                Remember your password?{" "}
                <button
                  type="button"
                  onClick={() => switchView("signin")}
                  className="text-primary underline underline-offset-4"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  const initials =
    user.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ||
    user.email?.[0].toUpperCase() ||
    "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
        >
          <Avatar className="pointer-events-none h-8 w-8">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {syncEnabled && (
            <span className="pointer-events-none absolute -top-1 -right-1">
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              ) : (
                <Cloud className="h-3 w-3 text-green-500" />
              )}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-[100] w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{user.displayName || "User"}</p>
            <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="flex items-center justify-between">
          <span className="flex items-center">
            {syncEnabled ? (
              <Cloud className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <CloudOff className="text-muted-foreground mr-2 h-4 w-4" />
            )}
            Cloud Sync
          </span>
          <Badge variant={syncEnabled ? "default" : "secondary"} className="text-xs">
            {syncEnabled ? (syncing ? "Syncing..." : "On") : "Off"}
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="flex items-center justify-between">
          <span className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Projects
          </span>
          <Badge variant="outline" className="text-xs">
            {projects.length}
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
