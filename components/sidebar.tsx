"use client"

import { useState } from "react"
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
} from "lucide-react"
import { categories, tools, type ToolCategory } from "@/lib/tool-registry"

interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
  isOpen: boolean
  onToggle: () => void
}

const standaloneItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "project-manager", label: "Projects", icon: FolderOpen },
  { id: "about", label: "About", icon: Info },
]

export function Sidebar({ activeView, onNavigate, isOpen, onToggle }: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)) // All expanded by default
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

  // Check if current view is in a category
  const isViewInCategory = (categoryId: ToolCategory) => {
    return tools.some((tool) => tool.category === categoryId && tool.id === activeView)
  }

  const handleNavigate = (id: string) => {
    onNavigate(id)
    if (window.innerWidth < 1024) {
      onToggle()
    }
  }

  const getToolsByCategory = (categoryId: ToolCategory) => {
    return tools.filter((t) => t.category === categoryId)
  }

  return (
    <div
      className={cn(
        "bg-sidebar border-sidebar-border border-r transition-all duration-300 ease-in-out",
        "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
        isOpen ? "w-64 translate-x-0" : "w-16 -translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-sidebar-border flex items-center justify-between border-b p-4">
          {isOpen && (
            <div className="flex items-center space-x-2">
              <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <Network className="text-primary-foreground h-5 w-5" />
              </div>
              <span className="text-sidebar-foreground font-semibold">NetDash</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isOpen}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !isOpen && "rotate-180")} />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-2 py-4">
            <nav className="space-y-1" aria-label="Main navigation">
              {/* Dashboard */}
              <Button
                variant={activeView === "dashboard" ? "secondary" : "ghost"}
                className={cn(
                  "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start",
                  !isOpen && "justify-center px-2",
                  activeView === "dashboard" && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
                onClick={() => handleNavigate("dashboard")}
                aria-current={activeView === "dashboard" ? "page" : undefined}
              >
                <Home className={cn("h-4 w-4", isOpen && "mr-2")} aria-hidden="true" />
                {isOpen && <span className="text-sm">Dashboard</span>}
              </Button>

              {/* Categorized navigation */}
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
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        {isExpanded && (
                          <div className="space-y-1">
                            {categoryTools.map((tool) => {
                              const ToolIcon = tool.icon
                              return (
                                <Button
                                  key={tool.id}
                                  variant={activeView === tool.id ? "secondary" : "ghost"}
                                  className={cn(
                                    "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start pl-8",
                                    activeView === tool.id &&
                                      "bg-sidebar-accent text-sidebar-accent-foreground"
                                  )}
                                  onClick={() => handleNavigate(tool.id)}
                                  aria-current={activeView === tool.id ? "page" : undefined}
                                >
                                  <ToolIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                                  <span className="text-sm">{tool.label}</span>
                                </Button>
                              )
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      // Collapsed view - show tool icons directly
                      <div className="space-y-1">
                        {categoryTools.map((tool) => {
                          const ToolIcon = tool.icon
                          return (
                            <Button
                              key={tool.id}
                              variant={activeView === tool.id ? "secondary" : "ghost"}
                              className={cn(
                                "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-center px-2",
                                activeView === tool.id &&
                                  "bg-sidebar-accent text-sidebar-accent-foreground"
                              )}
                              onClick={() => handleNavigate(tool.id)}
                              aria-label={tool.label}
                              aria-current={activeView === tool.id ? "page" : undefined}
                            >
                              <ToolIcon className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Projects and About */}
              <div className="border-sidebar-border mt-4 border-t pt-4">
                {standaloneItems.slice(1).map((item) => {
                  const Icon = item.icon
                  return (
                    <Button
                      key={item.id}
                      variant={activeView === item.id ? "secondary" : "ghost"}
                      className={cn(
                        "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start",
                        !isOpen && "justify-center px-2",
                        activeView === item.id && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                      onClick={() => handleNavigate(item.id)}
                      aria-label={!isOpen ? item.label : undefined}
                      aria-current={activeView === item.id ? "page" : undefined}
                    >
                      <Icon className={cn("h-4 w-4", isOpen && "mr-2")} aria-hidden="true" />
                      {isOpen && <span className="text-sm">{item.label}</span>}
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
