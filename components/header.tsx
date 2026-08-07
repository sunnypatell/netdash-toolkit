"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import dynamic from "next/dynamic"
import { Badge } from "@/components/ui/badge"
import { Loader2, Menu, Search } from "lucide-react"
import { openCommandPalette, useShortcutKey } from "@/components/command-palette"
import { SITE_NAME } from "@/lib/site"
import changelog from "@/data/changelog.json"

const latestVersion = changelog.releases[0]?.version ?? "0.0.0"

// the only firebase pull in the shell, kept off first load; the fallback matches the menu's own pending state so nothing shifts
const UserMenu = dynamic(() => import("@/components/ui/user-menu").then((m) => m.UserMenu), {
  ssr: false,
  loading: () => (
    <Button variant="ghost" size="sm" disabled aria-hidden="true">
      <Loader2 className="h-4 w-4 animate-spin" />
    </Button>
  ),
})

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
          {/* not an h1: every page already owns one. a link because the wordmark was the only dead element on a deep tool route. */}
          <Link
            href="/"
            className="text-foreground focus-visible:ring-ring focus-visible:ring-offset-card truncate rounded text-base font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:text-lg"
          >
            {SITE_NAME}
          </Link>

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
            <kbd className="bg-muted hidden rounded border px-1.5 py-0.5 text-xs sm:inline">
              {shortcutKey}K
            </kbd>
          </Button>
        </div>

        <div className="flex shrink-0 items-center space-x-2 sm:space-x-4">
          {/* the version was a dead token; the changelog it refers to is on /about */}
          <Link
            href="/about"
            className="focus-visible:ring-ring focus-visible:ring-offset-card hidden rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:flex"
          >
            <Badge variant="outline" className="hover:bg-muted text-xs">
              v{latestVersion}
            </Badge>
            <span className="sr-only">, view the changelog</span>
          </Link>
          <UserMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
