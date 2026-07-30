import type { MetadataRoute } from "next"
import { tools } from "@/lib/tool-registry"
import { canonical } from "@/lib/site"

// generated from the registry, so tools promoted from tab panels to first-class
// routes appear here without anyone remembering to add them
export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: canonical("/"), changeFrequency: "weekly", priority: 1 },
    { url: canonical("/about"), changeFrequency: "monthly", priority: 0.4 },
    // /projects is behind sign-in and has nothing crawlable
  ]

  const toolPages: MetadataRoute.Sitemap = tools.map((tool) => ({
    url: canonical(`/tools/${tool.slug}`),
    changeFrequency: "monthly",
    // popular tools are the entry points people actually search for
    priority: tool.popular ? 0.9 : 0.7,
  }))

  return [...staticPages, ...toolPages]
}
