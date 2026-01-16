"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Share2,
  UserPlus,
  Trash2,
  Loader2,
  AlertCircle,
  Mail,
  Crown,
  Eye,
  Edit,
  Shield,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import type { Project } from "@/contexts/project-context"
import type { Permission } from "@/types/sharing"
import { findUserByEmail, shareProject, unshareProject, updateSharePermission } from "@/lib/sharing"

interface ShareProjectDialogProps {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectUpdate?: () => void
}

const permissionConfig: Record<
  Permission,
  { label: string; icon: typeof Eye; description: string }
> = {
  view: { label: "Can view", icon: Eye, description: "View project and items" },
  edit: { label: "Can edit", icon: Edit, description: "Edit items and add new ones" },
  admin: { label: "Admin", icon: Shield, description: "Full access except sharing" },
}

export function ShareProjectDialog({
  project,
  open,
  onOpenChange,
  onProjectUpdate,
}: ShareProjectDialogProps) {
  const { user } = useAuth()

  const [email, setEmail] = useState("")
  const [permission, setPermission] = useState<Permission>("view")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const resetMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const handleShare = async () => {
    if (!user || !email.trim()) return

    setLoading(true)
    resetMessages()

    try {
      // Look up user by email
      const targetUser = await findUserByEmail(email.trim())

      if (!targetUser) {
        setError("No user found with this email. They need to sign up and sign in first.")
        return
      }

      if (targetUser.uid === user.uid) {
        setError("You cannot share a project with yourself.")
        return
      }

      if (project.sharedWith?.[targetUser.uid]) {
        setError("This project is already shared with this user.")
        return
      }

      await shareProject(
        user.uid,
        user.email!,
        project.id,
        project.name,
        targetUser.uid,
        targetUser.email,
        permission
      )

      setSuccess(`Shared with ${targetUser.email}`)
      setEmail("")
      setPermission("view")
      onProjectUpdate?.()
    } catch (err) {
      console.error("Share error:", err)
      setError("Failed to share project. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveShare = async (userId: string) => {
    if (!user) return

    setLoading(true)
    resetMessages()

    try {
      await unshareProject(user.uid, project.id, userId)
      setSuccess("Access removed")
      onProjectUpdate?.()
    } catch (err) {
      console.error("Unshare error:", err)
      setError("Failed to remove access")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePermission = async (userId: string, newPermission: Permission) => {
    if (!user) return

    try {
      await updateSharePermission(user.uid, project.id, userId, newPermission)
      onProjectUpdate?.()
    } catch (err) {
      console.error("Update permission error:", err)
      setError("Failed to update permission")
    }
  }

  const sharedUsers = Object.entries(project.sharedWith || {})

  const userInitials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || user?.email?.[0].toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share &quot;{project.name}&quot;
          </DialogTitle>
          <DialogDescription>
            Share this project with other users. They&apos;ll see it in their shared projects list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Add new user */}
          <div className="space-y-2">
            <Label>Invite by email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  resetMessages()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email.trim()) {
                    handleShare()
                  }
                }}
                className="flex-1"
              />
              <Select value={permission} onValueChange={(v) => setPermission(v as Permission)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Can view</SelectItem>
                  <SelectItem value="edit">Can edit</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleShare} disabled={loading || !email.trim()} size="icon">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mt-2 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Current shares */}
          <div className="space-y-2">
            <Label>People with access</Label>
            <ScrollArea className="h-[220px] rounded-md border">
              <div className="space-y-1 p-2">
                {/* Owner */}
                <div className="hover:bg-muted/50 flex items-center justify-between rounded-md p-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.photoURL || undefined} />
                      <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {user?.displayName || user?.email?.split("@")[0]}
                      </p>
                      <p className="text-muted-foreground text-xs">{user?.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Crown className="h-3 w-3" />
                    Owner
                  </Badge>
                </div>

                {/* Shared users */}
                {sharedUsers.map(([userId, share]) => {
                  const PermIcon = permissionConfig[share.permission].icon
                  return (
                    <div
                      key={userId}
                      className="hover:bg-muted/50 flex items-center justify-between rounded-md p-2"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {share.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{share.email.split("@")[0]}</p>
                          <p className="text-muted-foreground text-xs">{share.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={share.permission}
                          onValueChange={(v) => handleUpdatePermission(userId, v as Permission)}
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <PermIcon className="mr-1 h-3 w-3" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">
                              <div className="flex items-center gap-2">
                                <Eye className="h-3 w-3" />
                                Can view
                              </div>
                            </SelectItem>
                            <SelectItem value="edit">
                              <div className="flex items-center gap-2">
                                <Edit className="h-3 w-3" />
                                Can edit
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-3 w-3" />
                                Admin
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveShare(userId)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {sharedUsers.length === 0 && (
                  <div className="text-muted-foreground flex flex-col items-center justify-center py-8">
                    <Mail className="mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">Not shared with anyone yet</p>
                    <p className="text-xs">Invite people by entering their email above</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
