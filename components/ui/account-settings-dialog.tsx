"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Settings, User, Mail, KeyRound, Loader2, AlertCircle, CheckCircle } from "lucide-react"
import {
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  reauthenticateWithPopup,
  GoogleAuthProvider,
} from "firebase/auth"
import { useAuth } from "@/contexts/auth-context"
import { auth } from "@/lib/firebase"

interface AccountSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountSettingsDialog({ open, onOpenChange }: AccountSettingsDialogProps) {
  const { user } = useAuth()

  // Profile state
  const [displayName, setDisplayName] = useState("")
  const [photoURL, setPhotoURL] = useState("")

  // Email state
  const [newEmail, setNewEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")

  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isGoogleUser = user?.providerData[0]?.providerId === "google.com"

  // Reset form when dialog opens
  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName || "")
      setPhotoURL(user.photoURL || "")
      setNewEmail("")
      setEmailPassword("")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setError(null)
      setSuccess(null)
    }
  }, [open, user])

  const resetState = () => {
    setError(null)
    setSuccess(null)
  }

  const handleUpdateProfile = async () => {
    if (!user || !auth) return

    setLoading(true)
    resetState()

    try {
      await updateProfile(user, {
        displayName: displayName.trim() || null,
        photoURL: photoURL.trim() || null,
      })

      setSuccess("Profile updated successfully")
    } catch (err) {
      console.error("Update profile error:", err)
      setError("Failed to update profile")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEmail = async () => {
    if (!user || !auth || !newEmail.trim()) return

    setLoading(true)
    resetState()

    try {
      // Re-authenticate first
      if (isGoogleUser) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider())
      } else {
        if (!emailPassword) {
          setError("Please enter your current password")
          setLoading(false)
          return
        }
        const credential = EmailAuthProvider.credential(user.email!, emailPassword)
        await reauthenticateWithCredential(user, credential)
      }

      await updateEmail(user, newEmail.trim())

      setSuccess("Email updated successfully")
      setNewEmail("")
      setEmailPassword("")
    } catch (err: unknown) {
      console.error("Update email error:", err)
      const firebaseError = err as { code?: string }
      if (firebaseError.code === "auth/requires-recent-login") {
        setError("Please sign out and sign back in, then try again")
      } else if (firebaseError.code === "auth/wrong-password") {
        setError("Incorrect password")
      } else if (firebaseError.code === "auth/email-already-in-use") {
        setError("This email is already in use by another account")
      } else if (firebaseError.code === "auth/invalid-email") {
        setError("Invalid email address")
      } else {
        setError("Failed to update email")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!user || !auth) return

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    resetState()

    try {
      // Re-authenticate first
      if (isGoogleUser) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider())
      } else {
        if (!currentPassword) {
          setError("Please enter your current password")
          setLoading(false)
          return
        }
        const credential = EmailAuthProvider.credential(user.email!, currentPassword)
        await reauthenticateWithCredential(user, credential)
      }

      await updatePassword(user, newPassword)

      setSuccess("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: unknown) {
      console.error("Update password error:", err)
      const firebaseError = err as { code?: string }
      if (firebaseError.code === "auth/wrong-password") {
        setError("Current password is incorrect")
      } else if (firebaseError.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.")
      } else {
        setError("Failed to update password")
      }
    } finally {
      setLoading(false)
    }
  }

  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ||
    user?.email?.[0].toUpperCase() ||
    "U"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Account Settings
          </DialogTitle>
          <DialogDescription>
            Manage your account profile, email, and security settings.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="gap-1">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-1">
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Password</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={photoURL || undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{user?.displayName || "No name set"}</p>
                <p className="text-muted-foreground text-xs">{user?.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  resetState()
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photoURL">Photo URL</Label>
              <Input
                id="photoURL"
                placeholder="https://example.com/photo.jpg"
                value={photoURL}
                onChange={(e) => {
                  setPhotoURL(e.target.value)
                  resetState()
                }}
              />
              <p className="text-muted-foreground text-xs">
                Enter a URL to an image to use as your profile photo
              </p>
            </div>

            <Button onClick={handleUpdateProfile} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Profile
            </Button>
          </TabsContent>

          <TabsContent value="email" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="new@example.com"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value)
                  resetState()
                }}
              />
            </div>

            {!isGoogleUser && (
              <div className="space-y-2">
                <Label htmlFor="emailPassword">Current Password</Label>
                <Input
                  id="emailPassword"
                  type="password"
                  placeholder="Enter your password to confirm"
                  value={emailPassword}
                  onChange={(e) => {
                    setEmailPassword(e.target.value)
                    resetState()
                  }}
                />
              </div>
            )}

            {isGoogleUser && (
              <Alert>
                <AlertDescription>
                  You&apos;ll be asked to sign in with Google to verify your identity.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleUpdateEmail}
              disabled={loading || !newEmail.trim()}
              className="w-full"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Email
            </Button>
          </TabsContent>

          <TabsContent value="password" className="mt-4 space-y-4">
            {isGoogleUser ? (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    Your account uses Google sign-in. To set a password, you&apos;ll need to verify
                    your identity first.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="newPasswordGoogle">New Password</Label>
                  <Input
                    id="newPasswordGoogle"
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      resetState()
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPasswordGoogle">Confirm New Password</Label>
                  <Input
                    id="confirmPasswordGoogle"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      resetState()
                    }}
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-destructive text-xs">Passwords do not match</p>
                  )}
                </div>

                <Button
                  onClick={handleUpdatePassword}
                  disabled={loading || !newPassword || newPassword !== confirmPassword}
                  className="w-full"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Set Password
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value)
                      resetState()
                    }}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      resetState()
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      resetState()
                    }}
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-destructive text-xs">Passwords do not match</p>
                  )}
                </div>

                <Button
                  onClick={handleUpdatePassword}
                  disabled={loading || !currentPassword || !newPassword}
                  className="w-full"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update Password
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
