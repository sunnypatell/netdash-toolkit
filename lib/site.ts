// one place for the canonical origin and the app's public identity, so metadata,
// sitemap, manifest and structured data cannot drift apart.
export const SITE_URL = "https://netdash-toolkit.vercel.app"
export const SITE_NAME = "NetDash Toolkit"
export const SITE_TAGLINE = "Network engineering tools that run in your browser"

export const REPO_URL = "https://github.com/sunnypatell/netdash-toolkit"

// trailingSlash: true in next.config, so every canonical must end in a slash or
// it resolves to a redirect rather than the page itself
export function canonical(path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`
  const withSlash = clean.endsWith("/") ? clean : `${clean}/`
  return new URL(withSlash, SITE_URL).href
}
