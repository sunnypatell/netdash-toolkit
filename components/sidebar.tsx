"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Network,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Home,
  FolderOpen,
  Info,
  X,
} from "lucide-react"
import { categories, getToolsByCategory, tools, type ToolCategory } from "@/lib/tool-registry"

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  // "drawer" renders inside the mobile radix dialog, which owns positioning
  variant?: "desktop" | "drawer"
}

const standalonePages = [
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/about", label: "About", icon: Info },
]

export function Sidebar({ isOpen, onToggle, variant = "desktop" }: SidebarProps) {
  const isDrawer = variant === "drawer"
  const pathname = usePathname()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)) // all expanded by default
  )

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // trailingSlash:true means exported pages navigate with a trailing slash;
  // compare with it stripped so active detection works in dev and export
  const isActive = (href: string) => {
    const clean = pathname?.replace(/\/$/, "") || "/"
    return clean === href || (href === "/" && clean === "")
  }

  const isViewInCategory = (categoryId: ToolCategory) => {
    return tools.some((tool) => tool.category === categoryId && isActive(`/tools/${tool.slug}`))
  }

  // close the drawer after navigating on mobile
  const handleNavigate = () => {
    if (isDrawer || window.innerWidth < 1024) {
      onToggle()
    }
  }

  const navButtonClass = (active: boolean, extra?: string) =>
    cn(
      "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start",
      extra,
      active && "bg-sidebar-accent text-sidebar-accent-foreground"
    )

  return (
    <div
      className={cn(
        "bg-sidebar border-sidebar-border border-r",
        isDrawer
          ? "h-full w-64"
          : cn(
              // desktop rail only; the mobile drawer is a separate radix dialog
              "hidden transition-all duration-300 ease-in-out lg:relative lg:z-auto lg:block",
              isOpen ? "w-64" : "w-16"
            )
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-sidebar-border flex items-center justify-between border-b p-4">
          {isOpen && (
            <Link href="/" className="flex items-center space-x-2" onClick={handleNavigate}>
              <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <Network className="text-primary-foreground h-5 w-5" aria-hidden="true" />
              </div>
              <span className="text-sidebar-foreground font-semibold">NetDash</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label={
              isDrawer ? "Close navigation menu" : isOpen ? "Collapse sidebar" : "Expand sidebar"
            }
            aria-expanded={isDrawer ? undefined : isOpen}
          >
            {isDrawer ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft
                className={cn("h-4 w-4 transition-transform", !isOpen && "rotate-180")}
                aria-hidden="true"
              />
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-2 py-4">
            <nav className="space-y-1" aria-label="Main navigation">
              {/* dashboard */}
              <Button
                asChild
                variant={isActive("/") ? "secondary" : "ghost"}
                className={navButtonClass(
                  isActive("/"),
                  !isOpen ? "justify-center px-2" : undefined
                )}
              >
                <Link
                  href="/"
                  onClick={handleNavigate}
                  aria-current={isActive("/") ? "page" : undefined}
                >
                  <Home className={cn("h-4 w-4", isOpen && "mr-2")} aria-hidden="true" />
                  {isOpen && <span className="text-sm">Dashboard</span>}
                </Link>
              </Button>

              {/* categorized navigation */}
              {categories.map((category) => {
                const CategoryIcon = category.icon
                const isExpanded = expandedCategories.has(category.id)
                const hasActiveItem = isViewInCategory(category.id)
                const categoryTools = getToolsByCategory(category.id)

                return (
                  <div key={category.id} className="space-y-1">
                    {isOpen ? (
                      <>
                        <Button
                          variant="ghost"
                          className={cn(
                            "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-between",
                            hasActiveItem && "text-sidebar-accent-foreground font-medium"
                          )}
                          onClick={() => toggleCategory(category.id)}
                        >
                          <div className="flex items-center">
                            <CategoryIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                            <span className="text-sm">{category.label}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </Button>
                        {isExpanded && (
                          <div className="space-y-1">
                            {categoryTools.map((tool) => {
                              const ToolIcon = tool.icon
                              const href = `/tools/${tool.slug}`
                              const active = isActive(href)
                              return (
                                <Button
                                  key={tool.slug}
                                  asChild
                                  variant={active ? "secondary" : "ghost"}
                                  className={navButtonClass(active, "pl-8")}
                                >
                                  <Link
                                    href={href}
                                    onClick={handleNavigate}
                                    aria-current={active ? "page" : undefined}
                                  >
                                    <ToolIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                                    <span className="text-sm">{tool.label}</span>
                                  </Link>
                                </Button>
                              )
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      // collapsed view: tool icons directly
                      <div className="space-y-1">
                        {categoryTools.map((tool) => {
                          const ToolIcon = tool.icon
                          const href = `/tools/${tool.slug}`
                          const active = isActive(href)
                          return (
                            <Button
                              key={tool.slug}
                              asChild
                              variant={active ? "secondary" : "ghost"}
                              className={cn(
                                "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-center px-2",
                                active && "bg-sidebar-accent text-sidebar-accent-foreground"
                              )}
                            >
                              <Link
                                href={href}
                                onClick={handleNavigate}
                                aria-label={tool.label}
                                aria-current={active ? "page" : undefined}
                              >
                                <ToolIcon className="h-4 w-4" aria-hidden="true" />
                              </Link>
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* projects and about */}
              <div className="border-sidebar-border mt-4 border-t pt-4">
                {standalonePages.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Button
                      key={item.href}
                      asChild
                      variant={active ? "secondary" : "ghost"}
                      className={navButtonClass(
                        active,
                        !isOpen ? "justify-center px-2" : undefined
                      )}
                    >
                      <Link
                        href={item.href}
                        onClick={handleNavigate}
                        aria-label={!isOpen ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className={cn("h-4 w-4", isOpen && "mr-2")} aria-hidden="true" />
                        {isOpen && <span className="text-sm">{item.label}</span>}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            </nav>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
