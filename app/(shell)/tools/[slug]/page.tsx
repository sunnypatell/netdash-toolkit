import type { Metadata } from "next"
import { ToolShell } from "@/components/tool-shell"
import { getToolBySlug, tools } from "@/lib/tool-registry"

// static export: every tool page is enumerated at build time; unknown slugs
// fail the build instead of silently rendering nothing
export const dynamicParams = false

export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tool = getToolBySlug(slug)
  if (!tool) return {}
  return {
    title: tool.title,
    description: tool.description,
  }
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ToolShell slug={slug} />
}
