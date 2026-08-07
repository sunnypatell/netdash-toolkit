import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// 2.4.7: contrast.test.ts keys on a token name and missed ring-destructive/20; this takes any colour

const SOURCE_ROOTS = ["components", "app"]

function sourceFiles(): string[] {
  const out: string[] = []
  for (const root of SOURCE_ROOTS) {
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (/\.(tsx|ts|css)$/.test(rel)) out.push(join(root, rel))
    }
  }
  return out
}

const FILES = sourceFiles()

// assembled at runtime so tailwind never emits the utilities this file exists to forbid
const FOCUS_PREFIX = "focus-visible:|focus:"
const INDICATOR = "ring|outline|border"

describe("2.4.7 / 1.4.11 focus indicators", () => {
  it("scanned the whole styled surface", () => {
    expect(FILES.length).toBeGreaterThan(60)
    expect(FILES).toContain(join("components", "ui", "button.tsx"))
  })

  // the colour and alpha segments must admit digits and brackets: `[a-z-]+` missed `border-slate-500/50`
  const ALPHA_INDICATOR = () =>
    new RegExp(
      `(?:${FOCUS_PREFIX})(?:${INDICATOR})-(?:\\[[^\\]\\s]+\\]|[a-z0-9-]+)\\${"/"}(?:\\[[^\\]\\s]+\\]|\\d+%?)`,
      "g"
    )

  function alphaIndicators(source: string): string[] {
    return [...source.matchAll(ALPHA_INDICATOR())].map((m) => m[0])
  }

  // a scanner that matches nothing passes forever, so prove it fires first
  it("the indicator scan matches every shape a translucent focus indicator is written in", () => {
    const a = "/"
    for (const literal of [
      `focus-visible:ring-ring${a}50`,
      `focus-visible:ring-red-500${a}50`,
      `focus-visible:border-slate-500${a}50`,
      `focus-visible:border-destructive${a}20`,
      `focus-visible:outline-blue-600${a}50`,
      `focus-visible:ring-primary${a}[0.5]`,
      `focus-visible:border-[#ff0000]${a}50`,
      `focus:ring-ring${a}50`,
      `peer-focus-visible:border-slate-500${a}50`,
    ]) {
      expect(alphaIndicators(literal), `${literal} slipped past the scan`).toHaveLength(1)
    }
    // opaque indicators, non-focus alphas and ring width must not be swept in
    for (const fine of [
      "focus-visible:border-ring",
      "focus-visible:ring-[3px]",
      "focus-visible:ring-offset-2",
      "hover:bg-primary/90",
      `aria-invalid:ring-destructive${a}20`,
    ]) {
      expect(alphaIndicators(fine), fine).toEqual([])
    }
  })

  it("no focus indicator is drawn at partial alpha, whatever its colour", () => {
    const offenders: string[] = []
    for (const file of FILES) {
      const source = readFileSync(file, "utf8")
      for (const m of source.matchAll(ALPHA_INDICATOR())) {
        const line = source.slice(0, m.index).split("\n").length
        offenders.push(`${file}:${line}: ${m[0]}`)
      }
    }
    expect(
      offenders,
      `a focus indicator at partial alpha composites against whatever is behind it, so its contrast is not knowable and in practice fell to ~1.2:1 on the destructive variant:\n${offenders.join("\n")}`
    ).toEqual([])
  })

  // per file was the wrong unit: TabsTrigger's indicator hid that TabsContent cleared its outline
  it("every element that clears its outline restores a focus indicator", () => {
    const primitives = FILES.filter((f) => f.startsWith(join("components", "ui")))
    expect(primitives.length).toBeGreaterThan(20)

    // a bg swap counts as an indicator: that is how menus mark roving focus
    const RESTORES = new RegExp(`(?:${FOCUS_PREFIX}|peer-focus-visible:)(?:${INDICATOR}|bg)-`)
    const offenders: string[] = []
    for (const file of primitives) {
      const source = readFileSync(file, "utf8")
      for (const group of classExpressions(source)) {
        if (!/outline-none|outline-hidden/.test(group.classes)) continue
        if (RESTORES.test(group.classes)) continue
        // radix focuses this with tabIndex={-1}, so it is not in the tab order and 2.4.7 does not bind
        if (
          file === join("components", "ui", "dialog.tsx") &&
          group.classes.includes("bg-background")
        ) {
          continue
        }
        offenders.push(
          `${file}:${source.slice(0, group.index).split("\n").length}: ${group.classes.slice(0, 90)}`
        )
      }
    }
    expect(
      offenders,
      `these clear the native focus outline without drawing a replacement:\n${offenders.join("\n")}`
    ).toEqual([])
  })
})

// a cn() or cva() call read as one unit: Input's indicator sits in the second argument
function classExpressions(source: string): Array<{ index: number; classes: string }> {
  const out: Array<{ index: number; classes: string }> = []
  const consumed: Array<[number, number]> = []
  for (const call of source.matchAll(/\b(?:cn|cva)\s*\(/g)) {
    const open = call.index + call[0].length - 1
    let depth = 0
    let end = open
    for (let i = open; i < source.length; i++) {
      if (source[i] === "(") depth++
      else if (source[i] === ")") {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const body = source.slice(open, end)
    consumed.push([open, end])
    out.push({ index: open, classes: [...body.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].join(" ") })
  }
  for (const m of source.matchAll(/className\s*=\s*"([^"]*)"/g)) {
    if (consumed.some(([a, b]) => m.index > a && m.index < b)) continue
    out.push({ index: m.index, classes: m[1] })
  }
  return out
}
