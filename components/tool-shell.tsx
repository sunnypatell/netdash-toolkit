"use client"

import { Suspense, lazy, useEffect, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { getToolBySlug } from "@/lib/tool-registry"
import { rememberToolVisit } from "@/components/command-palette"

function ToolSkeleton() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Loading tool"
    >
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" aria-hidden="true" />
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

  const Tool = useMemo(() => {
    const tool = getToolBySlug(slug)
    if (!tool) return null
    return lazy(tool.load)
  }, [slug])

  // unreachable in practice: dynamicParams=false 404s unknown slugs at the
  // router before this renders
  if (!Tool) return null

  return (
    <Suspense fallback={<ToolSkeleton />}>
      <Tool />
    </Suspense>
  )
}
