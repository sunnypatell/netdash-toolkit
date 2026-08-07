import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// the components suite proves the three named clocks stop; this catches a fourth nobody named

const ROOTS = ["components", "app"]

function sourceFiles(): string[] {
  const out: string[] = []
  for (const root of ROOTS) {
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (rel.endsWith(".tsx") || rel.endsWith(".ts")) out.push(join(root, rel))
    }
  }
  return out
}

const SOURCES = sourceFiles().map((file) => [file, readFileSync(file, "utf8")] as const)

describe("2.2.2: nothing updates automatically without a way to stop it", () => {
  it("scanned the whole component tree", () => {
    expect(SOURCES.length).toBeGreaterThan(150)
  })

  it("every setInterval sits behind a paused guard and an aria-pressed control", () => {
    const unstoppable: string[] = []
    for (const [file, source] of SOURCES) {
      for (const m of source.matchAll(/setInterval\s*\(/g)) {
        const line = source.slice(0, m.index).split("\n").length
        // the guard is an early return, so look back to the start of the enclosing useEffect
        const before = source.slice(0, m.index)
        const effectStart = before.lastIndexOf("useEffect(")
        const effectBody = effectStart === -1 ? before.slice(-400) : before.slice(effectStart)
        const guarded = /\bif\s*\(\s*[^)]*\bpaused\b[^)]*\)\s*return/.test(effectBody)
        const controlled = /aria-pressed/.test(source)
        if (!guarded || !controlled) {
          unstoppable.push(
            `${file}:${line}: ${guarded ? "" : "no paused guard in the effect; "}` +
              `${controlled ? "" : "no aria-pressed control in the file"}`
          )
        }
      }
    }
    expect(
      unstoppable,
      `2.2.2 requires a mechanism to pause anything that updates automatically for more than ` +
        `five seconds:\n${unstoppable.join("\n")}`
    ).toEqual([])
  })

  it("the three known clocks are still in the set being scanned", () => {
    // a floor of zero reads identically to a scan that stopped matching, so name what it must find
    const withIntervals = SOURCES.filter(([, source]) => /setInterval\s*\(/.test(source)).map(
      ([file]) => file
    )
    for (const tool of ["timestamp-converter.tsx", "jwt-decoder.tsx", "cron-parser.tsx"]) {
      expect(withIntervals, `${tool} no longer matches the interval scan`).toContain(
        join("components", "tools", tool)
      )
    }
  })
})
