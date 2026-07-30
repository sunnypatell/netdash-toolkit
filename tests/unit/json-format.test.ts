import { describe, expect, it } from "vitest"
import { analyzeJson, jsonStats, MAX_ANALYZE_CHARS, scanJsonSource } from "@/lib/json-format"

describe("indentation", () => {
  const input = '{"a":1,"b":{"c":2}}'

  it("indents with two or four spaces", () => {
    expect(analyzeJson(input, "2", "pretty").output).toContain('\n  "a": 1')
    expect(analyzeJson(input, "4", "pretty").output).toContain('\n    "a": 1')
  })

  // JSON.stringify(value, null, 0) produces no whitespace at all, so the old
  // "Tab" option silently minified instead of indenting
  it("indents with a real tab character", () => {
    const output = analyzeJson(input, "tab", "pretty").output
    expect(output).toContain('\n\t"a": 1')
    expect(output).toContain('\n\t\t"c": 2')
    expect(output).not.toBe(JSON.stringify(JSON.parse(input)))
  })

  it("minifies on request", () => {
    expect(analyzeJson('{\n  "a": 1\n}', "2", "minify").output).toBe('{"a":1}')
  })
})

describe("numeric precision", () => {
  // JSON.parse rounds to the nearest double, and JSON.stringify writes the
  // rounded value back with no complaint
  it("warns that an integer past 2^53 was rounded", () => {
    const result = analyzeJson('{"id":9007199254740993}', "2", "pretty")
    expect(result.valid).toBe(true)
    expect(result.output).toContain("9007199254740992")
    const warning = result.warnings.find((w) => w.kind === "precision")
    expect(warning?.message).toContain("9007199254740993")
    expect(warning?.message).toContain("9007199254740992")
  })

  it("warns about a 20-digit id", () => {
    const result = analyzeJson('{"id":12345678901234567890}', "2", "pretty")
    expect(result.warnings.some((w) => w.kind === "precision")).toBe(true)
  })

  it("warns that an overflowing number becomes null on the way out", () => {
    const result = analyzeJson('{"n":1e400}', "2", "pretty")
    expect(result.output).toContain("null")
    expect(result.warnings.some((w) => w.kind === "non-finite")).toBe(true)
  })

  it("stays quiet for integers inside the safe range", () => {
    const result = analyzeJson('{"a":9007199254740991,"b":-42,"c":1.5,"d":1e3}', "2", "pretty")
    expect(result.warnings).toEqual([])
  })

  it("does not mistake digits inside a string for a number", () => {
    expect(analyzeJson('{"id":"9007199254740993"}', "2", "pretty").warnings).toEqual([])
  })
})

describe("duplicate keys", () => {
  // ecma-262 keeps the last one; the earlier value is gone with no error
  it("warns and names the key", () => {
    const result = analyzeJson('{"a":1,"a":2}', "2", "pretty")
    expect(result.valid).toBe(true)
    expect(result.output).toContain('"a": 2')
    const warning = result.warnings.find((w) => w.kind === "duplicate-key")
    expect(warning?.message).toContain('"a"')
  })

  it("finds a duplicate nested inside an array of objects", () => {
    const result = analyzeJson('{"rows":[{"x":1,"x":2}]}', "2", "pretty")
    expect(result.warnings.some((w) => w.kind === "duplicate-key")).toBe(true)
  })

  it("does not confuse the same key in sibling objects for a duplicate", () => {
    expect(analyzeJson('[{"a":1},{"a":2}]', "2", "pretty").warnings).toEqual([])
  })

  it("does not treat a string value that matches a key as a duplicate", () => {
    expect(analyzeJson('{"a":"a","b":"a"}', "2", "pretty").warnings).toEqual([])
  })

  it("handles escaped quotes and unicode escapes in keys", () => {
    expect(scanJsonSource('{"a\\"b":1,"a\\"b":2}').length).toBe(1)
    expect(scanJsonSource('{"\\u0061":1,"a":2}').length).toBe(1)
    expect(scanJsonSource('{"a:b":1,"c":2}')).toEqual([])
  })

  it("reports each distinct duplicated key once", () => {
    const warnings = scanJsonSource('{"a":1,"a":2,"a":3,"b":1,"b":2}')
    expect(warnings.filter((w) => w.kind === "duplicate-key")).toHaveLength(2)
  })
})

describe("stats", () => {
  it("counts every node type and the depth", () => {
    const stats = jsonStats({ a: [1, 2, { b: "s", c: true, d: null }] })
    expect(stats).toMatchObject({
      objects: 2,
      arrays: 1,
      numbers: 2,
      strings: 1,
      booleans: 1,
      nulls: 1,
      keys: 4,
    })
  })

  it("reports depth 0 for a scalar", () => {
    expect(jsonStats(42)).toMatchObject({ numbers: 1, depth: 0 })
  })

  // the recursive stats walk threw RangeError inside the parse try/catch, so
  // valid json was reported to the user as invalid
  it("walks deeply nested input without overflowing the stack", () => {
    const depth = 60_000
    const stats = jsonStats(JSON.parse("[".repeat(depth) + "]".repeat(depth)))
    expect(stats.arrays).toBe(depth)
    expect(stats.depth).toBe(depth - 1)
  })

  it("formats nesting that is deep but within JSON.stringify's reach", () => {
    const depth = 2_000
    const result = analyzeJson("[".repeat(depth) + "]".repeat(depth), "2", "minify")
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
    expect(result.stats?.arrays).toBe(depth)
  })

  // JSON.parse takes any depth; JSON.stringify recurses and gives up near 10k
  it("calls unserialisably deep input valid, not invalid, and says why", () => {
    const depth = 60_000
    const result = analyzeJson("[".repeat(depth) + "]".repeat(depth), "2", "minify")
    expect(result.valid).toBe(true)
    expect(result.error).toMatch(/Valid JSON, but too deeply nested/)
    expect(result.stats?.depth).toBe(depth - 1)
  })

  it("does not report deeply nested valid objects as invalid", () => {
    const deep = `${'{"a":'.repeat(20_000)}1${"}".repeat(20_000)}`
    expect(analyzeJson(deep, "2", "minify").valid).toBe(true)
  })
})

describe("invalid and empty input", () => {
  it("surfaces the parser message", () => {
    const result = analyzeJson("{oops}", "2", "pretty")
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
    expect(result.output).toBe("")
    expect(result.stats).toBeNull()
  })

  it("treats blank input as neither valid nor invalid", () => {
    expect(analyzeJson("   ", "2", "pretty")).toMatchObject({
      valid: null,
      error: null,
      output: "",
    })
  })

  it("accepts a bare scalar, which is valid JSON per RFC 8259", () => {
    expect(analyzeJson("42", "2", "pretty").valid).toBe(true)
    expect(analyzeJson('"hi"', "2", "pretty").valid).toBe(true)
    expect(analyzeJson("null", "2", "pretty").valid).toBe(true)
  })
})

describe("very large input", () => {
  it("still formats but skips the analysis passes, and says so", () => {
    const rows = Array.from({ length: 90_000 }, (_, i) => ({ i, name: `row number ${i}` }))
    const big = JSON.stringify(rows)
    expect(big.length).toBeGreaterThan(MAX_ANALYZE_CHARS)

    const result = analyzeJson(big, "2", "pretty")
    expect(result.valid).toBe(true)
    expect(result.output.length).toBeGreaterThan(big.length)
    expect(result.stats).toBeNull()
    expect(result.warnings.some((w) => w.kind === "too-large-to-analyze")).toBe(true)
  })
})
