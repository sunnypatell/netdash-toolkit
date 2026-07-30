import type { Metadata } from "next"
import { ToolShell } from "@/components/tool-shell"
import { getToolBySlug, isOffline, tools } from "@/lib/tool-registry"
import { SITE_NAME, canonical } from "@/lib/site"

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

  const url = canonical(`/tools/${tool.slug}`)
  // stated per tool rather than globally, because roughly a quarter of them do
  // leave the device and the card should not imply otherwise
  const privacy = isOffline(tool)
    ? "Runs entirely in your browser."
    : "Sends your input to a third-party service, only when you ask it to."

  return {
    title: tool.title,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: tool.title,
      description: `${tool.description} ${privacy}`,
      url,
    },
    twitter: {
      card: "summary_large_image",
      title: tool.title,
      description: `${tool.description} ${privacy}`,
    },
  }
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ToolShell slug={slug} />
}
