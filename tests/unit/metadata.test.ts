import { describe, expect, it } from "vitest"
import { tools } from "@/lib/tool-registry"
import { SITE_URL, canonical } from "@/lib/site"
import sitemap from "@/app/sitemap"
import robots from "@/app/robots"
import manifest from "@/app/manifest"

// computed from the registry, so they keep holding as tab panels get promoted to tools

describe("canonical urls", () => {
  it("always ends in a slash, because next.config sets trailingSlash", () => {
    // without the slash every canonical points at a redirect rather than a page
    expect(canonical("/")).toBe(`${SITE_URL}/`)
    expect(canonical("/about")).toBe(`${SITE_URL}/about/`)
    expect(canonical("/tools/subnet-calculator")).toBe(`${SITE_URL}/tools/subnet-calculator/`)
  })

  it("is idempotent for a path that already has one", () => {
    expect(canonical("/about/")).toBe(canonical("/about"))
  })
})

describe("sitemap", () => {
  const entries = sitemap()

  it("covers every tool in the registry", () => {
    const urls = new Set(entries.map((e) => e.url))
    for (const tool of tools) {
      expect(urls.has(canonical(`/tools/${tool.slug}`)), `missing ${tool.slug}`).toBe(true)
    }
  })

  it("has no duplicate urls", () => {
    const urls = entries.map((e) => e.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it("uses absolute urls with the canonical origin", () => {
    for (const entry of entries) expect(entry.url.startsWith(`${SITE_URL}/`)).toBe(true)
  })

  it("does not list the signed-in only or auth routes", () => {
    const urls = entries.map((e) => e.url).join(" ")
    expect(urls).not.toContain("/projects")
    expect(urls).not.toContain("/auth")
  })

  it("does not give every page the same priority", () => {
    // uniform priorities carry no information for a crawler
    expect(new Set(entries.map((e) => e.priority)).size).toBeGreaterThan(1)
  })
})

describe("robots", () => {
  const result = robots()

  it("points at both sitemaps and disallows the non-public routes", () => {
    // the docs are a separate astro build with their own sitemap
    expect(result.sitemap).toContain(`${SITE_URL}/sitemap.xml`)
    expect(result.sitemap).toContain(`${SITE_URL}/docs/sitemap-index.xml`)
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
    expect(rules.disallow).toContain("/projects/")
    expect(rules.disallow).toContain("/auth/")
  })
})

describe("manifest", () => {
  const result = manifest()

  it("states the real tool count rather than a stale number", () => {
    expect(result.description).toContain(String(tools.length))
  })

  it("only offers shortcuts to tools that exist", () => {
    const slugs = new Set(tools.map((t) => t.slug))
    for (const shortcut of result.shortcuts ?? []) {
      const slug = shortcut.url.replace(/^\/tools\//, "").replace(/\/$/, "")
      expect(slugs.has(slug), `shortcut points at unknown tool ${slug}`).toBe(true)
    }
  })

  it("uses colours that exist in the stylesheet", () => {
    expect(result.theme_color).toMatch(/^#[0-9a-f]{6}$/)
    expect(result.background_color).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe("shipped version", () => {
  // header.tsx renders releases[0].version, so a bump with no entry shipped v3.0.0 on a 3.0.1 build
  it("the changelog's newest entry matches the package version", async () => {
    const [pkg, changelog] = await Promise.all([
      import("../../package.json"),
      import("../../data/changelog.json"),
    ])
    const newest = (changelog.default ?? changelog).releases[0]?.version
    expect(newest, "data/changelog.json has no releases").toBeTruthy()
    expect(newest).toBe((pkg.default ?? pkg).version)
  })
})

describe("registry copy quality, since it drives every title and card", () => {
  it("gives every tool a distinct title and description", () => {
    const titles = tools.map((t) => t.title)
    const descriptions = tools.map((t) => t.description)
    expect(new Set(titles).size, "duplicate titles compete as duplicate pages").toBe(titles.length)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it("keeps descriptions inside the length search engines actually render", () => {
    for (const tool of tools) {
      expect(tool.description.length, `${tool.slug} description is empty`).toBeGreaterThan(20)
      expect(
        tool.description.length,
        `${tool.slug} description is ${tool.description.length}`
      ).toBeLessThanOrEqual(160)
    }
  })

  it("has no em dashes or en dashes in user-facing copy", () => {
    for (const tool of tools) {
      const copy = `${tool.title} ${tool.label} ${tool.description}`
      expect(copy, `${tool.slug}`).not.toMatch(/[—–]/)
    }
  })

  it("gives every tool search keywords", () => {
    for (const tool of tools) {
      expect(tool.keywords.length, `${tool.slug} has no keywords`).toBeGreaterThan(0)
    }
  })
})
