"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { openCommandPalette } from "@/components/command-palette"
import {
  Network,
  BookOpen,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Home,
  FolderOpen,
  Info,
  Search,
  X,
} from "lucide-react"
import {
  categories,
  getToolsByCategory,
  searchTools,
  tools,
  type ToolCategory,
} from "@/lib/tool-registry"

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

// the docs are static astro output under public/, not a next route, so this one
// has to be a real navigation rather than a Link
const DOCS_URL = "/docs/"

const GROUPS_KEY = "netdash-sidebar-groups"

// one row, three states, no colour-only signalling: active also carries
// aria-current and an emerald rail, so it survives greyscale
const rowClass = (active: boolean) =>
  cn(
    "group relative flex h-9 w-full items-center gap-2 rounded-md pr-2 text-sm transition-colors",
    "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
    active
      ? "bg-primary/15 text-sidebar-foreground font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-foreground/8"
  )

export function Sidebar({ isOpen, onToggle, variant = "desktop" }: SidebarProps) {
  const isDrawer = variant === "drawer"
  const pathname = usePathname()
  const [filter, setFilter] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // trailingSlash:true means exported pages navigate with a trailing slash;
  // compare with it stripped so active detection works in dev and export
  const isActive = (href: string) => {
    const clean = pathname?.replace(/\/$/, "") || "/"
    return clean === href || (href === "/" && clean === "")
  }

  const activeCategory = useMemo<ToolCategory | null>(() => {
    const match = tools.find((tool) => isActive(`/tools/${tool.slug}`))
    return match?.category ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // 48 links in one flat open tree meant the bottom half was always below the
  // fold. groups start closed and remember what you opened.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GROUPS_KEY)
      const ids: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(ids))
        setExpanded(new Set(ids.filter((v): v is string => typeof v === "string")))
    } catch {
      // a blocked localStorage just means groups start closed
    }
  }, [])

  // whatever you navigated to has to be visible, whether you opened its group or not
  useEffect(() => {
    if (!activeCategory) return
    setExpanded((prev) => (prev.has(activeCategory) ? prev : new Set(prev).add(activeCategory)))
  }, [activeCategory])

  const toggleCategory = (categoryId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify([...next]))
      } catch {
        // persistence is a nicety; never let it break the click
      }
      return next
    })
  }

  const openCategory = (categoryId: string) => {
    if (!expanded.has(categoryId)) toggleCategory(categoryId)
    if (!isOpen && !isDrawer) onToggle()
  }

  // close the drawer after navigating on mobile
  const handleNavigate = () => {
    if (isDrawer || window.innerWidth < 1024) onToggle()
  }

  const query = filter.trim()
  const matches = useMemo(() => (query ? searchTools(query) : []), [query])

  // the drawer is always full width; only the desktop rail collapses
  const showLabels = isDrawer || isOpen

  return (
    <div
      className={cn(
        "bg-sidebar border-sidebar-border border-r",
        isDrawer
          ? "h-full w-64"
          : cn(
              // desktop rail only; the mobile drawer is a separate radix dialog
              "hidden transition-[width] duration-200 ease-out lg:relative lg:z-auto lg:block",
              isOpen ? "w-64" : "w-16"
            )
      )}
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            "border-sidebar-border flex h-14 items-center border-b px-2",
            showLabels ? "justify-between" : "justify-center"
          )}
        >
          {showLabels && (
            <Link
              href="/"
              className="focus-visible:ring-ring focus-visible:ring-offset-sidebar flex items-center gap-2 rounded-md px-1 py-1 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
              onClick={handleNavigate}
            >
              <div className="bg-primary flex size-8 items-center justify-center rounded-lg">
                <Network className="text-primary-foreground size-5" aria-hidden="true" />
              </div>
              <span className="text-sidebar-foreground leading-none font-semibold">NetDash</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-foreground/8 shrink-0"
            aria-label={
              isDrawer ? "Close navigation menu" : isOpen ? "Collapse sidebar" : "Expand sidebar"
            }
            aria-expanded={isDrawer ? undefined : isOpen}
          >
            {isDrawer ? (
              <X className="size-4" aria-hidden="true" />
            ) : (
              <ChevronLeft
                className={cn("size-4 transition-transform", !isOpen && "rotate-180")}
                aria-hidden="true"
              />
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-2 py-3">
            <nav className="space-y-1" aria-label="Main navigation">
              {showLabels ? (
                <div className="relative pb-1">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <label htmlFor="sidebar-filter" className="sr-only">
                    Filter {tools.length} tools
                  </label>
                  <Input
                    id="sidebar-filter"
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setFilter("")
                    }}
                    placeholder={`Filter ${tools.length} tools`}
                    className="h-8 pr-2 pl-8 text-xs"
                  />
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={openCommandPalette}
                  className="text-sidebar-foreground hover:bg-sidebar-foreground/8 h-9 w-full justify-center px-2"
                  aria-label={`Search ${tools.length} tools`}
                  aria-keyshortcuts="Meta+K Control+K"
                >
                  <Search className="size-4" aria-hidden="true" />
                </Button>
              )}

              {query ? (
                <div className="space-y-1 pt-1">
                  <p className="text-muted-foreground px-2 py-1 text-xs" aria-live="polite">
                    {matches.length} {matches.length === 1 ? "match" : "matches"}
                  </p>
                  {matches.map((tool) => {
                    const ToolIcon = tool.icon
                    const href = `/tools/${tool.slug}`
                    const active = isActive(href)
                    return (
                      <Link
                        key={tool.slug}
                        href={href}
                        onClick={handleNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(rowClass(active), "pl-2")}
                      >
                        {active && <ActiveRail />}
                        <ToolIcon
                          className={cn("size-4 shrink-0", active && "text-primary")}
                          aria-hidden="true"
                        />
                        {/* no category column here: at 256px it costs more label
                            width than it buys context. the palette has the room. */}
                        <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                      </Link>
                    )
                  })}
                  {matches.length === 0 && (
                    <p className="text-muted-foreground px-2 py-3 text-xs leading-relaxed">
                      No tool matches that. Names, descriptions and keywords are all searched.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <NavRow
                    href="/"
                    label="Dashboard"
                    icon={Home}
                    active={isActive("/")}
                    showLabel={showLabels}
                    onNavigate={handleNavigate}
                  />

                  {categories.map((category) => {
                    const CategoryIcon = category.icon
                    const isExpanded = expanded.has(category.id)
                    const hasActiveItem = activeCategory === category.id
                    const categoryTools = getToolsByCategory(category.id)
                    const panelId = `sidebar-group-${category.id}`

                    if (!showLabels) {
                      return (
                        <Button
                          key={category.id}
                          variant="ghost"
                          onClick={() => openCategory(category.id)}
                          aria-label={`${category.label}, ${categoryTools.length} tools`}
                          className={cn(
                            "hover:bg-sidebar-foreground/8 h-9 w-full justify-center px-2",
                            hasActiveItem ? "bg-primary/15 text-primary" : "text-sidebar-foreground"
                          )}
                        >
                          <CategoryIcon className="size-4" aria-hidden="true" />
                        </Button>
                      )
                    }

                    return (
                      <div key={category.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleCategory(category.id)}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          className={cn(
                            "text-sidebar-foreground hover:bg-sidebar-foreground/8 focus-visible:ring-ring focus-visible:ring-offset-sidebar flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
                            hasActiveItem && "font-medium"
                          )}
                        >
                          <CategoryIcon
                            className={cn("size-4 shrink-0", hasActiveItem && "text-primary")}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-left">
                            {category.label}
                          </span>
                          <span className="text-muted-foreground tabular text-xs">
                            {categoryTools.length}
                          </span>
                          {isExpanded ? (
                            <ChevronDown
                              className="size-3.5 shrink-0 opacity-60"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="size-3.5 shrink-0 opacity-60"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                        {isExpanded && (
                          <div
                            id={panelId}
                            className="border-sidebar-border ml-4 space-y-0.5 border-l pl-1"
                          >
                            {categoryTools.map((tool) => {
                              const ToolIcon = tool.icon
                              const href = `/tools/${tool.slug}`
                              const active = isActive(href)
                              return (
                                <Link
                                  key={tool.slug}
                                  href={href}
                                  onClick={handleNavigate}
                                  aria-current={active ? "page" : undefined}
                                  className={cn(rowClass(active), "pl-2")}
                                >
                                  {active && <ActiveRail />}
                                  <ToolIcon
                                    className={cn("size-4 shrink-0", active && "text-primary")}
                                    aria-hidden="true"
                                  />
                                  <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="border-sidebar-border mt-3 space-y-1 border-t pt-3">
                    {standalonePages.map((item) => (
                      <NavRow
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={item.icon}
                        active={isActive(item.href)}
                        showLabel={showLabels}
                        onNavigate={handleNavigate}
                      />
                    ))}
                    <a
                      href={DOCS_URL}
                      aria-label={showLabels ? undefined : "Docs"}
                      className={cn(
                        rowClass(false),
                        showLabels ? "pl-2" : "justify-center pr-0 pl-0"
                      )}
                    >
                      <BookOpen className="size-4 shrink-0" aria-hidden="true" />
                      {showLabels && <span className="min-w-0 flex-1 truncate">Docs</span>}
                    </a>
                  </div>
                </>
              )}
            </nav>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function ActiveRail() {
  return (
    <span
      className="bg-primary absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full"
      aria-hidden="true"
    />
  )
}

function NavRow({
  href,
  label,
  icon: Icon,
  active,
  showLabel,
  onNavigate,
}: {
  href: string
  label: string
  icon: typeof Home
  active: boolean
  showLabel: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={showLabel ? undefined : label}
      className={cn(rowClass(active), showLabel ? "pl-2" : "justify-center pr-0 pl-0")}
    >
      {active && showLabel && <ActiveRail />}
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden="true" />
      {showLabel && <span className="min-w-0 flex-1 truncate">{label}</span>}
    </Link>
  )
}
