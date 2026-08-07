import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// an unverified "n/a" rots silently: the day someone adds a <video> the claim becomes false

const ROOTS = ["components", "app", "lib"]

function sourceFiles(): string[] {
  const out: string[] = []
  for (const root of ROOTS) {
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (/\.(tsx|ts|css)$/.test(rel)) out.push(join(root, rel))
    }
  }
  return out
}

const FILES = sourceFiles()
const SOURCES = FILES.map((file) => [file, readFileSync(file, "utf8")] as const)

function hits(pattern: RegExp): string[] {
  const found: string[] = []
  for (const [file, source] of SOURCES) {
    for (const m of source.matchAll(pattern)) {
      const line = source.slice(0, m.index).split("\n").length
      found.push(`${file}:${line}: ${m[0]}`)
    }
  }
  return found
}

describe("criteria claimed Not Applicable", () => {
  it("scanned the whole source tree", () => {
    expect(FILES.length).toBeGreaterThan(100)
  })

  it("1.2.x and 1.4.2: there is no time-based media anywhere", () => {
    const media = hits(
      /<(?:audio|video|track|source)\b|new Audio\b|AudioContext|MediaRecorder|speechSynthesis|autoPlay|autoplay=/g
    )
    expect(
      media,
      `time-based media makes 1.2.1 through 1.2.5 and 1.4.2 apply, and the conformance record claims they do not:\n${media.join("\n")}`
    ).toEqual([])
  })

  // embedded third-party content puts criteria outside this codebase's control
  it("no embedded frames or plugin objects", () => {
    expect(hits(/<(?:iframe|embed|object)\b/g)).toEqual([])
  })

  it("2.5.1 and 2.5.4: no multipoint, path-based, or device-motion input", () => {
    const gestures = hits(
      /devicemotion|deviceorientation|DeviceMotionEvent|DeviceOrientationEvent|onTouchMove|touchmove|onPointerMove|pointermove/gi
    )
    expect(gestures, gestures.join("\n")).toEqual([])
  })

  // the radix slider is operable by click and keyboard, so 2.5.7 is met rather than inapplicable
  it("2.5.7: no hand-rolled drag-and-drop interaction", () => {
    const drag = hits(/\bdraggable=|onDragStart|onDragEnd|onDragOver|onDrop\b|dnd-kit|useSortable/g)
    expect(drag, drag.join("\n")).toEqual([])
  })

  it("2.3.1: nothing blinks or flashes", () => {
    expect(hits(/<blink|<marquee|animate-(?:ping|bounce)\b/g)).toEqual([])
  })

  // a native title tooltip meets none of 1.4.13's three conditions; color-converter's swatches had one
  it("1.4.13: no title-attribute tooltip exists", () => {
    const tag =
      /<([a-z][a-z0-9]*)(\s(?:[^<>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)?\/?>/g
    const tooltips: string[] = []
    for (const [file, source] of SOURCES) {
      for (const m of source.matchAll(tag)) {
        // <title> inside an svg is an accessible name, not a tooltip
        if (m[1] === "title" || m[1] === "svg") continue
        if (!/\btitle\s*=/.test(m[2] ?? "")) continue
        tooltips.push(`${file}:${source.slice(0, m.index).split("\n").length}: <${m[1]} title=...>`)
      }
    }
    expect(
      tooltips,
      `a title attribute renders a tooltip that cannot be dismissed, hovered, or reached by keyboard:\n${tooltips.join("\n")}`
    ).toEqual([])
  })

  // naming the receiver `e.key` hid the shortcut the day the parameter was renamed to `event`
  it("2.1.4: every single-character shortcut is modifier-guarded", () => {
    const WITH_RECEIVER = /\b[A-Za-z_$][\w$]*\.key\s*===\s*"(\S)"/g
    const DESTRUCTURED = /(?<![.\w$])key\s*===\s*"(\S)"/g
    // a destructured `key` needs this, or a bare `key === "u"` matches the regex tester's flag toggle
    const KEYBOARD_CONTEXT =
      /KeyboardEvent|on(?:KeyDown|KeyUp|KeyPress)|["']keydown["']|["']keyup["']/
    const unguarded: string[] = []
    for (const [file, source] of SOURCES) {
      const seen = new Set<number>()
      for (const [pattern, needsContext] of [
        [WITH_RECEIVER, false],
        [DESTRUCTURED, true],
      ] as const) {
        for (const m of source.matchAll(pattern)) {
          if (seen.has(m.index)) continue
          seen.add(m.index)
          if (
            needsContext &&
            !KEYBOARD_CONTEXT.test(source.slice(Math.max(0, m.index - 400), m.index))
          ) {
            continue
          }
          const line = source.slice(0, m.index).split("\n").length
          // the guard sits in the same condition, so look at the enclosing line
          const statement = source.slice(m.index, source.indexOf("\n", m.index + m[0].length))
          if (/metaKey|ctrlKey|altKey/.test(statement)) continue
          unguarded.push(`${file}:${line}: ${m[0]}`)
        }
      }
    }
    expect(
      unguarded,
      `each of these binds a bare printable character. 2.1.4 needs it to be turn-off-able, remappable, or active only while a component has focus:\n${unguarded.join("\n")}`
    ).toEqual([])
  })
})

// a headline the tables no longer justify is the same failure as an unverified n/a, one level up
describe("the conformance record's headline matches its own tables", () => {
  const RECORD = readFileSync(
    join("docs", "src", "content", "docs", "accessibility-conformance.md"),
    "utf8"
  )

  // only the criterion rows: three pipes, a level cell of a or aa, then a verdict
  const ROW =
    /^\|\s*\[([^\]]+)\]\([^)]+\)\s*\|\s*(a|aa)\s*\|\s*(supports|partially supports|not applicable|does not support)\s*\|/gm

  function counts() {
    const tally: Record<string, number> = {}
    let rows = 0
    for (const m of RECORD.matchAll(ROW)) {
      tally[m[3]] = (tally[m[3]] ?? 0) + 1
      rows++
    }
    return { tally, rows }
  }

  it("has a criterion table to read", () => {
    // if the row pattern stops matching, every assertion below reads zero and agrees
    expect(counts().rows, "the verdict rows no longer parse").toBe(55)
  })

  it("the stated totals are the totals in the tables", () => {
    const { tally } = counts()
    const stated =
      /records \*\*(\d+) as supported, (\d+) as partially supported, and (\d+) as not applicable\*\*, with (\d+) recorded as wholly unsupported/.exec(
        RECORD
      )
    expect(stated, "the record no longer states its totals in the form this reads").not.toBeNull()
    const [supports, partial, na, unsupported] = (stated ?? []).slice(1).map(Number)
    expect(tally["supports"] ?? 0, "supported").toBe(supports)
    expect(tally["partially supports"] ?? 0, "partially supported").toBe(partial)
    expect(tally["not applicable"] ?? 0, "not applicable").toBe(na)
    expect(tally["does not support"] ?? 0, "wholly unsupported").toBe(unsupported)
    expect(supports + partial + na + unsupported, "the four totals must cover all 55").toBe(55)
  })

  // a not-applicable verdict has to be one this file asserts, or it rests on nothing again
  it("every not-applicable verdict is one this file checks", () => {
    const asserted = /1\.2|1\.4\.2|1\.4\.13|2\.3\.1|2\.5\.1|2\.5\.4/
    const unchecked: string[] = []
    for (const m of RECORD.matchAll(ROW)) {
      if (m[3] !== "not applicable") continue
      if (!asserted.test(m[1])) unchecked.push(m[1])
    }
    expect(
      unchecked,
      `these are recorded as not applicable with no assertion behind the claim:\n${unchecked.join("\n")}`
    ).toEqual([])
  })
})
