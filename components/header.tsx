"use client"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Menu } from "lucide-react"

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  onNavigate?: (view: string) => void
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-3 sm:px-4 lg:px-6 py-3 sm:py-4 sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/95">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="text-foreground lg:hidden">
            <Menu className="w-4 h-4" />
          </Button>
          {!sidebarOpen && (
            <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="text-foreground hidden lg:flex">
              <Menu className="w-4 h-4" />
            </Button>
          )}
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-semibold text-foreground">Network Toolbox</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="hidden sm:flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              v2.0
            </Badge>
            <Badge variant="secondary" className="text-xs hidden md:flex">
              12 Tools
            </Badge>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
