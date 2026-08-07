import type { MetadataRoute } from "next"
import { tools } from "@/lib/tool-registry"
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  // shortcuts come from the registry's popularity flag rather than a hand-kept list that would rot
  const shortcuts = tools
    .filter((tool) => tool.popular)
    .slice(0, 4)
    .map((tool) => ({
      name: tool.title,
      short_name: tool.label,
      description: tool.description,
      url: `/tools/${tool.slug}/`,
    }))

  return {
    name: `${SITE_NAME}: ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: `${tools.length} network engineering tools. Free, no account required, and most of them never send your input anywhere.`,
    start_url: "/",
    display: "standalone",
    // matches --background in app/globals.css for both themes
    background_color: "#0f172a",
    theme_color: "#047857",
    categories: ["utilities", "developer", "productivity"],
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts,
  }
}
