import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// 4.1.3. ResultCard announces its own result. a wrapper that also carries
// aria-live puts one live region inside another, so the same numbers are read
// twice. this is a source scan on purpose: at rest most of these tools render
// no ResultCard at all, so a rendered check passes while the defect is present.

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith(".tsx") ? [full] : []
  })
}

const FILES = walk("components")

// components that mark their own content as a live region
const SELF_ANNOUNCING = ["<ResultCard", "<PanelResult"]

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

type Offence = { file: string; line: number; wrapper: string; child: string }

function nestedRegions(file: string): Offence[] {
  const lines = readFileSync(file, "utf8").split("\n")
  const out: Offence[] = []

  lines.forEach((line, i) => {
    if (!/\baria-live\s*=/.test(line)) return
    const openIndent = indentOf(line)
    // walk the subtree: anything indented deeper is inside this element
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]
      if (next.trim() === "") continue
      if (indentOf(next) <= openIndent) break
      const hit = SELF_ANNOUNCING.find((tag) => next.includes(tag))
      if (hit) {
        out.push({ file, line: i + 1, wrapper: line.trim().slice(0, 70), child: hit })
        break
      }
    }
  })
  return out
}

describe("wcag 4.1.3: no live region wraps a component that is already one", () => {
  it("scans the files it claims to", () => {
    // the whole suite below is vacuous if the glob matched nothing
    expect(FILES.length, "no component files found").toBeGreaterThan(100)
    expect(
      FILES.some((f) => readFileSync(f, "utf8").includes("<ResultCard")),
      "no file uses ResultCard, so the scan targets nothing"
    ).toBe(true)
    expect(
      FILES.some((f) => /\baria-live\s*=/.test(readFileSync(f, "utf8"))),
      "no file uses aria-live, so the scan targets nothing"
    ).toBe(true)
  })

  it("finds no ResultCard inside an aria-live wrapper", () => {
    const offences = FILES.flatMap(nestedRegions)
    expect(
      offences.map((o) => `${o.file}:${o.line} wraps ${o.child} in ${o.wrapper}`),
      "a live region inside a live region reads the same result twice"
    ).toEqual([])
  })
})
