import { describe, expect, it } from "vitest"
import { COMMON_SUBNETS } from "@/lib/reference/common-subnets"
import { IPV4_SPECIAL_RANGES } from "@/lib/reference/ipv4-ranges"
import { IPV6_SPECIAL_RANGES } from "@/lib/reference/ipv6-ranges"
import { COMMON_PORTS } from "@/lib/reference/ports"
import { IP_PROTOCOL_NUMBERS } from "@/lib/reference/protocol-numbers"
import { filterRows, matchesTerm } from "@/lib/reference/search"
import { SUBNET_MASKS, subnetMaskFor } from "@/lib/reference/subnet-masks"

// recomputed rather than counted: masks from prefix arithmetic, addresses from 2^(32-prefix)

function maskBits(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

function toDotted(bits: number): string {
  return [24, 16, 8, 0].map((shift) => (bits >>> shift) & 0xff).join(".")
}

function toInt(dotted: string): number {
  return dotted.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0)
}

describe("subnet mask table", () => {
  it("covers every prefix length exactly once", () => {
    const prefixes = SUBNET_MASKS.map((entry) => entry.prefix)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    expect([...prefixes].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 33 }, (_, index) => index)
    )
  })

  it("matches prefix arithmetic for mask, wildcard and usable hosts", () => {
    for (const entry of SUBNET_MASKS) {
      const bits = maskBits(entry.prefix)
      expect(entry.mask, `/${entry.prefix} mask`).toBe(toDotted(bits))
      expect(entry.wildcard, `/${entry.prefix} wildcard`).toBe(toDotted(~bits >>> 0))

      // /32 is a host route and /31 is RFC 3021, so neither loses two addresses
      const expected =
        entry.prefix === 32 ? 1 : entry.prefix === 31 ? 2 : 2 ** (32 - entry.prefix) - 2
      expect(entry.usableHosts, `/${entry.prefix} usable hosts`).toBe(expected)
    }
  })

  it("resolves a mask for every common subnet size", () => {
    const prefixes = COMMON_SUBNETS.map((subnet) => subnet.prefix)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    for (const subnet of COMMON_SUBNETS) {
      expect(subnetMaskFor(subnet.prefix), `/${subnet.prefix}`).toBeDefined()
      expect(subnet.name.length).toBeGreaterThan(0)
      expect(subnet.useCase.length).toBeGreaterThan(0)
    }
  })
})

describe("port table", () => {
  it("lists each port once, in range", () => {
    const ports = COMMON_PORTS.map((entry) => entry.port)
    expect(new Set(ports).size, "duplicate port numbers").toBe(ports.length)
    for (const port of ports) {
      expect(port, `${port} out of range`).toBeGreaterThanOrEqual(1)
      expect(port, `${port} out of range`).toBeLessThanOrEqual(65535)
    }
  })

  it("carries a registered iana service name and a transport for every row", () => {
    for (const entry of COMMON_PORTS) {
      // registry service names are lowercase, digits and hyphens only
      expect(entry.ianaName, `${entry.port} iana name`).toMatch(/^[a-z0-9-]+$/)
      expect(["TCP", "UDP", "TCP/UDP"]).toContain(entry.protocol)
      expect(entry.service.length, `${entry.port} service`).toBeGreaterThan(0)
      expect(entry.description.length, `${entry.port} description`).toBeGreaterThan(0)
    }
  })

  it("keeps the rows that used to be wrong pinned to the registry", () => {
    const byPort = new Map(COMMON_PORTS.map((entry) => [entry.port, entry]))
    // RFC 8314 re-registered 465 as submissions; it is not a deprecated port
    expect(byPort.get(465)?.ianaName).toBe("submissions")
    expect(byPort.get(465)?.description).not.toMatch(/deprecated/i)
    // 1521 and 8443 are conventions, not assignments
    expect(byPort.get(1521)?.ianaName).toBe("ncube-lm")
    expect(byPort.get(8443)?.ianaName).toBe("pcsync-https")
    // 514/tcp is shell, so syslog is the udp row
    expect(byPort.get(514)?.protocol).toBe("UDP")
  })
})

describe("ipv4 special ranges", () => {
  it("agrees with its own prefix on size and alignment", () => {
    for (const entry of IPV4_SPECIAL_RANGES) {
      const [base, prefixText] = entry.range.split("/")
      expect(Number(prefixText), `${entry.range} prefix field`).toBe(entry.prefix)
      expect(base).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/)
      expect(entry.addresses, `${entry.range} address count`).toBe(2 ** (32 - entry.prefix))
      // a range must start on its own boundary
      expect((toInt(base) & maskBits(entry.prefix)) >>> 0, `${entry.range} is not aligned`).toBe(
        toInt(base)
      )
      expect(entry.rfc).toMatch(/^RFC \d+$/)
    }
  })

  it("names each range once", () => {
    const ranges = IPV4_SPECIAL_RANGES.map((entry) => entry.range)
    expect(new Set(ranges).size).toBe(ranges.length)
  })

  it("does not resurrect classful labels for the rfc 1918 blocks", () => {
    const privateBlocks = IPV4_SPECIAL_RANGES.filter((entry) => entry.rfc === "RFC 1918")
    expect(privateBlocks.map((entry) => entry.range)).toEqual([
      "10.0.0.0/8",
      "172.16.0.0/12",
      "192.168.0.0/16",
    ])
    for (const entry of privateBlocks) {
      expect(entry.type, `${entry.range} type`).not.toMatch(/class/i)
    }
  })
})

describe("ipv6 special ranges", () => {
  it("uses well formed prefixes and cites an rfc", () => {
    for (const entry of IPV6_SPECIAL_RANGES) {
      const [base, prefixText] = entry.range.split("/")
      expect(base, `${entry.range} base`).toMatch(/^[0-9a-f:]+$/)
      const prefix = Number(prefixText)
      expect(prefix, `${entry.range} prefix`).toBeGreaterThanOrEqual(0)
      expect(prefix, `${entry.range} prefix`).toBeLessThanOrEqual(128)
      expect(["Yes", "No", "Varies"]).toContain(entry.routable)
      expect(entry.rfc).toMatch(/^RFC \d+$/)
    }
  })

  it("names each prefix once", () => {
    const ranges = IPV6_SPECIAL_RANGES.map((entry) => entry.range)
    expect(new Set(ranges).size).toBe(ranges.length)
  })
})

describe("ip protocol numbers", () => {
  it("stays inside the 8-bit field and lists each number once", () => {
    const numbers = IP_PROTOCOL_NUMBERS.map((entry) => entry.number)
    expect(new Set(numbers).size, "duplicate protocol numbers").toBe(numbers.length)
    for (const entry of IP_PROTOCOL_NUMBERS) {
      expect(entry.number).toBeGreaterThanOrEqual(0)
      expect(entry.number).toBeLessThanOrEqual(255)
      expect(entry.name).toMatch(/^[A-Za-z0-9-]+$/)
      expect(entry.rfc).toMatch(/^RFC \d+$/)
    }
  })

  it("cites the current rfc, not an obsoleted one", () => {
    const byNumber = new Map(IP_PROTOCOL_NUMBERS.map((entry) => [entry.number, entry]))
    expect(byNumber.get(6)?.rfc).toBe("RFC 9293") // obsoletes RFC 793
    expect(byNumber.get(112)?.rfc).toBe("RFC 9568") // obsoletes RFC 5798
    expect(byNumber.get(132)?.rfc).toBe("RFC 9260") // obsoletes RFC 4960
  })
})

describe("reference search", () => {
  it("treats an empty term as no filter", () => {
    expect(matchesTerm(["anything"], "   ")).toBe(true)
    expect(filterRows(COMMON_PORTS, "", (row) => [row.service])).toHaveLength(COMMON_PORTS.length)
  })

  it("matches case insensitively on any supplied field", () => {
    const rows = filterRows(COMMON_PORTS, "SUBMISSIONS", (row) => [
      String(row.port),
      row.service,
      row.ianaName,
    ])
    expect(rows.map((row) => row.port)).toEqual([465])
  })

  it("matches a port number typed as text", () => {
    const rows = filterRows(COMMON_PORTS, "3389", (row) => [String(row.port), row.service])
    expect(rows.map((row) => row.service)).toEqual(["RDP"])
  })

  it("returns nothing when a term matches no field", () => {
    expect(filterRows(SUBNET_MASKS, "not-a-mask", (row) => [row.mask])).toEqual([])
  })
})
