import { describe, expect, it } from "vitest"
import {
  calculateIPv4Subnet,
  calculateIPv6Subnet,
  compressIPv6,
  expandIPv6,
  intToIpv4,
  ipv4ToInt,
  isValidCIDR,
  isValidIPv4,
  isValidIPv6,
  netmaskToPrefix,
  prefixToNetmask,
  solicitedNodeMulticast,
  splitIPv6Zone,
  summarizeCIDRs,
} from "@/lib/network-utils"

describe("ipv4ToInt", () => {
  it("round-trips with intToIpv4", () => {
    expect(intToIpv4(ipv4ToInt("192.168.1.1"))).toBe("192.168.1.1")
    expect(intToIpv4(ipv4ToInt("0.0.0.0"))).toBe("0.0.0.0")
    expect(intToIpv4(ipv4ToInt("255.255.255.255"))).toBe("255.255.255.255")
  })

  it("returns unsigned values for high addresses", () => {
    expect(ipv4ToInt("255.255.255.255")).toBe(0xffffffff)
    expect(ipv4ToInt("128.0.0.0")).toBeGreaterThan(0)
  })

  it("rejects garbage that Number() silently coerces", () => {
    expect(() => ipv4ToInt("a.b.c.d")).toThrow()
    expect(() => ipv4ToInt("1.2.3.")).toThrow()
    expect(() => ipv4ToInt("1.5.2.3.4")).toThrow()
    expect(() => ipv4ToInt("1.2.3")).toThrow()
    expect(() => ipv4ToInt("1.2.3.256")).toThrow()
    expect(() => ipv4ToInt("1.2.-3.4")).toThrow()
    expect(() => ipv4ToInt("1.2.3.4.5")).toThrow()
    expect(() => ipv4ToInt("1.5.3.2 ")).toThrow()
  })

  it("rejects fractional octets", () => {
    expect(() => ipv4ToInt("1.5.2.3")).not.toThrow()
    expect(() => ipv4ToInt("1.5.5.2.3")).toThrow()
  })
})

describe("prefixToNetmask", () => {
  it("rejects a fractional prefix instead of silently rounding it", () => {
    // js coerces the shift count to int32, so 32 - 24.5 shifted by 7 and a /24 came back a /25
    for (const p of [24.5, 24.9, 23.1, 0.5]) {
      expect(() => prefixToNetmask(p), `prefix ${p}`).toThrow(/must be 0-32/)
    }
  })

  it("handles the full prefix range including /0", () => {
    // /0 regression: js shifts are mod 32, the old code returned /32's mask
    expect(prefixToNetmask(0)).toBe("0.0.0.0")
    expect(prefixToNetmask(1)).toBe("128.0.0.0")
    expect(prefixToNetmask(8)).toBe("255.0.0.0")
    expect(prefixToNetmask(24)).toBe("255.255.255.0")
    expect(prefixToNetmask(31)).toBe("255.255.255.254")
    expect(prefixToNetmask(32)).toBe("255.255.255.255")
  })
})

describe("netmaskToPrefix", () => {
  it("inverts prefixToNetmask", () => {
    for (const p of [0, 1, 8, 16, 24, 25, 31, 32]) {
      expect(netmaskToPrefix(prefixToNetmask(p))).toBe(p)
    }
  })

  it("rejects non-contiguous masks", () => {
    expect(() => netmaskToPrefix("255.0.255.0")).toThrow()
  })
})

describe("calculateIPv4Subnet", () => {
  it("computes a standard /24", () => {
    const r = calculateIPv4Subnet("192.168.1.130", 24)
    expect(r.network).toBe("192.168.1.0")
    expect(r.broadcast).toBe("192.168.1.255")
    expect(r.firstHost).toBe("192.168.1.1")
    expect(r.lastHost).toBe("192.168.1.254")
    expect(r.hostCount).toBe(254)
    expect(r.wildcardMask).toBe("0.0.0.255")
    expect(r.isPrivate).toBe(true)
  })

  it("handles /31 per rfc 3021", () => {
    const r = calculateIPv4Subnet("10.0.0.1", 31)
    expect(r.firstHost).toBe("10.0.0.0")
    expect(r.lastHost).toBe("10.0.0.1")
    expect(r.hostCount).toBe(2)
  })

  it("handles /32 as a single host", () => {
    const r = calculateIPv4Subnet("10.0.0.1", 32)
    expect(r.hostCount).toBe(1)
    expect(r.firstHost).toBe("10.0.0.1")
  })

  it("handles /0 as the whole address space", () => {
    const r = calculateIPv4Subnet("1.2.3.4", 0)
    expect(r.network).toBe("0.0.0.0")
    expect(r.broadcast).toBe("255.255.255.255")
    expect(r.netmask).toBe("0.0.0.0")
    expect(r.wildcardMask).toBe("255.255.255.255")
  })

  it("classifies from the host address, not the network address", () => {
    // 192.168.1.5/8 has network 192.0.0.0 which is not rfc1918; the host is
    expect(calculateIPv4Subnet("192.168.1.5", 8).isPrivate).toBe(true)
    expect(calculateIPv4Subnet("8.8.8.8", 24).isPrivate).toBe(false)
    expect(calculateIPv4Subnet("172.16.0.1", 12).isPrivate).toBe(true)
    expect(calculateIPv4Subnet("172.32.0.1", 12).isPrivate).toBe(false)
    expect(calculateIPv4Subnet("127.0.0.1", 8).isLoopback).toBe(true)
    expect(calculateIPv4Subnet("169.254.1.1", 16).isLinkLocal).toBe(true)
    expect(calculateIPv4Subnet("224.0.0.1", 24).isMulticast).toBe(true)
  })
})

describe("summarizeCIDRs", () => {
  it("returns a single block unchanged", () => {
    expect(summarizeCIDRs(["192.168.0.0/24"])).toEqual(["192.168.0.0/24"])
    expect(summarizeCIDRs(["10.0.0.1/32"])).toEqual(["10.0.0.1/32"])
  })

  it("merges two adjacent /24s into a /23", () => {
    expect(summarizeCIDRs(["10.0.0.0/24", "10.0.1.0/24"])).toEqual(["10.0.0.0/23"])
  })

  it("merges four aligned /24s into a /22", () => {
    expect(summarizeCIDRs(["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"])).toEqual([
      "10.0.0.0/22",
    ])
  })

  it("does not merge non-adjacent blocks", () => {
    expect(summarizeCIDRs(["10.0.0.0/24", "10.0.2.0/24"])).toEqual(["10.0.0.0/24", "10.0.2.0/24"])
  })

  it("emits aligned sub-blocks when a merge is not power-of-two aligned", () => {
    // /24 + /24 starting at .1.0 and .2.0 merge into a range needing two cidrs
    expect(summarizeCIDRs(["10.0.1.0/24", "10.0.2.0/24"])).toEqual(["10.0.1.0/24", "10.0.2.0/24"])
    // three consecutive /24s: best cover is /23 + /24
    expect(summarizeCIDRs(["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24"])).toEqual([
      "10.0.0.0/23",
      "10.0.2.0/24",
    ])
  })

  it("absorbs contained blocks", () => {
    expect(summarizeCIDRs(["10.0.0.0/16", "10.0.5.0/24"])).toEqual(["10.0.0.0/16"])
  })

  it("never emits a prefix beyond /32", () => {
    for (const out of summarizeCIDRs(["1.1.1.1/32", "9.9.9.9/32"])) {
      const prefix = Number(out.split("/")[1])
      expect(prefix).toBeGreaterThanOrEqual(0)
      expect(prefix).toBeLessThanOrEqual(32)
    }
  })
})

describe("expandIPv6 / compressIPv6 (rfc 5952)", () => {
  it("expands and compresses round-trip", () => {
    expect(expandIPv6("2001:db8::1")).toBe("2001:0db8:0000:0000:0000:0000:0000:0001")
    expect(compressIPv6("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1")
  })

  it("compresses the leftmost longest zero run on ties", () => {
    expect(compressIPv6("2001:db8:0:0:1:0:0:1")).toBe("2001:db8::1:0:0:1")
    expect(compressIPv6("2001:0:0:1:0:0:0:1")).toBe("2001:0:0:1::1")
  })

  it("never compresses a single zero group", () => {
    expect(compressIPv6("2001:db8:1:0:1:1:1:1")).toBe("2001:db8:1:0:1:1:1:1")
  })

  it("handles the unspecified and loopback addresses", () => {
    expect(compressIPv6("0:0:0:0:0:0:0:0")).toBe("::")
    expect(compressIPv6("0:0:0:0:0:0:0:1")).toBe("::1")
  })

  it("supports rfc 4291 ipv4-embedded addresses", () => {
    expect(expandIPv6("::ffff:192.168.1.1")).toBe("0000:0000:0000:0000:0000:ffff:c0a8:0101")
    expect(isValidIPv6("::ffff:192.168.1.1")).toBe(true)
  })

  it("keeps the dotted quad for ipv4-mapped addresses (rfc 5952 5)", () => {
    expect(compressIPv6("::ffff:192.168.1.1")).toBe("::ffff:192.168.1.1")
    expect(compressIPv6("0:0:0:0:0:ffff:c0a8:0101")).toBe("::ffff:192.168.1.1")
    expect(compressIPv6("::ffff:192.0.2.33")).toBe("::ffff:192.0.2.33")
    // low groups of 0 still render as an address, not as an empty tail
    expect(compressIPv6("::ffff:0.0.0.0")).toBe("::ffff:0.0.0.0")
    expect(compressIPv6("::ffff:192.168.1.1%eth0")).toBe("::ffff:192.168.1.1%eth0")
  })

  it("applies the dotted quad only to ::ffff:0:0/96", () => {
    // ::/96 is the deprecated ipv4-compatible block and holds :: and ::1, so section 5 stops short
    expect(compressIPv6("::1")).toBe("::1")
    expect(compressIPv6("::")).toBe("::")
    expect(compressIPv6("::c0a8:101")).toBe("::c0a8:101")
    // rfc 6052 nat64 is represented in hex, not dotted quad
    expect(compressIPv6("64:ff9b::192.0.2.33")).toBe("64:ff9b::c000:221")
    // a mapped-looking suffix under a real prefix is untouched
    expect(compressIPv6("2001:db8::ffff:c0a8:101")).toBe("2001:db8::ffff:c0a8:101")
  })

  it("lowercases hex per rfc 5952 4.3", () => {
    expect(compressIPv6("2001:DB8::1")).toBe("2001:db8::1")
    expect(compressIPv6("FE80:0:0:0:0:0:0:ABCD")).toBe("fe80::abcd")
    expect(compressIPv6("2001:DB8:1:2:3:4:5:6")).toBe("2001:db8:1:2:3:4:5:6")
    expect(expandIPv6("2001:DB8::1")).toBe("2001:0db8:0000:0000:0000:0000:0000:0001")
  })

  it("throws a clear error instead of RangeError past 8 groups", () => {
    // 8 - left - right went negative and hit `new Array(-1)`
    expect(() => expandIPv6("1:2:3:4:5:6:7:8:9::")).toThrow("more than 8 groups")
    expect(() => expandIPv6("1:2:3:4:5:6:7:8:9")).toThrow("more than 8 groups")
    expect(isValidIPv6("1:2:3:4:5:6:7:8:9::")).toBe(false)
    expect(isValidIPv6("1:2:3:4:5:6:7:8:9")).toBe(false)
  })
})

describe("ipv6 zone ids (rfc 4007)", () => {
  it("splits a zone off the address", () => {
    expect(splitIPv6Zone("fe80::1%eth0")).toEqual({ address: "fe80::1", zone: "eth0" })
    expect(splitIPv6Zone("2001:db8::1")).toEqual({ address: "2001:db8::1" })
  })

  it("accepts a scoped address and preserves the zone through expand/compress", () => {
    expect(isValidIPv6("fe80::1%eth0")).toBe(true)
    expect(isValidIPv6("fe80::1%3")).toBe(true)
    expect(expandIPv6("fe80::1%eth0")).toBe("fe80:0000:0000:0000:0000:0000:0000:0001%eth0")
    expect(compressIPv6("fe80:0000:0000:0000:0000:0000:0000:0001%eth0")).toBe("fe80::1%eth0")
  })

  it("rejects an empty or malformed zone", () => {
    expect(isValidIPv6("fe80::1%")).toBe(false)
    expect(isValidIPv6("fe80::1%eth 0")).toBe(false)
  })

  it("keeps zone ids out of cidr prefixes", () => {
    // a zone scopes one interface address, never a prefix
    expect(isValidCIDR("fe80::1%eth0/64")).toBe(false)
    expect(isValidCIDR("fe80::1/64")).toBe(true)
  })

  it("reports the zone on subnet results", () => {
    const r = calculateIPv6Subnet("fe80::1%eth0", 64)
    expect(r.zone).toBe("eth0")
    expect(r.expanded).toBe("fe80:0000:0000:0000:0000:0000:0000:0001")
    expect(r.isLinkLocal).toBe(true)
  })
})

describe("solicitedNodeMulticast", () => {
  it("takes the low 24 bits of the interface identifier", () => {
    expect(solicitedNodeMulticast("2001:db8::1:ff:fe00:1234")).toBe("ff02::1:ff00:1234")
    expect(solicitedNodeMulticast("2001:db8::a1b2:c3d4")).toBe("ff02::1:ffb2:c3d4")
  })

  it("pads unexpanded groups instead of mis-slicing them", () => {
    // the copy in network-testing.ts sliced the raw text and produced "ff02::1:ff:f1" here
    expect(solicitedNodeMulticast("fe80:0:0:0:0:0:f:1")).toBe("ff02::1:ff0f:1")
  })

  it("writes the last group without leading zeros (rfc 5952 4.1)", () => {
    expect(solicitedNodeMulticast("2001:db8::1")).toBe("ff02::1:ff00:1")
    // 4.2.2: a single zero group is written "0", never compressed to ::
    expect(solicitedNodeMulticast("2001:db8::")).toBe("ff02::1:ff00:0")
  })

  it("ignores a zone id", () => {
    expect(solicitedNodeMulticast("fe80::1%eth0")).toBe("ff02::1:ff00:1")
  })
})

describe("calculateIPv6Subnet", () => {
  it("zeroes host bits for the network", () => {
    const r = calculateIPv6Subnet("2001:db8:abcd:1234::42", 48)
    expect(r.compressed).toBe("2001:db8:abcd::")
    expect(r.hostBits).toBe(80)
  })

  it("computes solicited-node multicast from the low 24 bits", () => {
    const r = calculateIPv6Subnet("2001:db8::1:ff:fe00:1234", 64)
    expect(r.solicitedNode).toBe("ff02::1:ff00:1234")
  })

  it("treats all of fe80::/10 as link-local, agreeing with isPrivate", () => {
    // isLinkLocal tested == 0xfe80 (a /16) while isPrivate masked /10, so fe90::1 came back private
    for (const ip of ["fe80::1", "fe90::1", "feaf::1", "febf::1"]) {
      const r = calculateIPv6Subnet(ip, 64)
      expect({ ip, isLinkLocal: r.isLinkLocal, isPrivate: r.isPrivate }).toEqual({
        ip,
        isLinkLocal: true,
        isPrivate: true,
      })
    }

    const outside = calculateIPv6Subnet("fec0::1", 64)
    expect(outside.isLinkLocal).toBe(false)
    expect(outside.isPrivate).toBe(false)

    // unique-local stays private but is not link-local
    const ula = calculateIPv6Subnet("fd00::1", 64)
    expect(ula.isPrivate).toBe(true)
    expect(ula.isLinkLocal).toBe(false)
  })
})

describe("validators", () => {
  it("isValidIPv4 accepts real addresses and rejects junk", () => {
    expect(isValidIPv4("10.0.0.1")).toBe(true)
    expect(isValidIPv4("255.255.255.255")).toBe(true)
    expect(isValidIPv4("256.1.1.1")).toBe(false)
    expect(isValidIPv4("1.2.3")).toBe(false)
    expect(isValidIPv4("01.2.3.4")).toBe(false)
    expect(isValidIPv4("999.999.999.999")).toBe(false)
  })

  it("isValidCIDR bounds the prefix per family", () => {
    expect(isValidCIDR("10.0.0.0/24")).toBe(true)
    expect(isValidCIDR("10.0.0.0/33")).toBe(false)
    expect(isValidCIDR("2001:db8::/64")).toBe(true)
    expect(isValidCIDR("2001:db8::/129")).toBe(false)
  })

  it("isValidCIDR rejects prefixes that bare parseInt accepted", () => {
    expect(isValidCIDR("10.0.0.0/24abc")).toBe(false)
    expect(isValidCIDR("10.0.0.0/+24")).toBe(false)
    expect(isValidCIDR("10.0.0.0/ 24")).toBe(false)
    expect(isValidCIDR("10.0.0.0/")).toBe(false)
    expect(isValidCIDR("/24")).toBe(false)
    expect(isValidCIDR("/+24")).toBe(false)
    expect(isValidCIDR("10.0.0.0/0")).toBe(true)
  })

  it("ipv4ToInt and isValidIPv4 share one notion of validity", () => {
    // "010" is ambiguously octal, so both reject leading-zero octets
    for (const ip of ["010.1.1.1", "1.01.1.1", "00.0.0.0", "1.2.3.0256"]) {
      expect(isValidIPv4(ip)).toBe(false)
      expect(() => ipv4ToInt(ip)).toThrow("Invalid IPv4 address")
    }

    for (const ip of ["0.0.0.0", "10.0.0.1", "255.255.255.255"]) {
      expect(isValidIPv4(ip)).toBe(true)
      expect(() => ipv4ToInt(ip)).not.toThrow()
    }
  })

  it("isValidIPv6 rejects dangling colons that padStart used to hide", () => {
    expect(isValidIPv6("1:2:3:4:5:6:7:")).toBe(false)
    expect(isValidIPv6(":1:2:3:4:5:6:7")).toBe(false)
    expect(isValidIPv6("2001:db8::")).toBe(true)
    expect(isValidIPv6("::1")).toBe(true)
  })
})
