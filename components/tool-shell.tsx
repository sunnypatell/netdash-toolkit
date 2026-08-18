"use client"

import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  type ComponentType,
  type LazyExoticComponent,
} from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { RuntimeDisclosure } from "@/components/ui/runtime-badge"
import {
  categories,
  getToolBySlug,
  getToolsByCategory,
  type ToolDefinition,
} from "@/lib/tool-registry"
import { rememberToolVisit } from "@/components/command-palette"
import { loadTool } from "@/lib/tool-loaders"

const RELATED_MAX = 6

// one lazy component per slug, at module scope: a fresh identity per render would remount the tool
const lazyTools = new Map<string, LazyExoticComponent<ComponentType>>()

function lazyTool(slug: string): LazyExoticComponent<ComponentType> {
  const existing = lazyTools.get(slug)
  if (existing) return existing
  const created = lazy(() => loadTool(slug))
  lazyTools.set(slug, created)
  return created
}

// most arrivals come from search and have never seen the home page; a collapsed icon rail was the only way out
function Breadcrumb({ tool }: { tool: ToolDefinition }) {
  const category = categories.find((c) => c.id === tool.category)
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
        <li>
          <Link
            href="/"
            className="focus-visible:ring-ring focus-visible:ring-offset-background hover:text-foreground rounded underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            All tools
          </Link>
        </li>
        {category && (
          <li className="flex items-center gap-1">
            <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />
            {category.label}
          </li>
        )}
        <li className="flex items-center gap-1">
          <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />
          <span className="text-foreground" aria-current="page">
            {tool.title}
          </span>
        </li>
      </ol>
    </nav>
  )
}

// a tool page used to end in nothing at all: no way back, no next step
function RelatedTools({ tool }: { tool: ToolDefinition }) {
  const category = categories.find((c) => c.id === tool.category)
  const siblings = getToolsByCategory(tool.category)
    .filter((t) => t.slug !== tool.slug)
    .slice(0, RELATED_MAX)

  if (siblings.length === 0) return null

  return (
    <section aria-labelledby="related-tools" className="border-border border-t pt-6">
      <h2 id="related-tools" className="text-muted-foreground text-xs font-medium">
        More in {category?.label ?? "this category"}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {siblings.map((sibling) => (
          <li key={sibling.slug}>
            <Link
              href={`/tools/${sibling.slug}`}
              className="border-border hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {sibling.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// the placeholder repeats ToolHeader's title and geometry so the swap does not jump
function ToolSkeleton({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="flex items-start space-x-3">
        <Icon className="text-primary mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">{tool.title}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{tool.description}</p>
        </div>
      </div>

      <div className="space-y-3" aria-hidden="true">
        <div className="bg-muted h-28 animate-pulse rounded-lg" />
        <div className="bg-muted h-40 animate-pulse rounded-lg" />
      </div>

      <span className="sr-only">Loading {tool.title}</span>
    </div>
  )
}

// react.lazy, not next/dynamic: a module-scope next/dynamic map preloaded all 48 tool chunks on every tool page
export function ToolShell({ slug }: { slug: string }) {
  // feeds the palette's Recent group from actual navigation
  useEffect(() => {
    rememberToolVisit(slug)
  }, [slug])

  const tool = useMemo(() => getToolBySlug(slug), [slug])
  const Tool = tool ? lazyTool(tool.slug) : null

  // unreachable: dynamicParams=false 404s unknown slugs before this renders
  if (!tool || !Tool) return null

  return (
    <div className="space-y-4">
      <Breadcrumb tool={tool} />

      {/* one slot, every tool: the badge lived only in the loading skeleton, so it vanished the moment the tool arrived */}
      {tool.runtime && !(tool.runtime.offline && !tool.runtime.desktopOnly?.length) && (
        <div className="border-l-2 border-amber-500/50 pl-3">
          <RuntimeDisclosure tool={tool} />
        </div>
      )}

      <Suspense fallback={<ToolSkeleton tool={tool} />}>
        {/* the rule cannot see through the module-scope table; the identity per slug is stable */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Tool />
      </Suspense>

      <div className="pt-2">
        <RelatedTools tool={tool} />
      </div>
    </div>
  )
}
