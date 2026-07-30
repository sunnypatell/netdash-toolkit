"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { Clock, CornerDownLeft, Search } from "lucide-react"
import {
  categories,
  categoryLabelOf,
  getToolBySlug,
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

const RECENTS_KEY = "netdash-recent-tools"
const RECENTS_MAX = 6

function readRecents(): ToolDefinition[] {
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

// 48 tools reachable only by scrolling a category tree, and search existed on
// exactly one route. cmd+k works from anywhere.
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [recents, setRecents] = useState<ToolDefinition[]>([])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true

      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      // "/" is a search convention, but never steal it mid-typing
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
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

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search tools"
      // cmdk does its own filtering; ours is ranked, so turn theirs off
      shouldFilter={false}
      className="bg-background/80 fixed inset-0 z-[100] backdrop-blur-sm"
    >
      <div className="bg-popover text-popover-foreground mx-auto mt-[12vh] w-[92vw] max-w-xl overflow-hidden rounded-xl border shadow-2xl">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={`Search ${tools.length} tools...`}
            className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
          />
          <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] sm:inline">
            esc
          </kbd>
        </div>

        <Command.List className="max-h-[60vh] overflow-x-hidden overflow-y-auto p-2">
          <Command.Empty className="text-muted-foreground py-8 text-center text-sm">
            No tool matches &quot;{query}&quot;.
          </Command.Empty>

          {!query.trim() && recents.length > 0 && (
            <Command.Group
              heading="Recent"
              className="text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs"
            >
              {recents.map((tool) => (
                <PaletteItem key={tool.slug} tool={tool} onSelect={go} icon={Clock} />
              ))}
            </Command.Group>
          )}

          {!query.trim() &&
            categories.map((category) => {
              const inCategory = tools.filter((t) => t.category === category.id)
              if (inCategory.length === 0) return null
              return (
                <Command.Group
                  key={category.id}
                  heading={category.label}
                  className="text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs"
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
  icon?: typeof Clock
  showCategory?: boolean
}) {
  const Icon = icon ?? tool.icon
  return (
    <Command.Item
      value={tool.slug}
      onSelect={() => onSelect(tool)}
      className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm"
    >
      <Icon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-foreground min-w-0 flex-1 truncate">{tool.label}</span>
      {showCategory && (
        <span className="text-muted-foreground shrink-0 text-xs">{categoryLabelOf(tool)}</span>
      )}
      <CornerDownLeft
        className="text-muted-foreground hidden h-3 w-3 shrink-0 sm:block"
        aria-hidden="true"
      />
    </Command.Item>
  )
}
