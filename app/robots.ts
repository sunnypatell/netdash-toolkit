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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: canonical("/"),
  }
}
