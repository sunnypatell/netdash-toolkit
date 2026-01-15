"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { LogIn, LogOut, User, Cloud, CloudOff, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useProjects } from "@/contexts/project-context"

export function UserMenu() {
  const { user, loading, isConfigured, signInWithGoogle, signOut, error } = useAuth()
  const { syncEnabled, syncing, projects } = useProjects()

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

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={signInWithGoogle}>
        <LogIn className="mr-2 h-4 w-4" />
        Sign In
      </Button>
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
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {syncEnabled && (
            <span className="absolute -top-1 -right-1">
              {syncing ? (
                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              ) : (
                <Cloud className="h-3 w-3 text-green-500" />
              )}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
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
