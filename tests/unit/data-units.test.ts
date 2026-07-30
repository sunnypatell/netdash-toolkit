import { describe, expect, it } from "vitest"
import {
  BINARY_UNITS,
  DATA_UNITS,
  DECIMAL_UNITS,
  convertAll,
  displayString,
  exactString,
  findUnit,
  toBits,
} from "@/lib/data-units"

// the defining bug of this tool category is treating MB as MiB, or bits as
// bytes. every assertion here is a value from IEC 80000-13:2008 / IEEE
// 1541-2002 rather than a value read back out of the implementation.

const bitsOf = (id: string) => findUnit(id)?.bits ?? NaN

describe("decimal and binary multiples are distinct", () => {
  it("uses powers of 1000 for SI prefixes and 1024 for IEC prefixes", () => {
    expect(bitsOf("kB")).toBe(8 * 1000)
    expect(bitsOf("KiB")).toBe(8 * 1024)
    expect(bitsOf("MB")).toBe(8 * 1_000_000)
    expect(bitsOf("MiB")).toBe(8 * 1_048_576)
    expect(bitsOf("GB")).toBe(8 * 1e9)
    expect(bitsOf("GiB")).toBe(8 * 1024 ** 3)
  })

  it("never lets a decimal unit equal its binary namesake", () => {
    for (const pair of [
      ["kB", "KiB"],
      ["MB", "MiB"],
      ["GB", "GiB"],
      ["TB", "TiB"],
      ["PB", "PiB"],
      ["kbit", "Kibit"],
      ["Mbit", "Mibit"],
    ]) {
      expect(bitsOf(pair[0]), pair.join(" vs ")).not.toBe(bitsOf(pair[1]))
      expect(bitsOf(pair[1])).toBeGreaterThan(bitsOf(pair[0]))
    }
  })

  it("labels each unit with its own base, so nothing is filed under the wrong one", () => {
    for (const unit of DECIMAL_UNITS) expect(unit.base, unit.id).toBe("decimal")
    for (const unit of BINARY_UNITS) expect(unit.base, unit.id).toBe("binary")
    expect(BINARY_UNITS.every((u) => /^(Ki|Mi|Gi|Ti|Pi)/.test(u.symbol))).toBe(true)
  })

  it("keeps every factor exactly representable as a double", () => {
    // 2^53 is the largest integer double arithmetic represents exactly, and PiB
    // sits right on it. anything above would quietly round.
    for (const unit of DATA_UNITS) {
      expect(Number.isInteger(unit.bits), `${unit.id} = ${unit.bits}`).toBe(true)
      expect(unit.bits, unit.id).toBeLessThanOrEqual(2 ** 53)
    }
  })
})

describe("bits are not bytes", () => {
  it("puts exactly 8 bits in a byte at every prefix", () => {
    expect(bitsOf("B")).toBe(8 * bitsOf("bit"))
    expect(bitsOf("kB")).toBe(8 * bitsOf("kbit"))
    expect(bitsOf("MiB")).toBe(8 * bitsOf("Mibit"))
  })

  it("converts 100 Mbit to 12.5 MB, not 100 MB", () => {
    const results = convertAll(100, "Mbit")!
    const mb = results.find((r) => r.unit.id === "MB")!
    expect(mb.value).toBe(12.5)
  })

  it("uses distinct symbols throughout, so nothing collides on case alone", () => {
    const symbols = DATA_UNITS.map((u) => u.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
    // "kb" vs "kB" was the old ambiguity; the bit units are spelled out now
    expect(symbols).not.toContain("kb")
    expect(symbols).toContain("kbit")
  })
})

describe("conversion", () => {
  it("agrees with the textbook figures", () => {
    const oneGb = convertAll(1, "GB")!
    const get = (id: string) => oneGb.find((r) => r.unit.id === id)!.value
    expect(get("B")).toBe(1e9)
    expect(get("MB")).toBe(1000)
    expect(get("MiB")).toBeCloseTo(953.67431640625, 9)
    expect(get("GiB")).toBeCloseTo(0.93132257461548, 10)
    expect(get("Gbit")).toBe(8)
  })

  it("round trips a value through every unit", () => {
    for (const unit of DATA_UNITS) {
      const bits = toBits(1, unit.id)!
      expect(bits).toBe(unit.bits)
      const back = convertAll(1, unit.id)!.find((r) => r.unit.id === unit.id)!
      expect(back.value).toBe(1)
    }
  })

  it("rejects unusable input rather than rendering NaN", () => {
    expect(convertAll(NaN, "MB")).toBeNull()
    expect(convertAll(-1, "MB")).toBeNull()
    expect(convertAll(1, "not-a-unit")).toBeNull()
  })

  it("handles a 4.7 GB disc in mebibytes", () => {
    const mib = convertAll(4.7, "GB")!.find((r) => r.unit.id === "MiB")!
    expect(mib.value).toBeCloseTo(4482.269287109375, 6)
  })
})

describe("number rendering", () => {
  it("never collapses a small figure to a bare zero", () => {
    expect(displayString(0.0000001)).toMatch(/e-/)
    expect(displayString(0)).toBe("0")
  })

  it("hands raw digits to the clipboard, not grouped ones", () => {
    expect(exactString(1000000)).toBe("1000000")
    expect(displayString(1000000)).toBe("1,000,000")
  })

  it("keeps a copied value parseable back to itself", () => {
    for (const value of [1, 0.5, 12.5, 953.67431640625, 1e9]) {
      expect(Number(exactString(value))).toBeCloseTo(value, 9)
    }
  })
})
