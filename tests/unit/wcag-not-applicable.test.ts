import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// several wcag 2.2 criteria are claimed Not Applicable in
// docs/accessibility-conformance.md. an unverified "n/a" is the easiest way for a
// conformance claim to rot, because the day someone adds a <video> the claim
// silently becomes false. each n/a below is asserted from the source instead, so
// introducing the content that makes a criterion apply fails this suite and
// forces the claim to be revisited.

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

  // 1.2.1 - 1.2.5 (time-based media) and 1.4.2 (audio control):
  // https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html
  it("1.2.x and 1.4.2: there is no time-based media anywhere", () => {
    const media = hits(
      /<(?:audio|video|track|source)\b|new Audio\b|AudioContext|MediaRecorder|speechSynthesis|autoPlay|autoplay=/g
    )
    expect(
      media,
      `time-based media makes 1.2.1 through 1.2.5 and 1.4.2 apply, and the conformance record claims they do not:\n${media.join("\n")}`
    ).toEqual([])
  })

  // embedded third-party content would put criteria outside this codebase's
  // control, which the conformance record's scope section denies
  it("no embedded frames or plugin objects", () => {
    expect(hits(/<(?:iframe|embed|object)\b/g)).toEqual([])
  })

  // 2.5.1 pointer gestures and 2.5.4 motion actuation:
  // https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html
  // https://www.w3.org/WAI/WCAG22/Understanding/motion-actuation.html
  it("2.5.1 and 2.5.4: no multipoint, path-based, or device-motion input", () => {
    const gestures = hits(
      /devicemotion|deviceorientation|DeviceMotionEvent|DeviceOrientationEvent|onTouchMove|touchmove|onPointerMove|pointermove/gi
    )
    expect(gestures, gestures.join("\n")).toEqual([])
  })

  // 2.5.7 dragging movements:
  // https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
  // the radix slider is the only draggable control and it is operable by click
  // and by keyboard, so the criterion is met rather than inapplicable. what must
  // stay absent is a hand-rolled drag interaction with no single-pointer path.
  it("2.5.7: no hand-rolled drag-and-drop interaction", () => {
    const drag = hits(/\bdraggable=|onDragStart|onDragEnd|onDragOver|onDrop\b|dnd-kit|useSortable/g)
    expect(drag, drag.join("\n")).toEqual([])
  })

  // 2.3.1 three flashes or below threshold:
  // https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
  it("2.3.1: nothing blinks or flashes", () => {
    expect(hits(/<blink|<marquee|animate-(?:ping|bounce)\b/g)).toEqual([])
  })

  // 2.1.4 character key shortcuts:
  // https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
  // a single printable character bound with no modifier and no way to switch it
  // off is a failure. the command palette's bare "/" was the one instance and it
  // was removed; every remaining single-character binding must be modifier-
  // guarded, which takes it out of the criterion's scope.
  it("2.1.4: every single-character shortcut is modifier-guarded", () => {
    const unguarded: string[] = []
    for (const [file, source] of SOURCES) {
      // e.key === "x" where x is one printable character
      for (const m of source.matchAll(/e\.key\s*===\s*"(\S)"/g)) {
        const line = source.slice(0, m.index).split("\n").length
        // the guard sits in the same condition, so look at the enclosing line
        const statement = source.slice(m.index, source.indexOf("\n", m.index + m[0].length))
        if (/metaKey|ctrlKey|altKey/.test(statement)) continue
        unguarded.push(`${file}:${line}: e.key === "${m[1]}"`)
      }
    }
    expect(
      unguarded,
      `each of these binds a bare printable character. 2.1.4 needs it to be turn-off-able, remappable, or active only while a component has focus:\n${unguarded.join("\n")}`
    ).toEqual([])
  })
})
