import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"

// wcag 2.2 sc 3.3.1 error identification (a) and sc 3.3.3 error suggestion (aa):
// https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
// https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html
//
// every error surface in this app already announces, because the destructive
// Alert primitive carries role="alert". what 3.3.1 additionally requires is that
// the *item* in error is identified, and 3.3.3 that the suggestion reaches the
// person who has to act on it. an announcement with no association tells a
// screen reader user that something is wrong without telling them which field to
// go back to, which is the state the conformance record recorded as gap 3.
//
// this is asserted statically because the runtime scan cannot do it. the resting
// tree of a tool nobody has typed into holds no error at all, and the runtime
// dangling-reference check in tests/components/wcag-live-regions.test.tsx
// deliberately skips every id ending in "-error" for exactly that reason, so a
// typo in an error id is invisible to it. here the reference is resolved against
// the source, where the id exists whether or not the error is on screen.

const TOOLS = join("components", "tools")
const UI = join("components", "ui")

function tsxUnder(root: string): string[] {
  const out: string[] = []
  for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (rel.endsWith(".tsx")) out.push(join(root, rel))
  }
  return out
}

const FILES = [...tsxUnder(TOOLS), ...tsxUnder(UI)]
const SOURCE = new Map(FILES.map((file) => [file, readFileSync(file, "utf8")]))

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

// several tools split the input from the panel that reports the failure: the URL
// field lives in index.tsx and the message in a lazily loaded relay.tsx, so the
// reference is legitimately cross-file within one tool folder. resolving per file
// would report all of those as broken, which is the mistake that let 24 panel
// files sit outside an earlier gate.
function idsDeclaredNear(file: string): Set<string> {
  const dir = dirname(file)
  const ids = new Set<string>()
  for (const [other, source] of SOURCE) {
    if (dirname(other) !== dir) continue
    for (const m of source.matchAll(/\bid="([^"{}]+)"/g)) ids.add(m[1])
    // an id built from useId() cannot be resolved statically; the primitives that
    // do that resolve it at runtime instead
    for (const m of source.matchAll(/\bid=\{([^}]*)\}/g)) if (m[1].includes("Id")) ids.add("*")
  }
  return ids
}

// every string literal inside an aria-describedby attribute value, whether it is
// a bare string, a ternary, or a space-separated token list.
//
// the first version of this reported thirteen dangling ids that were not ids at
// all: `aria-describedby={invalidField === "time" ? "download-size-error" :
// undefined}` also holds the literal being compared against, and reading that as
// a reference makes a correctly wired field look broken. operands of a
// comparison and arguments to a string method are dropped first.
function describedByLiterals(attributeValue: string): string[] {
  const value = attributeValue
    .replace(/[=!]==?\s*(["'])(?:(?!\1).)*\1/g, " ")
    .replace(/(["'])(?:(?!\1).)*\1\s*[=!]==?/g, " ")
    .replace(/\.\w+\(\s*(["'])(?:(?!\1).)*\1\s*\)/g, " ")
  const ids: string[] = []
  for (const m of value.matchAll(/"([^"]*)"|'([^']*)'/g)) {
    for (const id of (m[1] ?? m[2] ?? "").split(/\s+/).filter(Boolean)) {
      // a fragment of a template literal is not an id
      if (!/[${}`]/.test(id)) ids.push(id)
    }
  }
  return ids
}

// aria-describedby is not the only spelling of the reference. a shared primitive
// takes the id as a prop and applies the attribute itself, so subnet-calculator
// writes `describedBy={...}` onto <IPInput> and conflict-checker writes
// `analysisErrorId={...}` onto its panel. reading only the attribute reported
// four correctly wired surfaces as orphaned.
const ARIA_ONLY = /aria-describedby=(\{|")/
const ANY_DESCRIPTION = /(?:aria-describedby|describedBy|[A-Za-z]*[Ee]rrorId)=(\{|")/

function describedByAttributes(
  source: string,
  pattern: RegExp = ANY_DESCRIPTION
): { value: string; index: number }[] {
  const out: { value: string; index: number }[] = []
  const attr = new RegExp(pattern.source, "g")
  for (const m of source.matchAll(attr)) {
    const start = m.index + m[0].length
    if (m[1] === '"') {
      // the quotes are put back so the bare-string form reads the same to the
      // literal extractor as the ternary form does. without them every
      // aria-describedby="..." in the tree resolved to no ids at all and the
      // check quietly stopped covering the four tools that use it.
      const end = source.indexOf('"', start)
      out.push({ value: `"${source.slice(start, end)}"`, index: m.index })
      continue
    }
    // balance the braces so a ternary containing an object or template survives
    let depth = 1
    let i = start
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++
      else if (source[i] === "}") depth--
      i++
    }
    out.push({ value: source.slice(start, i - 1), index: m.index })
  }
  return out
}

// several panels hoist the reference into a local rather than spelling it inline:
// `const describedBy = unsupported ? "wireless-capacity-error" : undefined` and
// then `aria-describedby={describedBy}`; the two shared primitives go further and
// build a space-separated list so their own message and the caller's can both be
// named. reading only the attribute reported all three wireless panels and both
// primitives as unassociated when every one of them is wired correctly.
//
// so every identifier in the value is followed to its declaration, twice, which
// is enough for `description -> [errorId, describedBy]`. it is deliberately not
// a full resolver: it over-approximates, and the assertions it feeds are all
// "is this reference present", where over-approximating costs coverage rather
// than producing a false pass on a surface that names no id at all.
function expand(source: string, value: string, depth = 2): string {
  if (depth === 0) return value
  let out = value
  for (const m of value.matchAll(/[A-Za-z_$][\w$]*/g)) {
    const declaration = new RegExp(
      `\\b(?:const|let)\\s+${m[0]}\\s*(?::[^=\\n]+)?=\\s*([^\\n]+(?:\\n\\s+[^\\n]+)?)`
    ).exec(source)
    if (declaration) out += ` ${expand(source, declaration[1], depth - 1)}`
  }
  return out
}

describe("3.3.1: every aria-describedby resolves to an element that exists", () => {
  it("the scan still has references to resolve", () => {
    const total = [...SOURCE.values()].reduce(
      (n, source) => n + describedByAttributes(source).length,
      0
    )
    // if this collapses the assertion below passes vacuously
    expect(total, "no aria-describedby anywhere, so nothing below is checked").toBeGreaterThan(30)
  })

  it("names no id that no sibling file declares", () => {
    const dangling: string[] = []
    for (const [file, source] of SOURCE) {
      const declared = idsDeclaredNear(file)
      if (declared.has("*")) continue
      for (const { value, index } of describedByAttributes(source, ARIA_ONLY)) {
        // only a bare identifier is followed here. expanding further pulls in
        // unrelated string literals from neighbouring declarations and reports
        // them as dangling ids, which is a false alarm in the one check whose
        // whole job is to be precise.
        const resolved = /^[A-Za-z_$][\w$]*$/.test(value.trim()) ? expand(source, value, 1) : value
        for (const id of describedByLiterals(resolved)) {
          if (!declared.has(id)) {
            dangling.push(`${file}:${lineOf(source, index)}: aria-describedby names "${id}"`)
          }
        }
      }
    }
    expect(
      dangling,
      `a described-by pointing at an id nothing renders is dropped silently, which looks ` +
        `identical to no association at all:\n${dangling.join("\n")}`
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------

// an error surface is a destructive Alert, or a message element painted with the
// destructive token, that is rendered conditionally. an unconditional destructive
// Alert is a standing caveat rather than a reported error, and is not a 3.3.1
// surface: the third-party relay warnings are the whole of that class.
const DESTRUCTIVE_ALERT = /<Alert\s[^>]*variant="destructive"/g
const DESTRUCTIVE_TEXT = /<p\s[^>]*className=\{?["'`][^"'`]*text-(?:destructive|red-\d)/g

interface Surface {
  file: string
  line: number
  index: number
  body: string
}

// the JSX element plus the block it renders, so the id on its description and
// the text of the message are both inside `body`
function blockFrom(source: string, index: number, closing: string): string {
  const end = source.indexOf(closing, index)
  return source.slice(index, end === -1 ? Math.min(source.length, index + 600) : end)
}

// a surface preceded by `&& (`, `? (` or `: (` is rendered only when some state
// says so, which is what makes it a reported error rather than a standing notice.
//
// the `: (` arm was missing at first, and vlsm-planner's plan-failure alert sits
// in exactly that position, so the scan never saw it. that is the shape of every
// gate failure recorded in the conformance record: not a wrong rule, a rule
// pointed slightly to one side of the thing it was written for.
function isConditional(source: string, index: number): boolean {
  const before = source.slice(Math.max(0, index - 220), index)
  return /(?:&&|\?|:)\s*\(?\s*$/.test(before)
}

function errorSurfaces(): Surface[] {
  const found: Surface[] = []
  for (const [file, source] of SOURCE) {
    for (const [pattern, closing] of [
      [DESTRUCTIVE_ALERT, "</Alert>"],
      [DESTRUCTIVE_TEXT, "</p>"],
    ] as const) {
      for (const m of source.matchAll(pattern)) {
        if (!isConditional(source, m.index)) continue
        found.push({
          file,
          line: lineOf(source, m.index),
          index: m.index,
          body: blockFrom(source, m.index, closing),
        })
      }
    }
  }
  return found
}

// a surface that reports something other than an input error is exempt, and each
// exemption has to say which one and why. matched on a distinctive substring of
// the surface's own source so it survives the lines moving, and a substring that
// matches nothing fails below rather than rotting quietly.
const NOT_AN_INPUT_ERROR: { file: string; contains: string; why: string }[] = [
  {
    file: join(TOOLS, "hash-generator", "index.tsx"),
    contains: "AVAILABILITY_MESSAGE[availability]",
    why: "web crypto is unavailable in this browser or on this origin, which no input can fix",
  },
  {
    file: join(TOOLS, "network-tester", "mtu-panel.tsx"),
    contains: "IPv6 minimum of 1280 bytes",
    why: "a verdict on a computed result, stated in words for 1.4.1, not a rejected value",
  },
  {
    file: join(TOOLS, "jwt-decoder.tsx"),
    contains: "this token is unsigned",
    why: "a finding about a token that decoded correctly, not a reason the input was rejected",
  },
  {
    file: join(TOOLS, "regex-tester.tsx"),
    contains: "catastrophic backtracking",
    why: "the pattern is valid; the run was stopped on a deadline, and the field is already tied to the invalid-pattern message",
  },
  {
    file: join(TOOLS, "security-headers", "grade-report.tsx"),
    contains: "Unverified - via third-party relay",
    why: "provenance of a result, not a rejected value",
  },
  {
    file: join(TOOLS, "security-headers", "grade-report.tsx"),
    contains: "RFC 6797",
    why: "a finding about the response that was graded, not about anything the user typed",
  },
  {
    file: join(TOOLS, "ping-traceroute", "interfaces.tsx"),
    contains: "{error}",
    why: "the desktop bridge failed to read the machine's interfaces; there is no field behind it",
  },
  {
    file: join(TOOLS, "dns-tools", "results.tsx"),
    contains: "{result.error}",
    why: "one row of a results list, carrying what the resolver said about a query that was accepted. the field itself is already tied to dns-tools-error for the submit-time rejection, and each row carries its own sr-only Failed prefix.",
  },
  {
    file: join(TOOLS, "email-diagnostics", "issues.tsx"),
    contains: "{errors.map((error)",
    why: "findings about the domain that was looked up, not a rejection of what was typed",
  },
  {
    file: join(TOOLS, "vlan-manager", "index.tsx"),
    contains: "Subnet overlaps detected",
    why: "a relation between two committed subnets on two different rows, and neither row is more at fault than the other. the only subnet control is a draft-add field that is cleared once the value is committed, so at the moment the error exists no input holds the offending value. closing it properly needs a per-row affordance, which is recorded as remaining work rather than faked with an association to the wrong field.",
  },
  {
    file: join(UI, "user-menu.tsx"),
    contains: "{error || localError}",
    why: "the identity provider's rejection of a submitted form, not per-field validation. 3.3.1 is met here by the other route it allows, describing the error in text: the message itself names the item, and the fields it could concern are already tied to their own validation messages.",
  },
  {
    file: join(UI, "account-settings-dialog.tsx"),
    contains: "<AlertDescription>{error}</AlertDescription>",
    why: "as user-menu.tsx: one slot shared by three tabs of forms, carrying the server's reason rather than a field verdict",
  },
  {
    file: join(UI, "share-project-dialog.tsx"),
    contains: "<AlertDescription>{error}</AlertDescription>",
    why: "as user-menu.tsx: the share request was refused, and the message states why",
  },
]

describe("3.3.1: every reported input error names the field that produced it", () => {
  const surfaces = errorSurfaces()

  it("found the error surfaces it is meant to police", () => {
    // the count is a floor, not an exact number: a scan that silently stops
    // matching reports zero offenders and looks like a clean bill of health,
    // which is how the contrast ring check passed three times while matching
    // nothing at all.
    expect(
      surfaces.length,
      "the error-surface scan matched almost nothing, so every assertion below is vacuous"
    ).toBeGreaterThan(40)
  })

  it("carries no stale exemption", () => {
    const stale = NOT_AN_INPUT_ERROR.filter(
      (entry) => !surfaces.some((s) => s.file === entry.file && s.body.includes(entry.contains))
    ).map((entry) => `${entry.file}: "${entry.contains}"`)
    expect(
      stale,
      `an exemption that matches no surface is a claim nothing is checking:\n${stale.join("\n")}`
    ).toEqual([])
  })

  it("ties every remaining surface to a field", () => {
    const orphaned: string[] = []
    for (const surface of surfaces) {
      const exempt = NOT_AN_INPUT_ERROR.some(
        (entry) => entry.file === surface.file && surface.body.includes(entry.contains)
      )
      if (exempt) continue

      const ids = [...surface.body.matchAll(/\bid="([^"{}]+)"/g)].map((m) => m[1])
      // the shared primitives and one panel build the id from useId() or from a
      // template, so there is no literal to match. the reference is then the
      // expression itself, and it is resolved by name below.
      const expressionIds = [...surface.body.matchAll(/\bid=\{([^}]+)\}/g)].map((m) => m[1].trim())
      if (ids.length === 0 && expressionIds.length === 0) {
        orphaned.push(`${surface.file}:${surface.line}: the message carries no id`)
        continue
      }
      // the id has to be pointed at, not merely present. resolving across the
      // tool folder covers the panels whose input sits in the parent index.tsx.
      const referenced = [...SOURCE]
        .filter(([other]) => dirname(other) === dirname(surface.file))
        .some(([, source]) =>
          describedByAttributes(source).some((a) => {
            const value = expand(source, a.value)
            return (
              describedByLiterals(value).some((id) => ids.includes(id)) ||
              expressionIds.some((expr) => value.includes(expr))
            )
          })
        )
      if (!referenced) {
        orphaned.push(
          `${surface.file}:${surface.line}: "${[...ids, ...expressionIds].join(", ")}" is on the ` +
            `message but no aria-describedby in ${dirname(surface.file)} points at it`
        )
      }
    }
    expect(
      orphaned,
      `3.3.1 requires the item in error to be identified. these announce that something is ` +
        `wrong without saying which field to go back to:\n${orphaned.join("\n")}`
    ).toEqual([])
  })

  it("marks the field invalid wherever the error state is in scope", () => {
    // aria-describedby says what is wrong; aria-invalid says the control is the
    // thing that is wrong. a control carrying one and not the other is the
    // half-wired state, and it is only checkable where both the field and the
    // error state live in one file.
    const missing: string[] = []
    for (const [file, source] of SOURCE) {
      const surfacesHere = errorSurfaces().filter((s) => s.file === file)
      if (surfacesHere.length === 0) continue
      const exemptOnly = surfacesHere.every((s) =>
        NOT_AN_INPUT_ERROR.some((e) => e.file === s.file && s.body.includes(e.contains))
      )
      if (exemptOnly) continue
      // no describedby in this file means the association is cross-file, and the
      // referring file is where aria-invalid would have to live
      if (!/aria-describedby/.test(source)) continue
      if (!/aria-invalid/.test(source)) missing.push(file)
    }
    expect(
      missing,
      `these tie a message to a field but never mark the field invalid:\n${missing.join("\n")}`
    ).toEqual([])
  })
})
