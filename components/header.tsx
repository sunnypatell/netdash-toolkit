"use client"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/ui/user-menu"
import { Badge } from "@/components/ui/badge"
import { Menu } from "lucide-react"
import changelog from "@/data/changelog.json"

// Get latest version from changelog
const latestVersion = changelog.releases[0]?.version ?? "0.0.0"

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  onNavigate?: (view: string) => void
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  return (
    <header className="bg-card border-border supports-[backdrop-filter]:bg-card/95 sticky top-0 z-50 border-b px-3 py-3 backdrop-blur sm:px-4 sm:py-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="text-foreground shrink-0 lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleSidebar}
              className="text-foreground hidden lg:flex"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <div className="flex items-center space-x-2">
            <h1 className="text-foreground truncate text-base font-semibold sm:text-lg">
              Network Toolbox
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center space-x-2 sm:space-x-4">
          <div className="hidden items-center space-x-2 sm:flex">
            <Badge variant="outline" className="text-xs">
              v{latestVersion}
            </Badge>
          </div>
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
