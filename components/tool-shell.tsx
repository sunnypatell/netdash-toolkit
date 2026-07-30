"use client"

import { Suspense, lazy, useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { RuntimeBadge, RuntimeDisclosure } from "@/components/ui/runtime-badge"
import { getToolBySlug, type ToolDefinition } from "@/lib/tool-registry"
import { rememberToolVisit } from "@/components/command-palette"

// a spinner over a blank region tells you nothing while a chunk downloads. the
// registry already knows the title, the purpose, the capabilities and whether
// the tool leaves the device, so the placeholder says all four and matches the
// real ToolHeader's geometry, which keeps the swap from jumping.
function ToolSkeleton({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="flex items-start space-x-3">
        <Icon className="text-primary mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <p className="text-xl font-bold sm:text-2xl">{tool.title}</p>
          <p className="text-muted-foreground text-sm sm:text-base">{tool.description}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <RuntimeBadge tool={tool} />
            {tool.features.map((feature) => (
              <Badge key={feature} variant="outline" className="text-xs font-normal">
                {feature}
              </Badge>
            ))}
          </div>
          <RuntimeDisclosure tool={tool} />
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
    <Suspense fallback={<ToolSkeleton tool={tool} />}>
      <Tool />
    </Suspense>
  )
}
