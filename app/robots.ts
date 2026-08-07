import type { MetadataRoute } from "next"
import { SITE_URL, canonical } from "@/lib/site"

export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // signed-in only, nothing crawlable, and the auth handler is not a page
      disallow: ["/projects/", "/auth/"],
    },
    // the docs site is a separate astro build with its own sitemap, so both have to be advertised
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/docs/sitemap-index.xml`],
    host: canonical("/"),
  }
}
