import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// wcag 2.2 sc 2.4.7 focus visible (aa) and 1.4.11 non-text contrast (aa):
// https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
// https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
//
// tests/unit/contrast.test.ts already forbids `ring-ring/<alpha>`, which was the
// original bug: an opaque --ring composited to 2.09:1 through a 50% alpha. that
// scan is keyed to the token name, so it missed `focus-visible:ring-destructive/20`
// on the destructive button variant, where the ring is the only indicator the
// variant has - the base `focus-visible:border-ring` paints nothing because
// border-width is 0 on every variant except `outline`. this generalises the rule
// to any colour: a focus indicator may not be drawn at partial alpha.

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

// assembled at runtime so tailwind never scans this file and emits the very
// utilities it exists to forbid
const FOCUS_PREFIX = "focus-visible:|focus:"
const INDICATOR = "ring|outline|border"

describe("2.4.7 / 1.4.11 focus indicators", () => {
  it("scanned the whole styled surface", () => {
    expect(FILES.length).toBeGreaterThan(60)
    expect(FILES).toContain(join("components", "ui", "button.tsx"))
  })

  it("no focus indicator is drawn at partial alpha, whatever its colour", () => {
    const alphaRing = new RegExp(
      `(?:${FOCUS_PREFIX})(?:${INDICATOR})-[a-z-]+\\${"/"}(\\d{1,3})\\b`,
      "g"
    )
    const offenders: string[] = []
    for (const file of FILES) {
      const source = readFileSync(file, "utf8")
      for (const m of source.matchAll(alphaRing)) {
        const line = source.slice(0, m.index).split("\n").length
        offenders.push(`${file}:${line}: ${m[0]}`)
      }
    }
    expect(
      offenders,
      `a focus indicator at partial alpha composites against whatever is behind it, so its contrast is not knowable and in practice fell to ~1.2:1 on the destructive variant:\n${offenders.join("\n")}`
    ).toEqual([])
  })

  // outline-none removes the indicator; something has to put one back, or the
  // control has no visible focus state at all. a background swap counts: that is
  // how menus indicate roving focus, and 2.4.7 does not prescribe a form.
  //
  // this was asserted per file, which is the wrong granularity and let a real
  // failure through: components/ui/tabs.tsx cleared the outline on TabsContent,
  // a genuine tab stop because radix gives the active panel tabIndex={0}, while
  // TabsTrigger further up the same file supplied the indicator that made the
  // file look compliant. the unit is the class expression that reaches one
  // element, so cn() and cva() calls are read as a whole and nothing else.
  it("every element that clears its outline restores a focus indicator", () => {
    const primitives = FILES.filter((f) => f.startsWith(join("components", "ui")))
    expect(primitives.length).toBeGreaterThan(20)

    const RESTORES = new RegExp(`(?:${FOCUS_PREFIX}|peer-focus-visible:)(?:${INDICATOR}|bg)-`)
    const offenders: string[] = []
    for (const file of primitives) {
      const source = readFileSync(file, "utf8")
      for (const group of classExpressions(source)) {
        if (!/outline-none|outline-hidden/.test(group.classes)) continue
        if (RESTORES.test(group.classes)) continue
        // radix focuses this container programmatically with tabIndex={-1} when
        // the dialog opens. it is not in the tab order, so there is no keyboard
        // focus movement onto it for 2.4.7 to bind. recorded rather than waived.
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

/**
 * every class expression that lands on a single element: a `cn(...)` or `cva(...)`
 * call read as one unit, plus any standalone `className="..."`. tailwind literals
 * are split across arguments constantly, so a per-literal read reports Input,
 * whose indicator sits in the second argument of the same call, as bare.
 */
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
