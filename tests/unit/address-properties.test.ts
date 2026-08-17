import { describe, expect, it } from "vitest"
import fc from "fast-check"
import {
  ipv4ToInt,
  intToIpv4,
  prefixToMaskInt,
  prefixToNetmask,
  netmaskToPrefix,
  expandIPv6,
  compressIPv6,
  cidrToRange,
  isValidIPv4,
  isValidIPv6,
  isValidCIDR,
  parsePrefixText,
} from "@/lib/network-utils"

// example based tests only cover inputs somebody thought of. these assert
// invariants over generated input, which is how the parseInt class of bug was
// found: parseInt("24.5") is 24 and parseInt("80abc") is 80, so a mistyped
// prefix or port passed validation and reached a generated device config.

const RUNS = { numRuns: 500 }

const octet = fc.integer({ min: 0, max: 255 })
const ipv4 = fc.tuple(octet, octet, octet, octet).map((o) => o.join("."))
const prefix4 = fc.integer({ min: 0, max: 32 })
const hextet = fc.integer({ min: 0, max: 0xffff }).map((n) => n.toString(16))
const ipv6 = fc.array(hextet, { minLength: 8, maxLength: 8 }).map((h) => h.join(":"))

describe("ipv4 address arithmetic", () => {
  it("int conversion round trips for every address", () => {
    fc.assert(
      fc.property(ipv4, (address) => {
        expect(intToIpv4(ipv4ToInt(address))).toBe(address)
      }),
      RUNS
    )
  })

  it("prefix and netmask are inverses across the whole range", () => {
    fc.assert(
      fc.property(prefix4, (prefix) => {
        expect(netmaskToPrefix(prefixToNetmask(prefix))).toBe(prefix)
      }),
      RUNS
    )
  })

  it("a mask is always a run of ones followed by a run of zeroes", () => {
    // the property that makes a mask a mask. a non contiguous mask would still
    // have the right popcount, which is what a bit count check would miss.
    fc.assert(
      fc.property(prefix4, (prefix) => {
        const mask = prefixToMaskInt(prefix) >>> 0
        const inverted = ~mask >>> 0
        expect((inverted & (inverted + 1)) >>> 0).toBe(0)
      }),
      RUNS
    )
  })

  it("a wider prefix always covers at least as many addresses", () => {
    fc.assert(
      fc.property(prefix4, prefix4, (a, b) => {
        const [narrow, wide] = a <= b ? [b, a] : [a, b]
        const size = (p: number) => 2 ** (32 - p)
        expect(size(wide)).toBeGreaterThanOrEqual(size(narrow))
      }),
      RUNS
    )
  })
})

describe("cidr ranges", () => {
  it("the network address is never above the broadcast address", () => {
    fc.assert(
      fc.property(ipv4, prefix4, (address, prefix) => {
        const range = cidrToRange(`${address}/${prefix}`)
        expect(range.start).toBeLessThanOrEqual(range.end)
      }),
      RUNS
    )
  })

  it("every address in a range stays inside it when re-parsed", () => {
    fc.assert(
      fc.property(ipv4, prefix4, (address, prefix) => {
        const range = cidrToRange(`${address}/${prefix}`)
        const again = cidrToRange(`${intToIpv4(range.start)}/${prefix}`)
        expect(again.start).toBe(range.start)
        expect(again.end).toBe(range.end)
      }),
      RUNS
    )
  })

  it("the range holds exactly the number of addresses the prefix implies", () => {
    fc.assert(
      fc.property(ipv4, fc.integer({ min: 8, max: 32 }), (address, prefix) => {
        const range = cidrToRange(`${address}/${prefix}`)
        expect(range.end - range.start + 1).toBe(2 ** (32 - prefix))
      }),
      RUNS
    )
  })
})

describe("ipv6 text forms", () => {
  it("compression never changes which address is meant", () => {
    fc.assert(
      fc.property(ipv6, (address) => {
        expect(expandIPv6(compressIPv6(address))).toBe(expandIPv6(address))
      }),
      RUNS
    )
  })

  it("expansion is idempotent", () => {
    fc.assert(
      fc.property(ipv6, (address) => {
        const once = expandIPv6(address)
        expect(expandIPv6(once)).toBe(once)
      }),
      RUNS
    )
  })

  it("an expanded address is always eight four-digit groups", () => {
    fc.assert(
      fc.property(ipv6, (address) => {
        expect(expandIPv6(address)).toMatch(/^([0-9a-f]{4}:){7}[0-9a-f]{4}$/)
      }),
      RUNS
    )
  })
})

describe("validators are total: any string gets a verdict, never a wrong one", () => {
  it("no arbitrary string is ever accepted as an address", () => {
    // the guard that matters. a validator returning true for junk is worse than
    // one that throws, because the junk then flows into a generated config.
    fc.assert(
      fc.property(fc.string(), (text) => {
        if (isValidIPv4(text)) expect(text).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/)
        if (isValidCIDR(text)) expect(text).toContain("/")
      }),
      RUNS
    )
  })

  it("validators never throw, whatever they are handed", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(() => isValidIPv4(text)).not.toThrow()
        expect(() => isValidIPv6(text)).not.toThrow()
        expect(() => isValidCIDR(text)).not.toThrow()
      }),
      RUNS
    )
  })

  it("a prefix is decimal digits or nothing", () => {
    // parseInt read "24.5" as 24 and "8abc" as 8, so a mistyped prefix silently
    // returned a different network than the one asked for
    fc.assert(
      fc.property(fc.string(), (text) => {
        const parsed = parsePrefixText(text, 32)
        if (parsed !== null) {
          expect(text).toMatch(/^\d{1,3}$/)
          expect(parsed).toBeLessThanOrEqual(32)
          expect(Number.isInteger(parsed)).toBe(true)
        }
      }),
      RUNS
    )
  })

  it.each(["24.5", "8abc", "+24", " 24", "24 ", "0x18", "1e1", "２４"])(
    "rejects %j, which parseInt would have accepted",
    (text) => {
      expect(parsePrefixText(text, 32)).toBeNull()
      expect(isValidCIDR(`10.0.0.0/${text}`)).toBe(false)
    }
  )

  it("a non-integer prefix never yields a mask", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 32, noNaN: true }), (prefix) => {
        fc.pre(!Number.isInteger(prefix))
        expect(() => prefixToMaskInt(prefix)).toThrow()
      }),
      RUNS
    )
  })
})
