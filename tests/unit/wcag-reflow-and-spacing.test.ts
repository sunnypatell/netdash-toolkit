import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// wcag 2.2 sc 1.4.4 resize text (aa), 1.4.10 reflow (aa), 1.4.12 text spacing (aa):
// https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
// https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
// https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
//
// all three are ultimately about what happens at 320 css px, at 200% zoom, and
// with the user's own spacing overrides applied. none of that can be observed
// without a layout engine, so what is asserted here is the set of authoring
// decisions that *cause* those failures: pixel type that will not scale, fixed
// widths that force two-dimensional scrolling, declarations that would win
// against a user stylesheet, and wide content with nowhere to scroll.
// the residual visual check is listed as human-only in the conformance record.

const CSS = readFileSync(join("app", "globals.css"), "utf8")

function tsxFiles(): string[] {
  const out: string[] = []
  for (const root of ["components", "app"]) {
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (rel.endsWith(".tsx")) out.push(join(root, rel))
    }
  }
  return out
}

const SOURCES = tsxFiles().map((file) => [file, readFileSync(file, "utf8")] as const)

function hits(pattern: RegExp): string[] {
  const found: string[] = []
  for (const [file, source] of SOURCES) {
    for (const m of source.matchAll(pattern)) {
      found.push(`${file}:${source.slice(0, m.index).split("\n").length}: ${m[0]}`)
    }
  }
  return found
}

describe("1.4.12 text spacing", () => {
  // the criterion is met by *not* fighting the user. a declaration the user
  // cannot override is the failure mode. declaring one of these properties is
  // fine, and the criterion says so explicitly: an author may set any value it
  // likes so long as the user can still win. what breaks it is !important on one
  // of the four properties the criterion governs, because a user stylesheet then
  // cannot take effect at all. the h1/h2/h3 tracking in globals.css is a normal
  // declaration and is correctly not reported here.
  const SPACING_PROPERTIES = "line-height|letter-spacing|word-spacing|margin-bottom"

  it("no text-spacing property is locked with !important", () => {
    const locked = [
      ...CSS.matchAll(new RegExp(`(${SPACING_PROPERTIES})\\s*:[^;]*!\\s*important`, "g")),
    ]
    expect(
      locked.map((m) => m[0]),
      "a user stylesheet cannot override an !important declaration, which is what 1.4.12 requires it to do"
    ).toEqual([])
  })

  // !important is still worth containing. the only sanctioned use is the
  // reduced-motion reset, which collapses animation and transition durations and
  // touches no typography.
  it("!important is confined to the reduced-motion block", () => {
    const reducedMotion = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/.exec(CSS)
    const outside = reducedMotion
      ? CSS.slice(0, reducedMotion.index) + CSS.slice(reducedMotion.index + reducedMotion[0].length)
      : CSS
    expect([...outside.matchAll(/[^;{]*!\s*important/g)].map((m) => m[0].trim())).toEqual([])
  })
})

describe("1.4.4 resize text", () => {
  it("the stylesheet declares no px font sizes", () => {
    expect([...CSS.matchAll(/font-size\s*:\s*[\d.]+px/g)].map((m) => m[0])).toEqual([])
  })

  // arbitrary px type does not grow when the user raises their default font size.
  // browser zoom still scales it, so this holds 1.4.4 on the zoom pathway and is
  // fragile on the text-only pathway.
  //
  // the shared primitives carry a hard floor, because a px size there reaches all
  // 48 tools at once. everywhere else is a loose ceiling rather than an exact
  // count: those files are under active rewrite and an exact number would report
  // a different figure every few minutes without any of it being a regression.
  const pxTypePattern = /text-\[\d+px\]/g

  it("no shared primitive pins type in px", () => {
    const inPrimitives = hits(pxTypePattern).filter((hit) =>
      hit.startsWith(join("components", "ui"))
    )
    expect(inPrimitives, inPrimitives.join("\n")).toEqual([])
  })

  it("arbitrary px type does not spread across the app", () => {
    const pxType = hits(pxTypePattern)
    expect(
      pxType.length,
      `px type does not respond to text-only resize. replace with a rem value, e.g. text-[0.625rem]:\n${pxType.join("\n")}`
    ).toBeLessThanOrEqual(20)
  })
})

describe("1.4.10 reflow", () => {
  // a table is the canonical case the criterion exempts from single-column
  // reflow, but only if it can actually be scrolled in the one axis it needs.
  it("every table can scroll horizontally", () => {
    const unwrapped: string[] = []
    for (const [file, source] of SOURCES) {
      // the shared primitive supplies its own scroll container
      if (file === join("components", "ui", "table.tsx")) continue
      const lines = source.split("\n")
      lines.forEach((line, index) => {
        if (!/<table\b/.test(line)) return
        const context = lines.slice(Math.max(0, index - 3), index + 1).join(" ")
        if (!/overflow-x-auto|overflow-auto|overflow-x-scroll|ScrollArea/.test(context)) {
          unwrapped.push(`${file}:${index + 1}: ${line.trim().slice(0, 90)}`)
        }
      })
    }
    expect(
      unwrapped,
      `a table wider than 320px with no scroll container forces two-dimensional scrolling of the page:\n${unwrapped.join("\n")}`
    ).toEqual([])
  })

  it("no unconditional min-width exceeds the 320px reflow target", () => {
    const offenders: string[] = []
    for (const [file, source] of SOURCES) {
      for (const m of source.matchAll(/(\S*)min-w-\[(\d+)px\]/g)) {
        if (Number(m[2]) <= 320) continue
        // a breakpoint-prefixed utility only applies above that width, so it
        // cannot break the 320px case
        if (m[1].includes(":")) continue
        const line = source.slice(0, m.index).split("\n").length
        const context = source
          .split("\n")
          .slice(Math.max(0, line - 4), line)
          .join(" ")
        if (/overflow-x-auto|overflow-auto|overflow-x-scroll|ScrollArea/.test(context)) continue
        offenders.push(`${file}:${line}: ${m[0]}`)
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([])
  })

  it("the tool container scrolls wide children rather than clipping them", () => {
    const block = /\.tool-container\s*\{([^}]*)\}/.exec(CSS)
    expect(block, "no .tool-container rule in app/globals.css").not.toBeNull()
    expect(block?.[1]).toContain("overflow-x-auto")
    expect(block?.[1]).not.toContain("overflow-x-hidden")
  })
})
