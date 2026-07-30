"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  BookOpen,
  Clock,
  Cloud,
  CornerDownLeft,
  FolderOpen,
  Home,
  Info,
  Search,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  categories,
  categoryLabelOf,
  getToolBySlug,
  isOffline,
  searchTools,
  tools,
  type ToolDefinition,
} from "@/lib/tool-registry"

const OPEN_EVENT = "netdash:open-command-palette"

// lets the header button (and anything else) open the palette without threading
// state through the shell
export function openCommandPalette() {
  document.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

// resolved after mount, never during render: the server has no navigator and a
// hardcoded "Ctrl" is wrong for half the audience
export function useShortcutKey() {
  const [key, setKey] = useState("Ctrl")
  useEffect(() => {
    const platform = navigator.platform || navigator.userAgent
    if (/Mac|iPhone|iPad|iPod/i.test(platform)) setKey("⌘")
  }, [])
  return key
}

// the shortcut is the whole point of the palette, so it gets stated in plain
// text wherever there is room rather than living only in a tooltip
export function ShortcutHint({ className }: { className?: string }) {
  const key = useShortcutKey()
  return (
    <span className={className}>
      Press{" "}
      <kbd className="bg-muted text-foreground rounded border px-1 py-px text-[0.625rem] font-medium">
        {key}
      </kbd>
      <kbd className="bg-muted text-foreground ml-0.5 rounded border px-1 py-px text-[0.625rem] font-medium">
        K
      </kbd>{" "}
      anywhere
    </span>
  )
}

const RECENTS_KEY = "netdash-recent-tools"
const RECENTS_MAX = 6

// external: the docs are static astro output under public/, so the router has
// never heard of them and has to be bypassed
const pages: Array<{ href: string; label: string; icon: LucideIcon; external?: boolean }> = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/about", label: "About", icon: Info },
  { href: "/docs/", label: "Docs", icon: BookOpen, external: true },
]

// exported so the dashboard can show the same list; one store, one reader
export function readRecents(): ToolDefinition[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const slugs: unknown = JSON.parse(raw)
    if (!Array.isArray(slugs)) return []
    return slugs
      .filter((s): s is string => typeof s === "string")
      .map(getToolBySlug)
      .filter((t): t is ToolDefinition => Boolean(t))
      .slice(0, RECENTS_MAX)
  } catch {
    return []
  }
}

export function rememberToolVisit(slug: string) {
  try {
    const prev = readRecents().map((t) => t.slug)
    const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, RECENTS_MAX)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // a full or blocked localStorage must never break navigation
  }
}

const groupClass =
  "text-muted-foreground [&_[cmdk-group-heading]]:bg-popover [&_[cmdk-group-heading]]:sticky [&_[cmdk-group-heading]]:top-0 [&_[cmdk-group-heading]]:z-10 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:uppercase"

// 48 tools reachable only by scrolling a category tree, and search existed on
// exactly one route. cmd+k works from anywhere.
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [recents, setRecents] = useState<ToolDefinition[]>([])

  useEffect(() => {
    // sc 2.1.4: a bare "/" was bound here and met none of the three exceptions,
    // so it was dropped. cmd/ctrl+k uses a modifier and is out of scope.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpenRequest = () => setOpen(true)
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener(OPEN_EVENT, onOpenRequest)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener(OPEN_EVENT, onOpenRequest)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setRecents(readRecents())
      setQuery("")
    }
  }, [open])

  const results = useMemo(() => (query.trim() ? searchTools(query) : []), [query])

  const go = useCallback(
    (tool: ToolDefinition) => {
      rememberToolVisit(tool.slug)
      setOpen(false)
      router.push(`/tools/${tool.slug}`)
    },
    [router]
  )

  const goTo = useCallback(
    (href: string, external?: boolean) => {
      setOpen(false)
      if (external) window.location.href = href
      else router.push(href)
    },
    [router]
  )

  const pageMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return pages.filter((p) => p.label.toLowerCase().includes(q))
  }, [query])

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search tools"
      // cmdk does its own filtering; ours is ranked, so turn theirs off
      shouldFilter={false}
      className="bg-background/80 fixed inset-0 z-[100] backdrop-blur-sm"
    >
      <div className="bg-popover text-popover-foreground border-border mx-auto mt-[10vh] flex max-h-[80vh] w-[92vw] max-w-xl flex-col overflow-hidden rounded-xl border shadow-2xl">
        <div className="border-border flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${tools.length} tools...`}
            className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
          />
          <kbd className="text-muted-foreground hidden shrink-0 rounded border px-1.5 py-0.5 text-[0.625rem] sm:inline">
            esc
          </kbd>
        </div>

        <Command.List className="scrollbar-slim min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
          <Command.Empty className="px-3 py-8 text-center">
            <p className="text-foreground text-sm font-medium">
              No tool matches &quot;{query}&quot;
            </p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs leading-relaxed">
              Names, descriptions and keywords are all searched, so cidr, vlsm, mtu, doh and oui
              each resolve.
            </p>
          </Command.Empty>

          {!query.trim() && recents.length > 0 && (
            <Command.Group heading="Recent" className={groupClass}>
              {recents.map((tool) => (
                <PaletteItem key={tool.slug} tool={tool} onSelect={go} icon={Clock} />
              ))}
            </Command.Group>
          )}

          {pageMatches.length > 0 && (
            <Command.Group heading="Pages" className={groupClass}>
              {pageMatches.map((page) => {
                const Icon = page.icon
                return (
                  <Command.Item
                    key={page.href}
                    value={page.href}
                    onSelect={() => goTo(page.href, page.external)}
                    className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm"
                  >
                    <Icon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{page.label}</span>
                  </Command.Item>
                )
              })}
            </Command.Group>
          )}

          {!query.trim() &&
            categories.map((category) => {
              const inCategory = tools.filter((t) => t.category === category.id)
              if (inCategory.length === 0) return null
              return (
                <Command.Group
                  key={category.id}
                  heading={`${category.label} (${inCategory.length})`}
                  className={groupClass}
                >
                  {inCategory.map((tool) => (
                    <PaletteItem key={tool.slug} tool={tool} onSelect={go} />
                  ))}
                </Command.Group>
              )
            })}

          {query.trim() &&
            results.map((tool) => (
              <PaletteItem key={tool.slug} tool={tool} onSelect={go} showCategory />
            ))}
        </Command.List>

        {/* a palette that never states its own keys stays a power feature */}
        <div className="border-border text-muted-foreground hidden shrink-0 items-center gap-4 border-t px-3 py-2 text-[0.6875rem] sm:flex">
          <span className="flex items-center gap-1">
            <kbd className="bg-muted rounded border px-1 py-px">&uarr;</kbd>
            <kbd className="bg-muted rounded border px-1 py-px">&darr;</kbd>
            to move
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted rounded border px-1 py-px">&crarr;</kbd>
            to open
          </span>
          <span className="tabular ml-auto">
            {query.trim() ? results.length : tools.length} tools
          </span>
        </div>
      </div>
    </Command.Dialog>
  )
}

function PaletteItem({
  tool,
  onSelect,
  icon,
  showCategory,
}: {
  tool: ToolDefinition
  onSelect: (tool: ToolDefinition) => void
  icon?: LucideIcon
  showCategory?: boolean
}) {
  const Icon = icon ?? tool.icon
  return (
    <Command.Item
      value={tool.slug}
      onSelect={() => onSelect(tool)}
      className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground group flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm"
    >
      <Icon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{tool.label}</span>
      {!isOffline(tool) && (
        <span className="flex shrink-0 items-center gap-1 text-[0.6875rem] text-amber-700 group-data-[selected=true]:text-current dark:text-amber-400">
          <Cloud className="size-3" aria-hidden="true" />
          <span className="hidden sm:inline">Sends data</span>
        </span>
      )}
      {/* text never rides on opacity here: the selected row is bright emerald, and
          a faded label on it drops under 4.5:1 */}
      {showCategory && (
        <span className="text-muted-foreground shrink-0 text-xs group-data-[selected=true]:text-current">
          {categoryLabelOf(tool)}
        </span>
      )}
      <CornerDownLeft
        className="hidden size-3 shrink-0 opacity-0 group-data-[selected=true]:opacity-70 sm:block"
        aria-hidden="true"
      />
    </Command.Item>
  )
}
