"use client"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/ui/user-menu"
import { Badge } from "@/components/ui/badge"
import { Menu, Search } from "lucide-react"
import { openCommandPalette, useShortcutKey } from "@/components/command-palette"
import changelog from "@/data/changelog.json"

// Get latest version from changelog
const latestVersion = changelog.releases[0]?.version ?? "0.0.0"

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const shortcutKey = useShortcutKey()

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
          {/* not an h1: every page already owns one, and two competing level-one
              headings is not a hierarchy */}
          <p className="text-foreground truncate text-base font-semibold sm:text-lg">
            Network Toolbox
          </p>

          {/* a shortcut nobody can see is a shortcut nobody uses */}
          <Button
            variant="outline"
            size="sm"
            onClick={openCommandPalette}
            className="text-muted-foreground flex shrink-0 items-center gap-2"
            aria-label="Search tools"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search className="size-3.5" aria-hidden="true" />
            <span className="hidden text-xs sm:inline">Search tools</span>
            <kbd className="bg-muted hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
              {shortcutKey}K
            </kbd>
          </Button>
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
