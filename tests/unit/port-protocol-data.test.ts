import { describe, expect, it } from "vitest"
import { ICMP_TYPES, ICMP_UNREACHABLE_CODES } from "@/lib/reference/icmp"
import { IP_PROTOCOL_NUMBERS } from "@/lib/reference/protocol-numbers"
import {
  CATEGORIZED_PORTS,
  isValidPort,
  PORT_CATEGORY_LABELS,
  PORT_RANGES,
  rangeOf,
  transportsOf,
} from "@/lib/reference/service-ports"

// internal consistency is what a test can prove offline; the iana citations are in the data modules

describe("service port table", () => {
  it("keeps every port inside the 16-bit port space", () => {
    for (const entry of CATEGORIZED_PORTS) {
      expect(isValidPort(entry.port), `${entry.service}`).toBe(true)
      expect(entry.port).toBeGreaterThanOrEqual(0)
      expect(entry.port).toBeLessThanOrEqual(65535)
    }
  })

  it("carries no duplicate port and transport pair", () => {
    const seen = new Map<string, string>()
    for (const entry of CATEGORIZED_PORTS) {
      for (const transport of transportsOf(entry.protocol)) {
        const key = `${entry.port}/${transport}`
        const previous = seen.get(key)
        expect(previous, `${key} claimed by both ${previous} and ${entry.service}`).toBeUndefined()
        seen.set(key, entry.service)
      }
    }
  })

  it("distinguishes TCP from UDP rather than lumping them together", () => {
    const protocols = new Set(CATEGORIZED_PORTS.map((entry) => entry.protocol))
    expect(protocols.has("TCP")).toBe(true)
    expect(protocols.has("UDP")).toBe(true)
    for (const entry of CATEGORIZED_PORTS) {
      expect(["TCP", "UDP", "TCP/UDP"], `${entry.port}`).toContain(entry.protocol)
    }
    // the ports that genuinely serve both, and only those, are marked TCP/UDP
    const both = CATEGORIZED_PORTS.filter((entry) => entry.protocol === "TCP/UDP").map(
      (entry) => entry.port
    )
    expect(both).toContain(53) // dns: udp queries, tcp for large answers and axfr
    expect(both).not.toContain(514) // 514/tcp is shell (rsh), not syslog
    expect(both).not.toContain(123) // ntp is udp
  })

  it("marks the well known single-transport services correctly", () => {
    const find = (port: number) => CATEGORIZED_PORTS.find((entry) => entry.port === port)
    expect(find(514)?.protocol).toBe("UDP") // rfc 5426
    expect(find(69)?.protocol).toBe("UDP") // tftp
    expect(find(67)?.protocol).toBe("UDP") // bootps
    expect(find(68)?.protocol).toBe("UDP") // bootpc
    expect(find(443)?.protocol).toBe("TCP")
    expect(find(51820)?.protocol).toBe("UDP") // wireguard
  })

  it("names the registered IANA service for every row, including the awkward ones", () => {
    const ianaFor = (port: number) =>
      CATEGORIZED_PORTS.find((entry) => entry.port === port)?.ianaName

    for (const entry of CATEGORIZED_PORTS) {
      expect(entry.ianaName.length, `${entry.port} has no IANA name`).toBeGreaterThan(0)
    }

    // presenting the colloquial name as an IANA assignment is what "fabricated data" looks like
    expect(ianaFor(8443)).toBe("pcsync-https")
    expect(ianaFor(1521)).toBe("ncube-lm")
    expect(ianaFor(6443)).toBe("sun-sr-https")
    expect(ianaFor(9090)).toBe("websm")
    expect(ianaFor(3000)).toBe("hbci")
    expect(ianaFor(445)).toBe("microsoft-ds")
    expect(ianaFor(3389)).toBe("ms-wbt-server")
    expect(ianaFor(5900)).toBe("rfb")
    expect(ianaFor(500)).toBe("isakmp")
    expect(ianaFor(67)).toBe("bootps")
    expect(ianaFor(68)).toBe("bootpc")
    expect(ianaFor(465)).toBe("submissions")
  })

  it("does not claim an IANA assignment for 51820, which sits in the dynamic range", () => {
    const wireguard = CATEGORIZED_PORTS.find((entry) => entry.port === 51820)!
    expect(wireguard.ianaName).toBe("unassigned")
    expect(rangeOf(51820)?.name).toBe("Dynamic Ports")
    expect(wireguard.description).toMatch(/convention/i)
  })

  it("does not describe port 465 as deprecated, because RFC 8314 restored it", () => {
    const submissions = CATEGORIZED_PORTS.find((entry) => entry.port === 465)!
    expect(submissions.description).not.toMatch(/deprecated/i)
    expect(submissions.description).toMatch(/8314/)
  })

  it("gives every row a known category", () => {
    for (const entry of CATEGORIZED_PORTS) {
      expect(Object.keys(PORT_CATEGORY_LABELS), `${entry.port}`).toContain(entry.category)
    }
  })

  it("uses every category it advertises", () => {
    const used = new Set(CATEGORIZED_PORTS.map((entry) => entry.category))
    for (const category of Object.keys(PORT_CATEGORY_LABELS)) {
      expect(used.has(category as never), `${category} has no ports`).toBe(true)
    }
  })

  it("sorts ascending so the rendered table needs no sort of its own", () => {
    const ports = CATEGORIZED_PORTS.map((entry) => entry.port)
    expect(ports).toEqual([...ports].sort((a, b) => a - b))
  })
})

describe("port ranges (RFC 6335 section 6)", () => {
  it("partitions the whole port space with no gap or overlap", () => {
    expect(PORT_RANGES[0].start).toBe(0)
    expect(PORT_RANGES.at(-1)!.end).toBe(65535)
    for (let index = 1; index < PORT_RANGES.length; index++) {
      expect(PORT_RANGES[index].start).toBe(PORT_RANGES[index - 1].end + 1)
    }
  })

  it("uses the RFC 6335 boundaries", () => {
    expect(rangeOf(0)?.name).toBe("System Ports")
    expect(rangeOf(1023)?.name).toBe("System Ports")
    expect(rangeOf(1024)?.name).toBe("User Ports")
    expect(rangeOf(49151)?.name).toBe("User Ports")
    expect(rangeOf(49152)?.name).toBe("Dynamic Ports")
    expect(rangeOf(65535)?.name).toBe("Dynamic Ports")
  })
})

describe("IP protocol numbers", () => {
  it("keeps numbers unique and inside the 8-bit field", () => {
    const numbers = IP_PROTOCOL_NUMBERS.map((entry) => entry.number)
    expect(new Set(numbers).size).toBe(numbers.length)
    for (const number of numbers) {
      expect(number).toBeGreaterThanOrEqual(0)
      expect(number).toBeLessThanOrEqual(255)
    }
  })

  it("cites the current defining RFC, not an obsoleted one", () => {
    const rfcFor = (number: number) =>
      IP_PROTOCOL_NUMBERS.find((entry) => entry.number === number)?.rfc
    expect(rfcFor(6)).toBe("RFC 9293") // obsoletes rfc 793
    expect(rfcFor(112)).toBe("RFC 9568") // obsoletes rfc 5798
    expect(rfcFor(132)).toBe("RFC 9260") // obsoletes rfc 4960
    expect(rfcFor(88)).toBe("RFC 7868") // eigrp, informational
  })

  it("uses the IANA keyword rather than the colloquial name", () => {
    const nameFor = (number: number) =>
      IP_PROTOCOL_NUMBERS.find((entry) => entry.number === number)?.name
    expect(nameFor(4)).toBe("IPv4") // not "IP-in-IP"
    expect(nameFor(58)).toBe("IPv6-ICMP") // not "ICMPv6"
    expect(nameFor(89)).toBe("OSPFIGP") // not "OSPF"
    expect(nameFor(88)).toBe("EIGRP")
  })

  it("marks the IPv6 extension headers", () => {
    const extensions = IP_PROTOCOL_NUMBERS.filter((entry) => entry.ipv6ExtensionHeader).map(
      (entry) => entry.number
    )
    for (const number of [43, 44, 60]) {
      expect(extensions, `${number} should be an extension header`).toContain(number)
    }
    expect(extensions).not.toContain(6)
    expect(extensions).not.toContain(17)
  })
})

describe("ICMP types", () => {
  it("keeps types unique and inside the 8-bit field", () => {
    const types = ICMP_TYPES.map((entry) => entry.type)
    expect(new Set(types).size).toBe(types.length)
    for (const type of types) {
      expect(type).toBeGreaterThanOrEqual(0)
      expect(type).toBeLessThanOrEqual(255)
    }
  })

  it("uses the registry's own wording where it differs from common usage", () => {
    const entry = (type: number) => ICMP_TYPES.find((row) => row.type === type)!
    expect(entry(8).name).toBe("Echo")
    expect(entry(8).commonName).toBe("Echo Request")
    expect(entry(13).name).toBe("Timestamp")
    expect(entry(13).commonName).toBe("Timestamp Request")
  })

  it("marks the deprecated types and cites the RFC that deprecated them", () => {
    const deprecated = ICMP_TYPES.filter((entry) => entry.deprecated)
    expect(deprecated.map((entry) => entry.type)).toEqual([4, 30])
    expect(ICMP_TYPES.find((entry) => entry.type === 4)!.rfc).toBe("RFC 6633")
    expect(ICMP_TYPES.find((entry) => entry.type === 30)!.rfc).toBe("RFC 6918")
    for (const entry of deprecated) {
      expect(entry.name, `${entry.type}`).toMatch(/\(Deprecated\)/)
    }
  })

  it("cites RFC 1256 for router discovery rather than RFC 792", () => {
    expect(ICMP_TYPES.find((entry) => entry.type === 9)!.rfc).toBe("RFC 1256")
    expect(ICMP_TYPES.find((entry) => entry.type === 10)!.rfc).toBe("RFC 1256")
  })

  it("includes the extended echo pair added by RFC 8335", () => {
    for (const type of [42, 43]) {
      expect(ICMP_TYPES.find((entry) => entry.type === type)?.rfc, `${type}`).toBe("RFC 8335")
    }
  })
})

describe("ICMP destination unreachable codes", () => {
  it("covers 0 to 15 with no gap", () => {
    const codes = ICMP_UNREACHABLE_CODES.map((entry) => entry.code)
    expect(codes).toEqual(Array.from({ length: 16 }, (_, index) => index))
  })

  it("uses the registry wording for the codes that are easy to paraphrase wrong", () => {
    const nameFor = (code: number) =>
      ICMP_UNREACHABLE_CODES.find((entry) => entry.code === code)!.name
    expect(nameFor(0)).toBe("Net Unreachable")
    expect(nameFor(4)).toBe("Fragmentation Needed and Don't Fragment was Set")
    expect(nameFor(9)).toBe("Communication with Destination Network is Administratively Prohibited")
    expect(nameFor(13)).toBe("Communication Administratively Prohibited")
  })

  it("cites RFC 1191 on code 4, the code that carries the next-hop MTU", () => {
    expect(ICMP_UNREACHABLE_CODES.find((entry) => entry.code === 4)!.rfc).toMatch(/1191/)
  })

  it("attributes the RFC 1812 codes to RFC 1812", () => {
    for (const code of [13, 14, 15]) {
      expect(ICMP_UNREACHABLE_CODES.find((entry) => entry.code === code)!.rfc, `${code}`).toBe(
        "RFC 1812"
      )
    }
  })
})
