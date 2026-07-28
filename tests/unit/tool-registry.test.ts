import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { categories, getToolBySlug, searchTools, tools } from "@/lib/tool-registry"

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
