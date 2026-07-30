import { describe, expect, it } from "vitest"
import { buildRegexWorkerSource, REGEX_FLAGS, runRegexMatch } from "@/lib/regex-run"

const DEADLINE = 1000

function run(pattern: string, flags: string, input: string, maxMatches = 500) {
  return runRegexMatch({ pattern, flags, input, maxMatches }, DEADLINE)
}

describe("runRegexMatch", () => {
  it("returns matches with positional groups", () => {
    const result = run("(\\d{4})-(\\d{2})", "g", "2021-01 and 2022-02")
    expect(result.error).toBeNull()
    expect(result.total).toBe(2)
    expect(result.matches[0].match).toBe("2021-01")
    expect(result.matches[0].index).toBe(0)
    expect(result.matches[0].groups.map((g) => [g.key, g.value])).toEqual([
      ["$1", "2021"],
      ["$2", "01"],
    ])
  })

  it("surfaces named capture groups, which slice(1) throws away", () => {
    const result = run("(?<year>\\d{4})-(?<month>\\d{2})", "g", "2021-01")
    expect(result.matches[0].named.map((g) => [g.key, g.value])).toEqual([
      ["year", "2021"],
      ["month", "01"],
    ])
  })

  it("reports optional groups that did not participate", () => {
    const result = run("a(b)?(c)", "g", "ac")
    expect(result.matches[0].groups.map((g) => g.value)).toEqual([null, "c"])
  })

  it("makes \\p{...} and \\u{...} mean what they should, which needs the u flag", () => {
    expect(run("\\p{L}+", "gu", "héllo").matches[0].match).toBe("héllo")
    expect(run("\\u{1F600}", "gu", "grin 😀").total).toBe(1)
    // without u these are identity escapes, so the tool used to quietly match nothing
    expect(run("\\p{L}+", "g", "héllo").total).toBe(0)
    expect(run("\\u{1F600}", "g", "grin 😀").total).toBe(0)
  })

  it("supports the v flag set notation, which u cannot express", () => {
    const result = run("[\\p{L}--[a-z]]", "gv", "aX")
    expect(result.error).toBeNull()
    expect(result.total).toBe(1)
    expect(result.matches[0].match).toBe("X")
    // the same pattern is a syntax error under u
    expect(run("[\\p{L}--[a-z]]", "gu", "aX").error).toBeTruthy()
  })

  it("respects the sticky flag", () => {
    expect(run("a", "y", "ba").total).toBe(0)
    expect(run("a", "y", "aab").total).toBe(2)
  })

  it("returns only the first match without g or y", () => {
    const result = run("a", "", "aaa")
    expect(result.total).toBe(1)
    expect(result.matches).toHaveLength(1)
  })

  it("caps rendered matches but keeps counting them", () => {
    const result = run("a", "g", "a".repeat(1200), 500)
    expect(result.total).toBe(1200)
    expect(result.matches).toHaveLength(500)
    expect(result.truncated).toBe(true)
  })

  it("advances past zero-length matches instead of looping forever", () => {
    const result = run("", "g", "abc")
    expect(result.error).toBeNull()
    expect(result.total).toBe(0)
  })

  // the empty-pattern case above returns before the loop, so it never proved the
  // advance works. these do, by agreeing with String.prototype.matchAll, which
  // uses the spec's own AdvanceStringIndex.
  it.each([
    ["(?:)", "g", "abc"],
    ["(?:)", "gu", "abc"],
    ["a*", "g", "bbb"],
    ["x*", "gu", "abc"],
  ])("matches /%s/%s on %s exactly where matchAll does", (pattern, flags, input) => {
    const result = run(pattern, flags, input)
    expect(result.deadlineHit).toBe(false)
    expect(result.matches.map((m) => m.index)).toEqual(
      [...input.matchAll(new RegExp(pattern, flags))].map((m) => m.index)
    )
  })

  // under u/v, exec snaps lastIndex back to the start of the code point, so the
  // old bare +1 landed inside a surrogate pair, was undone, and looped forever
  // on any astral character until the 1s deadline saved the tab.
  it.each([
    ["(?:)", "gu", "😀😀"],
    ["(?:)", "gv", "😀😀"],
    ["(?:)", "gu", "a😀b🎉c"],
    ["x*", "gu", "😀x😀"],
    ["a*", "gu", "b😀b"],
  ])("terminates on a zero-length /%s/%s over %s", (pattern, flags, input) => {
    const result = run(pattern, flags, input)
    expect(result.deadlineHit).toBe(false)
    expect(result.error).toBeNull()
    expect(result.matches.map((m) => m.index)).toEqual(
      [...input.matchAll(new RegExp(pattern, flags))].map((m) => m.index)
    )
  })

  it("never reports a match index inside a surrogate pair under the u flag", () => {
    const input = "😀😀"
    const result = run("(?:)", "gu", input)
    for (const match of result.matches) {
      const code = input.charCodeAt(match.index)
      const isTrailSurrogate = code >= 0xdc00 && code <= 0xdfff
      expect(isTrailSurrogate, `index ${match.index} splits a surrogate pair`).toBe(false)
    }
  })

  it("does not throw on an invalid pattern", () => {
    const result = run("(unclosed", "g", "x")
    expect(result.error).toBeTruthy()
    expect(result.matches).toEqual([])
    expect(result.total).toBe(0)
  })

  it("is a no-op for an empty pattern and empty input", () => {
    expect(run("", "g", "")).toMatchObject({ error: null, total: 0, matches: [] })
    expect(run("a+", "g", "")).toMatchObject({ error: null, total: 0 })
  })

  it("stops the match loop once the deadline passes", () => {
    // a cheap always-matching pattern over a big input: the loop itself must
    // give up, independently of the worker being terminated from outside
    const result = runRegexMatch(
      { pattern: "a", flags: "g", input: "a".repeat(4_000_000), maxMatches: 10 },
      5
    )
    expect(result.deadlineHit).toBe(true)
    expect(result.scanMs).toBeLessThan(2000)
  })
})

describe("buildRegexWorkerSource", () => {
  const source = buildRegexWorkerSource(DEADLINE)

  it("is syntactically valid javascript", () => {
    expect(() => new Function(source)).not.toThrow()
  })

  it("wires the message protocol", () => {
    expect(source).toContain("self.onmessage")
    expect(source).toContain("self.postMessage")
    expect(source).toContain("result.id = request.id")
  })

  it("embeds the matcher by value, never by identifier", () => {
    // a minifier renames the export; a name reference inside the string would
    // survive the rename and break the worker at runtime
    expect(source).toContain("var __ndRegexRun = function")
    expect(source.split("self.onmessage")[1]).not.toContain("runRegexMatch")
  })

  it("bakes the deadline in", () => {
    expect(buildRegexWorkerSource(1234)).toContain("__ndRegexRun(request, 1234)")
  })

  it("runs correctly when evaluated from source, as the worker does", () => {
    const messages: unknown[] = []
    const scope = {
      onmessage: null as null | ((event: { data: unknown }) => void),
      postMessage: (data: unknown) => messages.push(data),
    }
    new Function("self", source)(scope)
    scope.onmessage?.({
      data: { id: 7, pattern: "(?<n>\\d+)", flags: "g", input: "a1 b22", maxMatches: 500 },
    })
    expect(messages).toHaveLength(1)
    const result = messages[0] as { id: number; total: number; named: unknown }
    expect(result.id).toBe(7)
    expect(result.total).toBe(2)
  })
})

describe("REGEX_FLAGS", () => {
  it("exposes every flag a RegExp accepts", () => {
    expect(REGEX_FLAGS.map((f) => f.key)).toEqual(["g", "i", "m", "s", "u", "v", "y", "d"])
  })

  it("produces a usable flag string in canonical order", () => {
    const flags = REGEX_FLAGS.filter((f) => f.key !== "v")
      .map((f) => f.key)
      .join("")
    expect(() => new RegExp("a", flags)).not.toThrow()
  })
})
