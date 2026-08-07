"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Clock, Cloud, CornerDownLeft, Search, Star, WifiOff, X } from "lucide-react"
import { ShortcutHint, readRecents } from "@/components/command-palette"
import {
  categories,
  categoryLabelOf,
  getPopularTools,
  isOffline,
  offlineToolCount,
  searchTools,
  tools,
  type ToolCategory,
  type ToolDefinition,
} from "@/lib/tool-registry"

const popularTools = getPopularTools()
const offlineCount = offlineToolCount()
const networkCount = tools.length - offlineCount

type RuntimeFilter = "all" | "offline" | "network"
type CategoryFilter = ToolCategory | "all"

const SEARCH_ID = "tool-search"

// the exception carries the information: 36 tiles reading "runs offline" is noise, 12 reading "sends data" is not
function RuntimeMark({ tool }: { tool: ToolDefinition }) {
  if (isOffline(tool)) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
      <Cloud className="size-3" aria-hidden="true" />
      Sends data
    </span>
  )
}

function ToolTile({ tool, showCategory }: { tool: ToolDefinition; showCategory?: boolean }) {
  const Icon = tool.icon
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className={cn(
        "group bg-card hover:border-primary/40 hover:bg-muted/40 flex gap-3 rounded-lg border p-3 transition-colors",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      )}
    >
      <span
        className="bg-primary/10 text-primary group-hover:bg-primary/20 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md transition-colors"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span className="text-foreground min-w-0 flex-1 text-sm leading-snug font-medium">
            {tool.title}
          </span>
          {tool.popular && (
            <Star
              className="text-primary mt-0.5 size-3.5 shrink-0 fill-current"
              aria-label="Commonly used"
            />
          )}
        </span>
        <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
          {tool.description}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 empty:mt-0">
          {showCategory && (
            <span className="text-muted-foreground text-xs">{categoryLabelOf(tool)}</span>
          )}
          <RuntimeMark tool={tool} />
        </span>
      </span>
    </Link>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground bg-transparent"
      )}
    >
      {children}
      <span className="tabular opacity-70">{count}</span>
    </button>
  )
}

function SectionHeading({
  icon: Icon,
  title,
  hint,
  count,
  filled,
}: {
  icon: ToolDefinition["icon"]
  title: string
  hint: string
  count: number
  filled?: boolean
}) {
  return (
    <div className="border-border flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2">
      <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn("text-primary size-4", filled && "fill-current")} aria-hidden="true" />
        {title}
      </h2>
      <span className="text-muted-foreground flex-1 text-xs">{hint}</span>
      <span className="text-muted-foreground tabular text-xs">{count}</span>
    </div>
  )
}

export function Dashboard() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [runtime, setRuntime] = useState<RuntimeFilter>("all")
  const [category, setCategory] = useState<CategoryFilter>("all")
  const [recents, setRecents] = useState<ToolDefinition[]>([])

  // localStorage is unreadable during the static render, so the list only arrives after mount
  useEffect(() => {
    setRecents(readRecents())
  }, [])

  const searching = query.trim().length > 0

  const byRuntime = useCallback(
    (tool: ToolDefinition) =>
      runtime === "all" || (runtime === "offline" ? isOffline(tool) : !isOffline(tool)),
    [runtime]
  )

  // when someone types, a flat best-first list beats seven headed sections holding one hit each
  const results = useMemo(
    () => (searching ? searchTools(query).filter(byRuntime) : []),
    [query, searching, byRuntime]
  )

  const sections = useMemo(() => {
    if (searching) return []
    return categories
      .filter((c) => category === "all" || c.id === category)
      .map((c) => ({
        category: c,
        items: tools.filter((t) => t.category === c.id && byRuntime(t)),
      }))
      .filter((s) => s.items.length > 0)
  }, [searching, category, byRuntime])

  const recentList = useMemo(() => recents.filter(byRuntime), [recents, byRuntime])

  // recency outranks general popularity, so the two lists stay complementary rather than repeating a tile
  const quickStart = useMemo(() => {
    const seen = new Set(recentList.map((t) => t.slug))
    return popularTools.filter((t) => byRuntime(t) && !seen.has(t.slug))
  }, [byRuntime, recentList])

  const visibleCount = searching
    ? results.length
    : sections.reduce((sum, s) => sum + s.items.length, 0)

  const filtered = searching || runtime !== "all" || category !== "all"

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const first = results[0]
    if (first) router.push(`/tools/${first.slug}`)
  }

  const clearFilters = () => {
    setQuery("")
    setRuntime("all")
    setCategory("all")
    // the reset control unmounts itself and Input is not a forwardRef, so focus is moved by id rather than by ref
    const input = document.getElementById(SEARCH_ID)
    if (input instanceof HTMLInputElement) input.focus()
  }

  const leadTool = popularTools[0] ?? tools[0]

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="border-border bg-card relative overflow-hidden rounded-xl border">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative space-y-5 p-4 sm:p-6 lg:p-8">
          <div className="space-y-3">
            <p className="eyebrow">Network engineering toolkit</p>
            <h1 className="text-2xl font-semibold text-balance sm:text-3xl lg:text-4xl">
              <span className="text-primary tabular">{tools.length}</span> tools for subnetting,
              addressing, config and diagnostics
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed text-pretty sm:text-base">
              <span className="text-foreground font-medium">
                {offlineCount} of the {tools.length} run offline
              </span>{" "}
              and never leave your browser. The other {networkCount} query DNS, TLS, WHOIS or vendor
              lookups, and each one names the host it contacts before it sends.
            </p>
          </div>

          <form onSubmit={onSubmit} role="search" className="max-w-2xl">
            <label htmlFor={SEARCH_ID} className="sr-only">
              Search {tools.length} tools by name or keyword
            </label>
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id={SEARCH_ID}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or keyword"
                className="h-11 pr-3 pl-9 text-sm sm:pr-44"
              />
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-1.5 text-xs sm:flex">
                {searching ? (
                  <>
                    <CornerDownLeft className="size-3" aria-hidden="true" />
                    opens the top match
                  </>
                ) : (
                  <ShortcutHint />
                )}
              </span>
            </div>
          </form>

          {/* a second search button under a search box is the same route twice; "start using it" and "tell me what it is" are not */}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link href={`/tools/${leadTool.slug}`}>
                Open {leadTool.title}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/about">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        {/* category leads: ranking runtime first put a privacy taxonomy above the job the visitor came to do */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Category</span>
            <FilterChip
              active={category === "all"}
              onClick={() => setCategory("all")}
              count={tools.length}
            >
              Everything
            </FilterChip>
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
                count={tools.filter((t) => t.category === c.id).length}
              >
                {c.label}
              </FilterChip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Runtime</span>
            <FilterChip
              active={runtime === "all"}
              onClick={() => setRuntime("all")}
              count={tools.length}
            >
              All tools
            </FilterChip>
            <FilterChip
              active={runtime === "offline"}
              onClick={() => setRuntime("offline")}
              count={offlineCount}
            >
              <WifiOff className="size-3" aria-hidden="true" />
              Runs offline
            </FilterChip>
            <FilterChip
              active={runtime === "network"}
              onClick={() => setRuntime("network")}
              count={networkCount}
            >
              <Cloud className="size-3" aria-hidden="true" />
              Sends data
            </FilterChip>
          </div>
        </div>

        {/* the count is the only feedback a chip click gives, so it gets announced */}
        <p
          className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs"
          aria-live="polite"
        >
          <span className="tabular">
            {visibleCount} of {tools.length} tools shown
          </span>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-foreground focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-muted inline-flex h-6 items-center gap-1 rounded px-1.5 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <X className="size-3" aria-hidden="true" />
              Reset
            </button>
          )}
        </p>

        {searching ? (
          results.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {results.map((tool) => (
                <ToolTile key={tool.slug} tool={tool} showCategory />
              ))}
            </div>
          ) : (
            <div className="border-border rounded-lg border border-dashed p-6 text-center sm:p-8">
              <p className="text-foreground text-sm font-medium">
                Nothing matches &quot;{query}&quot;
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs leading-relaxed">
                Search covers names, descriptions and keywords, so terms like cidr, vlsm, mtu, doh,
                oui, base64 and cron all resolve.
              </p>
              <Button size="sm" variant="outline" className="mt-4" onClick={clearFilters}>
                Clear search
              </Button>
            </div>
          )
        ) : (
          <>
            {/* the palette already remembered what you opened; the page you land on a week later never showed it */}
            {category === "all" && recentList.length > 0 && (
              <div className="space-y-3">
                <SectionHeading
                  icon={Clock}
                  title="Pick up where you left off"
                  hint="From this browser, most recent first"
                  count={recentList.length}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {recentList.map((tool) => (
                    <ToolTile key={tool.slug} tool={tool} showCategory />
                  ))}
                </div>
              </div>
            )}

            {category === "all" && quickStart.length > 0 && (
              <div className="space-y-3">
                <SectionHeading
                  icon={Star}
                  filled
                  title="Start here"
                  hint="The ones people open first"
                  count={quickStart.length}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {quickStart.map((tool) => (
                    <ToolTile key={tool.slug} tool={tool} showCategory />
                  ))}
                </div>
              </div>
            )}

            {sections.map(({ category: c, items }) => (
              <div key={c.id} className="space-y-3">
                <SectionHeading
                  icon={c.icon}
                  title={c.label}
                  hint={c.description}
                  count={items.length}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((tool) => (
                    <ToolTile key={tool.slug} tool={tool} />
                  ))}
                </div>
              </div>
            ))}

            {sections.length === 0 && (
              <div className="border-border rounded-lg border border-dashed p-6 text-center sm:p-8">
                <p className="text-foreground text-sm font-medium">No tool matches those filters</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={clearFilters}>
                  Reset filters
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
