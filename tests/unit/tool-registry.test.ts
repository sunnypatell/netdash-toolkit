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

// directories under components/tools that hold components shared by several
// tools rather than a tool of their own, so they have no registry entry
const SHARED_DIRS = new Set(["shared"])

const sourceOf = (slug: string) => {
  // the one slug whose file name differs from its url segment
  const fileName = slug === "wifi-qr" ? "wifi-qr-generator" : slug
  const parts: string[] = []

  const path = join(toolsDir, `${fileName}.tsx`)
  if (existsSync(path)) parts.push(readFileSync(path, "utf8"))

  // a tool split into one file per panel keeps its slug as a directory with an
  // index.tsx; the whole directory is the tool's source for these assertions.
  // both are read, never one or the other: while a shell and its panel directory
  // coexisted, returning on the shell hid all 24 panel files from the offline and
  // projectItemType checks below, including the panels that call fetch.
  const dir = join(toolsDir, fileName)
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".tsx")) parts.push(readFileSync(join(dir, f), "utf8"))
    }
  }

  return parts.length > 0 ? parts.join("\n") : null
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
    // lib/oui-vendors injecting it as a default parameter, `=\s*fetch` missed
    // lib/email-auth defaulting with `?? fetch`, and a bare \bfetch\b matched
    // the literal "node-fetch" in ua-parse's bot list.
    if (
      existsSync(libPath) &&
      /\bfetch\s*\(|(?:=|\?\?)\s*fetch\b/.test(readFileSync(libPath, "utf8"))
    ) {
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
    // network-analyzer was unreachable for months because nothing caught this,
    // and a directory of panels can go orphaned the same way a single file can
    const registered = new Set(
      tools.map((t) => (t.slug === "wifi-qr" ? "wifi-qr-generator" : t.slug))
    )
    const onDisk = readdirSync(toolsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.name.endsWith(".tsx"))
      .map((entry) => entry.name.replace(/\.tsx$/, ""))
    const orphans = onDisk.filter((name) => !registered.has(name) && !SHARED_DIRS.has(name))
    expect(orphans, `unreachable tool components: ${orphans.join(", ")}`).toEqual([])
  })

  it("gives every tool exactly one shape on disk", () => {
    // a tool is <slug>.tsx when it has no panels and <slug>/index.tsx when it
    // does. two agents once shipped both conventions, which left six tools with
    // a shell file beside a panel directory of the same name: the specifier
    // resolved to the file, so sourceOf below never read the panels and the
    // offline and projectItemType assertions silently skipped them.
    const both = tools
      .map((t) => (t.slug === "wifi-qr" ? "wifi-qr-generator" : t.slug))
      .filter(
        (name) => existsSync(join(toolsDir, `${name}.tsx`)) && existsSync(join(toolsDir, name))
      )
    expect(both, `both a file and a directory: ${both.join(", ")}`).toEqual([])
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

  it("says where the data goes for every non-offline tool", () => {
    // a tool that does i/o must be able to tell the user what that i/o is.
    // usually that means naming third-party hosts, but a desktop-only local
    // system call (conflict-checker reading the arp cache) reaches no third
    // party at all, so declaring the capability is the honest disclosure there.
    for (const tool of tools.filter((t) => t.runtime?.offline === false)) {
      const disclosed =
        (tool.runtime?.thirdParty?.length ?? 0) + (tool.runtime?.desktopOnly?.length ?? 0)
      expect(disclosed, `${tool.slug} does i/o but discloses no destination`).toBeGreaterThan(0)
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
