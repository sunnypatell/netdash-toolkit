"use client"

import { Suspense, lazy, useEffect, useMemo } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { RuntimeDisclosure } from "@/components/ui/runtime-badge"
import {
  categories,
  getToolBySlug,
  getToolsByCategory,
  isOffline,
  type ToolDefinition,
} from "@/lib/tool-registry"
import { rememberToolVisit } from "@/components/command-palette"

const RELATED_MAX = 6

// most arrivals on a tool route come from a search engine and have never seen
// the home page. without this the only way out was a collapsed icon rail.
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

// a spinner over a blank region tells you nothing while a chunk downloads. the
// registry already knows the title and the purpose, so the placeholder says
// both, in the geometry ToolHeader actually renders, which keeps the swap from
// jumping.
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

// react.lazy, not next/dynamic: next/dynamic registers every loader it sees in
// the page's loadable manifest, so building a slug->component map at module
// scope made all 48 tool chunks preload on every tool page. resolving the
// loader at runtime keeps the page to its own chunk.
export function ToolShell({ slug }: { slug: string }) {
  // feeds the palette's Recent group from actual navigation
  useEffect(() => {
    rememberToolVisit(slug)
  }, [slug])

  const tool = useMemo(() => getToolBySlug(slug), [slug])
  const Tool = useMemo(() => (tool ? lazy(tool.load) : null), [tool])

  // unreachable in practice: dynamicParams=false 404s unknown slugs at the
  // router before this renders
  if (!tool || !Tool) return null

  return (
    <div className="space-y-4">
      <Breadcrumb tool={tool} />

      {/* the badge used to exist only in the loading skeleton, so it vanished the
          moment the tool arrived, and 9 of the 12 tools that leave the device
          said nothing at all once loaded. one slot, every tool, same wording.
          the gate mirrors RuntimeDisclosure's own null case; widen both together. */}
      {!isOffline(tool) && (
        <div className="border-l-2 border-amber-500/50 pl-3">
          <RuntimeDisclosure tool={tool} />
        </div>
      )}

      <Suspense fallback={<ToolSkeleton tool={tool} />}>
        <Tool />
      </Suspense>

      <div className="pt-2">
        <RelatedTools tool={tool} />
      </div>
    </div>
  )
}
