import { describe, expect, it } from "vitest"
import { CIDR_TABLE, COMMON_CIDR_TABLE } from "@/lib/cidr-reference"
import { usableHostsFor } from "@/lib/mask-convert"
import { ipv4ToInt, netmaskToPrefix } from "@/lib/network-utils"

// every column has to agree with every other, so check all 33 rows, not the memorable three

describe("cidr reference table", () => {
  it("covers /0 through /32 exactly once", () => {
    expect(CIDR_TABLE.map((entry) => entry.prefix)).toEqual(
      Array.from({ length: 33 }, (_, index) => index)
    )
  })

  it.each(CIDR_TABLE.map((entry) => [entry.prefix, entry] as const))(
    "/%i is self-consistent",
    (prefix, entry) => {
      // the printed mask must round-trip back to the prefix it claims
      expect(netmaskToPrefix(entry.mask)).toBe(prefix)

      // mask and wildcard are exact complements
      expect(ipv4ToInt(entry.mask) + ipv4ToInt(entry.wildcard)).toBe(0xffffffff)

      expect(entry.totalAddresses).toBe(2 ** (32 - prefix))
      expect(entry.usableHosts).toBeLessThanOrEqual(entry.totalAddresses)
    }
  )

  it("counts usable hosts per rfc 3021 at the boundaries", () => {
    // rfc 3021: a /31 has 2 usable addresses on a point-to-point link
    expect(usableHostsFor(31)).toBe(2)
    // a /32 host route is one address, and it is usable
    expect(usableHostsFor(32)).toBe(1)
    // everything /30 and shorter loses the network and broadcast addresses
    expect(usableHostsFor(30)).toBe(2)
    expect(usableHostsFor(24)).toBe(254)
    expect(usableHostsFor(16)).toBe(65534)
    expect(usableHostsFor(8)).toBe(16777214)
    expect(usableHostsFor(0)).toBe(4294967294)
  })

  it("prints the masks a network engineer would recognise", () => {
    const byPrefix = new Map(CIDR_TABLE.map((entry) => [entry.prefix, entry]))
    expect(byPrefix.get(0)?.mask).toBe("0.0.0.0")
    expect(byPrefix.get(8)?.mask).toBe("255.0.0.0")
    expect(byPrefix.get(12)?.mask).toBe("255.240.0.0")
    expect(byPrefix.get(22)?.mask).toBe("255.255.252.0")
    expect(byPrefix.get(26)?.mask).toBe("255.255.255.192")
    expect(byPrefix.get(30)?.mask).toBe("255.255.255.252")
    expect(byPrefix.get(32)?.mask).toBe("255.255.255.255")
    expect(byPrefix.get(26)?.wildcard).toBe("0.0.0.63")
  })

  it("the common view is a subset of the full table", () => {
    for (const entry of COMMON_CIDR_TABLE) {
      expect(CIDR_TABLE).toContain(entry)
    }
    expect(COMMON_CIDR_TABLE.length).toBe(11)
  })
})
