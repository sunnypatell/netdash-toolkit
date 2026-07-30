import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { twMerge } from "tailwind-merge"

// wcag 2.2 sc 2.5.8 target size (minimum), level aa:
// https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
//
// a pointer target must be at least 24 by 24 css px. happy-dom has no layout
// engine, so this is resolved from the tailwind classes instead: each wrapper's
// own base classes are merged with the caller's className through the same
// tailwind-merge the app uses in cn(), so a caller's `h-4` overriding a base
// `h-8` resolves here exactly as it does in the browser.
//
// this only reports a control whose classes *pin* a dimension under 24px. a
// control sized by its content is left alone rather than guessed at, so the
// suite under-reports rather than crying wolf. the limit is stated in
// docs/src/content/docs/accessibility-conformance.md rather than assumed away here.

const MINIMUM_PX = 24

// tailwind v4 default spacing scale: 1 unit = 0.25rem = 4px at the root size
const SPACING_PX = 4

// base classes each wrapper applies before the caller's className is merged in.
// MODEL_SOURCES below pins each entry to the file it models so the two cannot
// drift apart silently.
const BASE_CLASSES: Record<string, string> = {
  Button: "h-9 px-4 py-2",
  CopyButton: "h-8 px-3", // defaults to size="sm"
  SelectTrigger: "h-9 px-3 py-2",
  TabsTrigger: "h-8 px-2 py-1",
  AccordionTrigger: "py-4 text-sm",
  Checkbox: "size-4 relative before:absolute before:-inset-1",
  DropdownMenuItem: "px-2 py-1.5 text-sm",
  SelectItem: "py-1.5 pr-8 pl-2 text-sm",
}

// utilities that must still be present in the primitive for the model above to
// hold. if a primitive is restyled, this fails instead of quietly mismodelling.
const MODEL_SOURCES: Record<string, { file: string; must: string[] }> = {
  Button: { file: "components/ui/button.tsx", must: ["h-9 px-4 py-2"] },
  CopyButton: { file: "components/ui/copy-button.tsx", must: ['size = "sm"'] },
  Checkbox: {
    file: "components/ui/checkbox.tsx",
    must: ["size-4", "before:absolute", "before:-inset-1"],
  },
  SelectTrigger: { file: "components/ui/select.tsx", must: ["data-[size=default]:h-9"] },
}

const INTERACTIVE = new Set([
  "button",
  "a",
  ...Object.keys(BASE_CLASSES),
  "DropdownMenuTrigger",
  "DialogTrigger",
  "AlertDialogTrigger",
  "AlertDialogAction",
  "AlertDialogCancel",
])

// text-* utilities pin a line box, which sets the height of a control with no
// explicit height. values are tailwind's default line-heights.
const LINE_HEIGHT_PX: Record<string, number> = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 28,
}

function toPx(value: string): number | null {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value) * SPACING_PX
  const px = /^\[(\d+(?:\.\d+)?)px\]$/.exec(value)
  if (px) return Number(px[1])
  const rem = /^\[(\d+(?:\.\d+)?)rem\]$/.exec(value)
  if (rem) return Number(rem[1]) * 16
  return null
}

type Box = { height: number | null; width: number | null }

function resolveBox(classes: string[]): Box {
  let h: number | null = null
  let w: number | null = null
  let py = 0
  let lineHeight: number | null = null
  // an absolutely positioned ::before with a negative inset grows the pointer
  // target past the painted box, which is how an undersized control can still
  // meet 2.5.8 without changing its visual design
  let grow = 0
  const positionedPseudo = classes.includes("before:absolute")

  for (const cls of classes) {
    const inset = /^before:-inset-(.+)$/.exec(cls)
    if (inset && positionedPseudo) {
      const v = toPx(inset[1])
      if (v !== null) grow = Math.max(grow, v * 2)
      continue
    }
    // a variant only applies in some states or breakpoints, so it cannot be
    // treated as the resting size of the control
    if (cls.includes(":")) continue
    let m: RegExpExecArray | null
    if ((m = /^size-(.+)$/.exec(cls))) {
      const v = toPx(m[1])
      if (v !== null) {
        h = v
        w = v
      }
    } else if ((m = /^h-(.+)$/.exec(cls))) {
      const v = toPx(m[1])
      if (v !== null) h = v
    } else if ((m = /^w-(.+)$/.exec(cls))) {
      const v = toPx(m[1])
      if (v !== null) w = v
    } else if ((m = /^min-h-(.+)$/.exec(cls))) {
      const v = toPx(m[1])
      if (v !== null && (h === null || v > h)) h = v
    } else if ((m = /^min-w-(.+)$/.exec(cls))) {
      const v = toPx(m[1])
      if (v !== null && (w === null || v > w)) w = v
    } else if ((m = /^p-(.+)$/.exec(cls)) || (m = /^py-(.+)$/.exec(cls))) {
      const v = toPx(m[1])
      if (v !== null) py = v
    } else if ((m = /^text-(xs|sm|base|lg|xl)$/.exec(cls))) {
      lineHeight = LINE_HEIGHT_PX[m[1]]
    }
  }

  const height = h ?? (lineHeight !== null ? lineHeight + py * 2 : null)
  return {
    height: height === null ? null : height + grow,
    width: w === null ? null : w + grow,
  }
}

function classLiteralsIn(attributes: string): string[] {
  const out: string[] = []
  for (const m of attributes.matchAll(/className\s*=\s*"([^"]*)"/g)) out.push(m[1])
  for (const m of attributes.matchAll(/className\s*=\s*\{([\s\S]*)\}/g)) {
    for (const s of m[1].matchAll(/"([^"]*)"/g)) out.push(s[1])
  }
  return out.join(" ").split(/\s+/).filter(Boolean)
}

export type Finding = {
  file: string
  line: number
  tag: string
  reasons: string[]
  merged: string
}

function scan(file: string): Finding[] {
  const source = readFileSync(file, "utf8")
  const findings: Finding[] = []
  const openingTag =
    /<([A-Za-z][A-Za-z0-9.]*)(\s(?:[^<>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)?\/?>/g

  for (const m of source.matchAll(openingTag)) {
    const tag = m[1].split(".").pop() as string
    if (!INTERACTIVE.has(tag)) continue
    const attributes = m[2] ?? ""
    // asChild hands rendering to the child, so the child carries the real box
    if (attributes.includes("asChild")) continue

    const caller = classLiteralsIn(attributes)
    const base = BASE_CLASSES[tag] ?? ""
    if (!base && caller.length === 0) continue
    // a visually hidden element is not a pointer target at all. the skip link is
    // the case in point: it is sr-only until focused, and the focus: variants
    // that give it its padding are exactly the ones this resolver skips, so
    // measuring its resting box reports a 20px control that never renders.
    if (caller.includes("sr-only")) continue

    const merged = twMerge(base, caller.join(" "))
    const box = resolveBox(merged.split(/\s+/).filter(Boolean))

    const reasons: string[] = []
    if (box.height !== null && box.height < MINIMUM_PX) reasons.push(`height ${box.height}px`)
    if (box.width !== null && box.width < MINIMUM_PX) reasons.push(`width ${box.width}px`)
    if (reasons.length === 0) continue

    findings.push({
      file,
      line: source.slice(0, m.index).split("\n").length,
      tag: m[1],
      reasons,
      merged,
    })
  }
  return findings
}

function tsxFilesUnder(root: string): string[] {
  const out: string[] = []
  for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (rel.endsWith(".tsx")) out.push(join(root, rel))
  }
  return out
}

const allFindings = [...tsxFilesUnder("components"), ...tsxFilesUnder("app")].flatMap(scan)

function report(findings: Finding[]) {
  return findings
    .map((f) => `${f.file}:${f.line} <${f.tag}> ${f.reasons.join(", ")}\n    merged: ${f.merged}`)
    .join("\n")
}

describe("2.5.8 target size (minimum)", () => {
  it("scanned enough of the tree to be meaningful", () => {
    expect(tsxFilesUnder("components").length).toBeGreaterThan(40)
  })

  it.each(Object.entries(MODEL_SOURCES))(
    "the size model for %s still matches its primitive",
    (_name, { file, must }) => {
      const source = readFileSync(file, "utf8")
      for (const utility of must) {
        expect(source, `${file} no longer declares "${utility}", so the model is stale`).toContain(
          utility
        )
      }
    }
  )

  // the shared primitives are the only files this suite's owner can edit, and a
  // single miss here lands on all 48 tools, so they carry a hard floor
  it("no shared primitive pins an interactive box under 24px", () => {
    const inPrimitives = allFindings.filter((f) => f.file.startsWith(join("components", "ui")))
    expect(inPrimitives, report(inPrimitives)).toEqual([])
  })

  // the four findings this used to allow (two copy buttons in
  // conflict-checker/analysis.tsx, one in reference-hub/reference-table.tsx, and
  // the cancel button on the auth action page) are all fixed, so the ceiling is
  // now a floor of zero across the whole tree.
  it("no tool component pins an interactive box under 24px", () => {
    const outside = allFindings.filter((f) => !f.file.startsWith(join("components", "ui")))
    expect(outside, `2.5.8: ${outside.length} undersized targets.\n${report(outside)}`).toEqual([])
  })
})
