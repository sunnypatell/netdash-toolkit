import { describe, expect, it } from "vitest"
import {
  buildCharset,
  CHARS,
  entropyBits,
  EmptyCharsetError,
  generatePassword,
  strengthOf,
  uniformIndex,
  type PasswordOptions,
} from "@/lib/password-gen"

const base: PasswordOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
  excludeSimilar: false,
}

describe("exclusions remove every occurrence", () => {
  it("strips all similar characters, not just the first", () => {
    const charset = buildCharset({ ...base, excludeSimilar: true })
    for (const c of CHARS.similar) expect(charset).not.toContain(c)
  })

  it("strips all ambiguous characters", () => {
    const charset = buildCharset({ ...base, excludeAmbiguous: true })
    for (const c of CHARS.ambiguous) expect(charset).not.toContain(c)
  })

  it("removes both duplicated symbols when a class contains one twice", () => {
    // "." and "," appear in both the symbol pool and the ambiguous list
    const charset = buildCharset({ ...base, excludeAmbiguous: true })
    expect(charset).not.toMatch(/[.,]/)
  })

  it("returns an empty charset instead of silently substituting one", () => {
    expect(
      buildCharset({
        ...base,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
      })
    ).toBe("")
    // digits survive both exclusions, but digits-only with similar excluded must shrink, not reset
    const digits = buildCharset({ ...base, uppercase: false, lowercase: false, symbols: false })
    expect(digits).toBe(CHARS.numbers)
    const digitsFiltered = buildCharset({
      ...base,
      uppercase: false,
      lowercase: false,
      symbols: false,
      excludeSimilar: true,
    })
    expect(digitsFiltered).toBe("23456789")
  })

  it("never yields duplicate characters", () => {
    const charset = buildCharset(base)
    expect(new Set(charset).size).toBe(charset.length)
  })
})

describe("empty charset is an error, not silent fallback", () => {
  it("throws EmptyCharsetError", () => {
    const options = {
      ...base,
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
    }
    expect(() => generatePassword(options)).toThrow(EmptyCharsetError)
  })

  it("entropy is 0, never -Infinity", () => {
    const strength = strengthOf(0, 16)
    expect(strength.entropy).toBe(0)
    expect(Number.isFinite(strength.entropy)).toBe(true)
    expect(strengthOf(1, 16).entropy).toBe(0)
  })
})

describe("entropy reflects the charset actually used", () => {
  it("shrinks when exclusions shrink the charset", () => {
    const full = buildCharset(base).length
    const trimmed = buildCharset({ ...base, excludeSimilar: true, excludeAmbiguous: true }).length
    expect(trimmed).toBeLessThan(full)
    expect(entropyBits(trimmed, 16)).toBeLessThan(entropyBits(full, 16))
  })

  it("stays finite for the maximum length", () => {
    const bits = entropyBits(buildCharset(base).length, 128)
    expect(Number.isFinite(bits)).toBe(true)
    expect(bits).toBeGreaterThan(700)
  })

  it("matches length * log2(size)", () => {
    expect(entropyBits(64, 10)).toBeCloseTo(60, 10)
  })
})

describe("uniformIndex rejects instead of folding", () => {
  it("discards draws in the biased tail", () => {
    // size 3: limit = floor(2^32/3)*3 = 4294967295, which must be rejected and the next draw used
    const draws = [4294967295, 7]
    let i = 0
    const index = uniformIndex(3, (buffer) => {
      buffer[0] = draws[i++]
    })
    expect(index).toBe(1)
    expect(i).toBe(2)
  })

  it("uses a draw below the limit directly", () => {
    expect(uniformIndex(10, (buffer) => (buffer[0] = 43))).toBe(3)
  })

  it("is deterministic for a single-character charset", () => {
    let calls = 0
    expect(
      uniformIndex(1, () => {
        calls++
      })
    ).toBe(0)
    expect(calls).toBe(0)
  })

  it("rejects a non-positive size", () => {
    expect(() => uniformIndex(0)).toThrow()
  })

  it("stays in range across many real crypto draws", () => {
    for (let i = 0; i < 5000; i++) {
      const index = uniformIndex(26)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(26)
    }
  })
})

describe("generated passwords are uniform over the charset", () => {
  it("passes a chi-square goodness-of-fit test against crypto.getRandomValues", () => {
    const options: PasswordOptions = { ...base, length: 200 }
    const charset = buildCharset(options)
    const counts = new Map<string, number>([...charset].map((c) => [c, 0]))

    const draws = 400
    for (let i = 0; i < draws; i++) {
      for (const char of generatePassword(options)) {
        counts.set(char, (counts.get(char) ?? 0) + 1)
      }
    }

    const total = draws * options.length
    const expected = total / charset.length
    let chiSquare = 0
    for (const count of counts.values()) {
      chiSquare += Math.pow(count - expected, 2) / expected
    }

    // df = 87 for the 88-character charset, 0.999 critical ~144, so this flakes 1 run in 1000
    expect(charset.length).toBe(88)
    expect(chiSquare).toBeLessThan(144)
    // every character must actually be reachable
    expect([...counts.values()].every((c) => c > 0)).toBe(true)
  })

  it("honours the requested length and charset", () => {
    const options: PasswordOptions = { ...base, length: 32, symbols: false, excludeSimilar: true }
    const charset = buildCharset(options)
    const password = generatePassword(options)
    expect(password).toHaveLength(32)
    for (const c of password) expect(charset).toContain(c)
  })
})
