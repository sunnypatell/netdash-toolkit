import { describe, expect, it } from "vitest"
import {
  NON_PUBLIC_IPV4,
  applyMacScope,
  formatIPv4,
  formatMac,
  nonPublicReason,
  randomIPv4,
  randomIPv6,
  randomInt,
  randomMac,
  type MacOptions,
} from "@/lib/random-gen"

// these addresses go into lab configs, so "random" must be uniform and "public" globally routable

const toInt = (dotted: string) =>
  dotted.split(".").reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0)

describe("randomInt is uniform, not folded", () => {
  it("discards a draw in the biased tail rather than taking it modulo", () => {
    // size 3: limit = 4294967295; folding it returns 0, rejecting it and redrawing gives 7 % 3 = 1
    const draws = [4294967295, 7]
    let i = 0
    const value = randomInt(0, 2, (buffer) => {
      buffer[0] = draws[i++]
    })
    expect(value).toBe(1)
    expect(i).toBe(2)
  })

  it("offsets by min without changing the span", () => {
    expect(randomInt(10, 12, (buffer) => (buffer[0] = 43))).toBe(11)
    expect(randomInt(5, 5, () => undefined)).toBe(5)
  })

  it("refuses nonsense bounds", () => {
    // matched on message: a bare toThrow() also accepted uniformIndex's "size must be positive"
    expect(() => randomInt(5, 1)).toThrow(/max must be >= min/)
    expect(() => randomInt(0.5, 3)).toThrow(/bounds must be integers/)
  })

  it("covers the full 32-bit range without overflowing", () => {
    for (let i = 0; i < 2000; i++) {
      const value = randomInt(0, 0xffffffff)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0xffffffff)
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it("passes a chi-square goodness-of-fit test over a range that is not a power of two", () => {
    // 100 does not divide 2^32, so folding over-represents the low buckets; df = 99, 0.999 is ~148
    const buckets = new Array(100).fill(0)
    const draws = 200_000
    for (let i = 0; i < draws; i++) buckets[randomInt(0, 99)]++

    const expected = draws / buckets.length
    const chiSquare = buckets.reduce((acc, n) => acc + (n - expected) ** 2 / expected, 0)
    expect(chiSquare).toBeLessThan(148)
    expect(buckets.every((n) => n > 0)).toBe(true)
  })

  it("shows no low-bucket skew, which is what modulo folding looks like", () => {
    const draws = 200_000
    let low = 0
    for (let i = 0; i < draws; i++) if (randomInt(0, 999) < 500) low++
    // 4 sigma either side of draws/2
    expect(Math.abs(low - draws / 2)).toBeLessThan(4 * Math.sqrt(draws / 4))
  })
})

describe("ipv4 generation stays inside the range it claims", () => {
  const runs = 3000

  it("keeps private ranges inside their RFC 1918 prefixes", () => {
    for (let i = 0; i < runs; i++) {
      expect(randomIPv4("private-a")).toMatch(/^10\.\d+\.\d+\.\d+$/)
      const b = randomIPv4("private-b").split(".").map(Number)
      expect(b[0]).toBe(172)
      expect(b[1]).toBeGreaterThanOrEqual(16)
      expect(b[1]).toBeLessThanOrEqual(31)
      expect(randomIPv4("private-c")).toMatch(/^192\.168\.\d+\.\d+$/)
    }
  })

  it("keeps loopback in 127/8 and link-local in 169.254/16", () => {
    for (let i = 0; i < runs; i++) {
      expect(randomIPv4("loopback")).toMatch(/^127\./)
      expect(randomIPv4("link-local")).toMatch(/^169\.254\./)
    }
  })

  it("never emits a reserved address in public mode", () => {
    // the old filter excluded 172.x to 191.x and 192.x while letting 169.254/16 and 100.64/10 pass
    for (let i = 0; i < runs; i++) {
      const address = randomIPv4("public")
      const reason = nonPublicReason(toInt(address))
      expect(reason, `${address} is ${reason}`).toBeNull()
    }
  })

  it("does emit the ranges the old filter wrongly excluded", () => {
    const firsts = new Set<number>()
    for (let i = 0; i < 20000; i++) {
      firsts.add(Number(randomIPv4("public").split(".")[0]))
    }
    // 173-191 and 192.x outside 192.168/16 are perfectly routable
    expect([...firsts].some((f) => f >= 173 && f <= 191)).toBe(true)
    expect(firsts.has(192)).toBe(true)
  })

  it("classifies every documented reserved block", () => {
    const cases: [string, RegExp][] = [
      ["0.1.2.3", /RFC 1122/],
      ["10.1.2.3", /RFC 1918/],
      ["100.64.0.1", /RFC 6598/],
      ["127.0.0.1", /RFC 1122/],
      ["169.254.1.1", /RFC 3927/],
      ["172.20.1.1", /RFC 1918/],
      ["192.0.2.5", /RFC 5737/],
      ["192.88.99.1", /RFC 7526/],
      ["192.168.1.1", /RFC 1918/],
      ["198.18.0.1", /RFC 2544/],
      ["198.51.100.7", /RFC 5737/],
      ["203.0.113.7", /RFC 5737/],
      ["239.1.1.1", /RFC 5771/],
      ["250.1.1.1", /RFC 1112/],
    ]
    for (const [address, pattern] of cases) {
      expect(nonPublicReason(toInt(address)), address).toMatch(pattern)
    }
    // and a handful that really are public
    for (const address of ["8.8.8.8", "1.1.1.1", "173.194.1.1", "192.30.252.1", "172.32.0.1"]) {
      expect(nonPublicReason(toInt(address)), address).toBeNull()
    }
  })

  it("round trips through the uint32 form", () => {
    for (const address of ["0.0.0.0", "255.255.255.255", "10.20.30.40"]) {
      expect(formatIPv4(toInt(address))).toBe(address)
    }
    expect(NON_PUBLIC_IPV4.length).toBeGreaterThan(10)
  })
})

describe("mac address bits follow IEEE Std 802", () => {
  // ieee std 802-2014 clause 8.2: bit 0 of the first octet is I/G, bit 1 is U/L
  it("sets and clears the right bit for each scope", () => {
    expect(applyMacScope(0xff, "unicast") & 0x01).toBe(0)
    expect(applyMacScope(0x00, "multicast") & 0x01).toBe(1)
    expect(applyMacScope(0xff, "universal") & 0x02).toBe(0)
    expect(applyMacScope(0x00, "local") & 0x02).toBe(2)
    const both = applyMacScope(0xff, "unicast-local")
    expect(both & 0x01).toBe(0)
    expect(both & 0x02).toBe(2)
    expect(applyMacScope(0xa5, "any")).toBe(0xa5)
  })

  it("touches nothing but the two low bits", () => {
    for (let octet = 0; octet < 256; octet++) {
      for (const scope of [
        "unicast",
        "multicast",
        "universal",
        "local",
        "unicast-local",
      ] as const) {
        expect(applyMacScope(octet, scope) & 0xfc, `${octet} ${scope}`).toBe(octet & 0xfc)
      }
    }
  })

  it("honours the scope across many generated addresses", () => {
    const base: MacOptions = { scope: "unicast", format: "none", uppercase: false }
    for (let i = 0; i < 2000; i++) {
      const first = parseInt(randomMac(base).slice(0, 2), 16)
      expect(first & 0x01).toBe(0)
      const local = parseInt(randomMac({ ...base, scope: "unicast-local" }).slice(0, 2), 16)
      expect(local & 0x03).toBe(0x02)
    }
  })

  it("formats all four notations from the same bytes", () => {
    const bytes = [0x0a, 0x1b, 0x2c, 0x3d, 0x4e, 0x5f]
    expect(formatMac(bytes, { format: "colon", uppercase: true })).toBe("0A:1B:2C:3D:4E:5F")
    expect(formatMac(bytes, { format: "dash", uppercase: false })).toBe("0a-1b-2c-3d-4e-5f")
    expect(formatMac(bytes, { format: "dot", uppercase: false })).toBe("0a1b.2c3d.4e5f")
    expect(formatMac(bytes, { format: "none", uppercase: true })).toBe("0A1B2C3D4E5F")
  })

  it("always emits six octets", () => {
    for (const format of ["colon", "dash", "dot", "none"] as const) {
      const mac = randomMac({ scope: "any", format, uppercase: false })
      expect(mac.replace(/[^0-9a-f]/g, "")).toHaveLength(12)
    }
  })
})

describe("ipv6 generation matches the addressing architecture", () => {
  it("keeps global unicast inside 2000::/3, not just 2000::/6", () => {
    const firstGroups = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      const first = parseInt(randomIPv6("global").split(":")[0], 16)
      expect(first).toBeGreaterThanOrEqual(0x2000)
      expect(first).toBeLessThanOrEqual(0x3fff)
      firstGroups.add(first)
    }
    // rfc 4291 2.5.4 defines 2000::/3; the old code only ever produced 2000::/6
    expect([...firstGroups].some((g) => g > 0x23ff)).toBe(true)
  })

  it("uses the locally-assigned half of the ULA block", () => {
    for (let i = 0; i < 2000; i++) {
      // rfc 4193: fc00::/7 with L=1 is fd00::/8
      expect(randomIPv6("ula")).toMatch(/^fd[0-9a-f]{2}:/)
    }
  })

  it("zeroes the 54 bits rfc 4291 2.5.6 requires after fe80", () => {
    for (let i = 0; i < 500; i++) {
      expect(randomIPv6("link-local")).toMatch(/^fe80:0000:0000:0000:/)
    }
  })

  it("stays inside the rfc 3849 documentation prefix", () => {
    expect(randomIPv6("documentation")).toMatch(/^2001:0db8:/)
  })

  it("always emits eight groups of four hex digits", () => {
    for (const kind of ["global", "ula", "link-local", "documentation"] as const) {
      const groups = randomIPv6(kind).split(":")
      expect(groups, kind).toHaveLength(8)
      for (const group of groups) expect(group).toMatch(/^[0-9a-f]{4}$/)
    }
  })
})
