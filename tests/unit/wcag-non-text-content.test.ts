import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// the two AvatarImage call sites sit outside the tool axe run, and radix mounts <img> only on load

function tsxFiles(): string[] {
  const out: string[] = []
  for (const root of ["components", "app"]) {
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (rel.endsWith(".tsx")) out.push(join(root, rel))
    }
  }
  return out
}

// prose mentioning a tag is not a call site: avatar.tsx explains this rule in a comment
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

const SOURCES = tsxFiles().map(
  (file) => [file, withoutComments(readFileSync(file, "utf8"))] as const
)

/** opening tags for anything that renders an <img>, with their attributes */
function imageTags(source: string): Array<{ line: number; tag: string; attributes: string }> {
  const out: Array<{ line: number; tag: string; attributes: string }> = []
  const pattern =
    /<(img|AvatarImage|Image)(\s(?:[^<>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)?\/?>/g
  for (const m of source.matchAll(pattern)) {
    out.push({
      line: source.slice(0, m.index).split("\n").length,
      tag: m[1],
      attributes: m[2] ?? "",
    })
  }
  return out
}

describe("1.1.1 non-text content", () => {
  it("scanned the whole component tree", () => {
    expect(SOURCES.length).toBeGreaterThan(100)
  })

  // an empty alt is a correct answer, and the only wrong answer is no attribute
  it("every image carries an alt attribute, its own or its primitive's", () => {
    const primitiveDefaults = new Set(["AvatarImage"])
    const missing: string[] = []
    for (const [file, source] of SOURCES) {
      for (const tag of imageTags(source)) {
        if (/\balt\s*=/.test(tag.attributes)) continue
        if (primitiveDefaults.has(tag.tag)) continue
        missing.push(`${file}:${tag.line}: <${tag.tag}> with no alt attribute`)
      }
    }
    expect(
      missing,
      `an <img> with no alt at all is announced by its filename or its url:\n${missing.join("\n")}`
    ).toEqual([])
  })

  // the exemption above is only sound while the primitive actually supplies one
  it("the Avatar primitive supplies the default the exemption relies on", () => {
    const source = readFileSync(join("components", "ui", "avatar.tsx"), "utf8")
    expect(source, "AvatarImage no longer defaults alt, so its call sites are unlabelled").toMatch(
      /alt\s*=\s*""/
    )
    expect(source, "the default is declared but never forwarded to the primitive").toMatch(
      /alt=\{alt\}/
    )
  })
})
