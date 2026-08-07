import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// 1.4.4, 1.4.10 and 1.4.12 need a layout engine, so this asserts the decisions that cause a failure

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
  // declaring these is fine; !important is the failure, because a user stylesheet then cannot win
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

  // the only sanctioned !important is the reduced-motion reset, which touches no typography
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

  // `style={{ fontSize }}` and `[font-size:10px]` pin type just as `text-[10px]` does
  const pxTypePattern =
    /text-\[\d+(?:\.\d+)?px\]|fontSize:\s*["'`]?\d+(?:\.\d+)?(?:px)?["'`]?|\[font-size:[^\]]*\dpx\]/g

  it("no shared primitive pins type in px", () => {
    const inPrimitives = hits(pxTypePattern).filter((hit) =>
      hit.startsWith(join("components", "ui"))
    )
    expect(inPrimitives, inPrimitives.join("\n")).toEqual([])
  })

  // a ceiling of 20 reported green while six offenders sat under it, so it is a floor of zero now
  it("nothing anywhere pins type in px", () => {
    const pxType = hits(pxTypePattern)
    expect(
      pxType,
      `px type does not respond to text-only resize. replace with a rem value, e.g. text-[0.625rem]:\n${pxType.join("\n")}`
    ).toEqual([])
  })

  it("the scan reaches the files the shell lives in", () => {
    // a floor of zero passes just as happily on an empty file list, so prove the shell is in the set
    const scanned = SOURCES.map(([file]) => file)
    for (const shell of ["dashboard.tsx", "header.tsx", "sidebar.tsx"]) {
      expect(scanned, `${shell} is not in the scanned set`).toContain(join("components", shell))
    }
    expect(scanned.length).toBeGreaterThan(150)
  })
})

describe("1.4.10 reflow", () => {
  // a table is exempt from single-column reflow only if it can scroll in the one axis it needs
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
        // a breakpoint-prefixed utility only applies above that width, so 320px is unaffected
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
