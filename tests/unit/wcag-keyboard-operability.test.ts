import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// wcag 2.2 sc 2.1.1 keyboard (a), 2.4.3 focus order (a):
// https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html
// https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
//
// axe cannot see either of these. 2.1.1 fails when a click handler is attached to
// something that never receives focus, which is invisible to a rule engine that
// only inspects the resting dom. 2.4.3 fails when css moves an element away from
// its dom position, which needs a layout engine to observe. both are asserted
// from the source here instead.

const INTERACTIVE_TAGS = new Set(["button", "a", "input", "select", "textarea", "summary", "label"])

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

/** opening tags whose name is a lowercase html element, with their attributes */
function htmlTags(source: string) {
  const out: Array<{ name: string; attributes: string; index: number }> = []
  const tag = /<([a-z][a-z0-9]*)(\s(?:[^<>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)?\/?>/g
  for (const m of source.matchAll(tag)) {
    out.push({ name: m[1], attributes: m[2] ?? "", index: m.index })
  }
  return out
}

describe("2.1.1 keyboard", () => {
  it("scanned the whole component tree", () => {
    expect(SOURCES.length).toBeGreaterThan(100)
  })

  // a div or span carrying onClick is only operable by pointer unless it is also
  // given a role, a tab stop and key handling. the Badge primitive used to be
  // exactly this, across eight tool call sites.
  it("no non-interactive element carries a click handler without a tab stop", () => {
    const offenders: string[] = []
    for (const [file, source] of SOURCES) {
      for (const tag of htmlTags(source)) {
        if (INTERACTIVE_TAGS.has(tag.name)) continue
        if (!/onClick\s*=/.test(tag.attributes)) continue
        // a tab stop plus a role is the minimum for this to be operable
        const focusable = /tabIndex\s*=\s*\{?\s*0/.test(tag.attributes)
        const hasRole = /role\s*=/.test(tag.attributes)
        if (focusable && hasRole) continue
        offenders.push(
          `${file}:${source.slice(0, tag.index).split("\n").length}: <${tag.name}> with onClick, ` +
            `${focusable ? "" : "no tabIndex={0}"}${!focusable && !hasRole ? " and " : ""}${hasRole ? "" : "no role"}`
        )
      }
    }
    expect(
      offenders,
      `pointer-only controls are unreachable by keyboard, switch device, and voice control:\n${offenders.join("\n")}`
    ).toEqual([])
  })

  // a native button fires on Enter and on Space. anything claiming role="button"
  // has to reproduce both, or it is only half operable.
  //
  // the first version of this asserted `handlesEnter && !handlesSpace`, which let
  // the worse case straight through: an element with role="button", tabIndex={0}
  // and no key handler at all is not operable by keyboard by any key, and it also
  // satisfies the role-plus-tab-stop test above. every branch is reported now.
  it("every element that claims role=button handles Space as well as Enter", () => {
    const NAMES_ENTER = /"Enter"/
    const NAMES_SPACE = /" "|"Space"|"Spacebar"/
    const offenders: string[] = []
    for (const [file, source] of SOURCES) {
      for (const tag of htmlTags(source)) {
        if (INTERACTIVE_TAGS.has(tag.name)) continue
        if (!/role\s*=\s*"button"/.test(tag.attributes)) continue
        const line = source.slice(0, tag.index).split("\n").length
        if (!/on(?:KeyDown|KeyUp|KeyPress)\s*=/.test(tag.attributes)) {
          offenders.push(`${file}:${line}: role="button" with no key handler at all`)
          continue
        }
        // the handler is usually an inline arrow on the same tag. when it is a
        // reference instead, the keys are named somewhere in the same file, so
        // fall back to the file rather than guessing.
        const scope = NAMES_ENTER.test(tag.attributes) || NAMES_SPACE.test(tag.attributes)
        const text = scope ? tag.attributes : source
        const handlesEnter = NAMES_ENTER.test(text)
        const handlesSpace = NAMES_SPACE.test(text)
        if (handlesEnter && handlesSpace) continue
        offenders.push(
          `${file}:${line}: handles ${handlesEnter ? "Enter but not Space" : handlesSpace ? "Space but not Enter" : "neither Enter nor Space"}`
        )
      }
    }
    expect(offenders, `role="button" without Space handling:\n${offenders.join("\n")}`).toEqual([])
  })
})

describe("2.4.3 focus order", () => {
  it("no positive tabIndex reorders the sequence", () => {
    const offenders: string[] = []
    for (const [file, source] of SOURCES) {
      for (const m of source.matchAll(/tabIndex\s*=\s*\{?\s*([1-9]\d*)/g)) {
        offenders.push(`${file}:${source.slice(0, m.index).split("\n").length}: tabIndex=${m[1]}`)
      }
    }
    expect(
      offenders,
      `a positive tabIndex jumps ahead of the document order and is almost never recoverable:\n${offenders.join("\n")}`
    ).toEqual([])
  })

  // a reversing or reordering utility makes visual order disagree with dom order,
  // which is what 2.4.3 is about. the two dialog footers are the accepted shadcn
  // pattern: cancel precedes the action in the dom, and mobile stacks the action
  // on top. both live in an already focus-trapped modal with two sibling buttons,
  // so meaning and operability are preserved. anything new needs the same review.
  it("order-reversing utilities stay limited to the reviewed dialog footers", () => {
    const found: string[] = []
    for (const [file, source] of SOURCES) {
      for (const m of source.matchAll(
        /\b(?:flex-(?:col|row)-reverse|order-\d+|order-first|order-last)\b/g
      )) {
        found.push(`${file}:${source.slice(0, m.index).split("\n").length}: ${m[0]}`)
      }
    }
    const reviewed = [
      join("components", "ui", "dialog.tsx"),
      join("components", "ui", "alert-dialog.tsx"),
    ]
    const unreviewed = found.filter((hit) => !reviewed.some((file) => hit.startsWith(`${file}:`)))
    expect(
      unreviewed,
      `each of these makes visual order differ from dom order and needs a 2.4.3 judgement:\n${unreviewed.join("\n")}`
    ).toEqual([])
  })
})

describe("2.4.1 bypass blocks", () => {
  // the skip link is the mechanism, but it only works if its target exists and is
  // focusable. if either half is renamed the link silently becomes a no-op.
  it("the skip link points at a focusable main landmark", () => {
    const shell = readFileSync(join("components", "app-shell.tsx"), "utf8")
    const href = /href="#([\w-]+)"/.exec(shell)
    expect(href, "no skip link in components/app-shell.tsx").not.toBeNull()

    const target = new RegExp(`<main[^>]*id="${href?.[1]}"[^>]*>`).exec(shell)
    expect(target, `no <main id="${href?.[1]}"> for the skip link to land on`).not.toBeNull()
    // without tabIndex the browser scrolls but leaves focus behind
    expect(target?.[0]).toMatch(/tabIndex=\{-1\}/)
    // and it has to be visible once focused, or a sighted keyboard user loses it
    expect(shell).toMatch(/focus:not-sr-only/)
  })
})
