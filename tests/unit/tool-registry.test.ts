import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  categories,
  getToolBySlug,
  isOffline,
  offlineToolCount,
  searchTools,
  tools,
} from "@/lib/tool-registry"

// these assert architectural rules rather than behaviour: the registry is the
// single source of truth for the whole app, so anything that can silently
// drift away from it gets a test instead of a convention.

const repoRoot = join(__dirname, "../..")
const toolsDir = join(repoRoot, "components/tools")
const sourceOf = (slug: string) => {
  // the one slug whose file name differs from its url segment
  const fileName = slug === "wifi-qr" ? "wifi-qr-generator" : slug
  const path = join(toolsDir, `${fileName}.tsx`)
  return existsSync(path) ? readFileSync(path, "utf8") : null
}

// network-testing is a grab-bag: tools import pure constants from it as well
// as its fetching helpers, so a blanket scan of it would flag offline tools.
// these are its actual network entry points.
const NETWORK_SYMBOLS = [
  "queryDNSOverHTTPS",
  "testRTT",
  "testDownloadThroughput",
  "testUploadThroughput",
]

// a tool "does network i/o" if it fetches directly, calls the electron network
// bridge, or imports a local module that fetches. agents keep extracting these
// calls into lib modules, so component-only detection goes stale.
function performsNetworkIO(src: string): boolean {
  if (/\bfetch\(|electronNetwork\./.test(src)) return true
  if (NETWORK_SYMBOLS.some((s) => new RegExp(`\\b${s}\\b`).test(src))) return true

  for (const m of src.matchAll(/from "@\/lib\/([a-z0-9-]+)"/g)) {
    const name = m[1]
    if (name === "network-testing") continue // handled by NETWORK_SYMBOLS above
    const libPath = join(repoRoot, "lib", `${name}.ts`)
    // fetch used as a value, either called or passed. a paren-only match missed
    // lib/oui-vendors injecting it as a default parameter, and a bare \bfetch\b
    // matched the literal "node-fetch" in ua-parse's bot list.
    if (existsSync(libPath) && /\bfetch\s*\(|=\s*fetch\b/.test(readFileSync(libPath, "utf8"))) {
      return true
    }
  }
  return false
}

describe("tool registry", () => {
  it("has a unique slug per tool", () => {
    const slugs = tools.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("points every tool at a component file that exists", () => {
    for (const tool of tools) {
      expect(sourceOf(tool.slug), `${tool.slug} has no component file`).not.toBeNull()
    }
  })

  it("references a category that exists", () => {
    const ids = new Set(categories.map((c) => c.id))
    for (const tool of tools) {
      expect(ids.has(tool.category), `${tool.slug} -> ${tool.category}`).toBe(true)
    }
  })

  it("gives every tool searchable keywords", () => {
    for (const tool of tools) {
      expect(tool.keywords.length, `${tool.slug} has no keywords`).toBeGreaterThan(0)
    }
  })

  it("leaves no orphaned tool component outside the registry", () => {
    // network-analyzer was unreachable for months because nothing caught this
    const registered = new Set(
      tools.map((t) => (t.slug === "wifi-qr" ? "wifi-qr-generator" : t.slug))
    )
    const onDisk = readdirSync(toolsDir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => f.replace(/\.tsx$/, ""))
    const orphans = onDisk.filter((f) => !registered.has(f))
    expect(orphans, `unreachable tool components: ${orphans.join(", ")}`).toEqual([])
  })

  it("only declares projectItemType when the tool actually saves to a project", () => {
    // the registry promised persistence for 12 tools that never rendered
    // SaveToProject, so the metadata lied to the ui
    const liars = tools
      .filter((t) => t.projectItemType)
      .filter((t) => !sourceOf(t.slug)?.includes("SaveToProject"))
      .map((t) => t.slug)
    expect(liars, `declare projectItemType but never save: ${liars.join(", ")}`).toEqual([])
  })

  it("declares runtime.offline=false for exactly the tools that do network i/o", () => {
    // derived from the source, not hand-maintained: the dashboard advertised
    // "100% offline" while 12 tools called fetch, and no test could catch it
    const mismatches: string[] = []
    for (const tool of tools) {
      const src = sourceOf(tool.slug) ?? ""
      const doesIO = performsNetworkIO(src)
      const declaredOffline = tool.runtime?.offline !== false
      if (doesIO && declaredOffline) {
        mismatches.push(`${tool.slug}: does network i/o but is declared offline`)
      }
      if (!doesIO && !declaredOffline) {
        mismatches.push(`${tool.slug}: declared non-offline but does no network i/o`)
      }
    }
    expect(mismatches, mismatches.join("; ")).toEqual([])
  })

  it("names the third-party hosts for every non-offline tool", () => {
    // a tool that leaves the device must be able to tell the user where to
    for (const tool of tools.filter((t) => t.runtime?.offline === false)) {
      expect(
        tool.runtime?.thirdParty?.length,
        `${tool.slug} lists no destinations`
      ).toBeGreaterThan(0)
    }
  })

  it("counts offline tools honestly", () => {
    expect(offlineToolCount()).toBe(tools.filter(isOffline).length)
    expect(offlineToolCount()).toBeLessThan(tools.length)
  })

  it("finds tools by label, description, and keyword", () => {
    expect(searchTools("subnet").some((t) => t.slug === "subnet-calculator")).toBe(true)
    expect(searchTools("jwt").some((t) => t.slug === "jwt-decoder")).toBe(true)
    expect(searchTools("")).toEqual([])
  })

  it("resolves a tool by slug", () => {
    expect(getToolBySlug("subnet-calculator")?.title).toBeTruthy()
    expect(getToolBySlug("does-not-exist")).toBeUndefined()
  })
})
