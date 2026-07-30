import { intToIpv4, ipv4ToInt } from "@/lib/network-utils"

export const IPV4_INPUT_FORMATS = ["dotted", "decimal", "binary", "hex", "octal"] as const
export type IPv4InputFormat = (typeof IPV4_INPUT_FORMATS)[number]

export const MAX_IPV4_INT = 4294967295

export interface IPv4Formats {
  dottedDecimal: string
  decimal: string
  binary: string
  hex: string
  octal: string
  ipv6Mapped: string
  ipv6Compatible: string
  ipClass: string
  scope: SpecialUseScope
}

export interface SpecialUseScope {
  name: string
  source: string
  routable: boolean
}

// rfc 6890 special-purpose address registry, most specific prefix first
const SPECIAL_USE: ReadonlyArray<{ cidr: string; scope: SpecialUseScope }> = [
  {
    cidr: "255.255.255.255/32",
    scope: { name: "Limited Broadcast", source: "RFC 919 / RFC 6890", routable: false },
  },
  { cidr: "0.0.0.0/8", scope: { name: "This Network", source: "RFC 1122", routable: false } },
  { cidr: "10.0.0.0/8", scope: { name: "Private", source: "RFC 1918", routable: false } },
  {
    cidr: "100.64.0.0/10",
    scope: { name: "Shared Address Space (CGNAT)", source: "RFC 6598", routable: false },
  },
  { cidr: "127.0.0.0/8", scope: { name: "Loopback", source: "RFC 1122", routable: false } },
  {
    cidr: "169.254.0.0/16",
    scope: { name: "Link-Local", source: "RFC 3927", routable: false },
  },
  { cidr: "172.16.0.0/12", scope: { name: "Private", source: "RFC 1918", routable: false } },
  {
    cidr: "192.0.0.0/24",
    scope: { name: "IETF Protocol Assignments", source: "RFC 6890", routable: false },
  },
  {
    cidr: "192.0.2.0/24",
    scope: { name: "Documentation (TEST-NET-1)", source: "RFC 5737", routable: false },
  },
  { cidr: "192.168.0.0/16", scope: { name: "Private", source: "RFC 1918", routable: false } },
  {
    cidr: "198.18.0.0/15",
    scope: { name: "Benchmarking", source: "RFC 2544", routable: false },
  },
  {
    cidr: "198.51.100.0/24",
    scope: { name: "Documentation (TEST-NET-2)", source: "RFC 5737", routable: false },
  },
  {
    cidr: "203.0.113.0/24",
    scope: { name: "Documentation (TEST-NET-3)", source: "RFC 5737", routable: false },
  },
  { cidr: "224.0.0.0/4", scope: { name: "Multicast", source: "RFC 5771", routable: false } },
  { cidr: "240.0.0.0/4", scope: { name: "Reserved", source: "RFC 1112", routable: false } },
]

const SPECIAL_USE_RANGES = SPECIAL_USE.map(({ cidr, scope }) => {
  const [address, prefixText] = cidr.split("/")
  const prefix = Number(prefixText)
  const base = ipv4ToInt(address)
  const size = 2 ** (32 - prefix)
  return { start: base, end: base + size - 1, scope, cidr }
})

const GLOBAL_UNICAST: SpecialUseScope = {
  name: "Globally Routable Unicast",
  source: "RFC 6890",
  routable: true,
}

export function specialUseScope(ipInt: number): SpecialUseScope {
  const match = SPECIAL_USE_RANGES.find((range) => ipInt >= range.start && ipInt <= range.end)
  return match ? match.scope : GLOBAL_UNICAST
}

// classful ranges per rfc 791; 0/8 and 127/8 were never assignable host classes
export function classfulName(firstOctet: number): string {
  if (firstOctet >= 1 && firstOctet <= 126) return "A"
  if (firstOctet === 127) return "A (reserved for loopback)"
  if (firstOctet >= 128 && firstOctet <= 191) return "B"
  if (firstOctet >= 192 && firstOctet <= 223) return "C"
  if (firstOctet >= 224 && firstOctet <= 239) return "D (Multicast)"
  if (firstOctet >= 240) return "E (Reserved)"
  return "Unspecified"
}

export function parseIPv4Input(input: string, format: IPv4InputFormat): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    switch (format) {
      case "dotted":
        return ipv4ToInt(trimmed)
      case "decimal": {
        // parseInt would accept "123abc" and silently return 123
        if (!/^\d+$/.test(trimmed)) return null
        const value = Number(trimmed)
        return value > MAX_IPV4_INT ? null : value
      }
      case "binary": {
        const clean = trimmed.replace(/[\s.]/g, "")
        if (!/^[01]{1,32}$/.test(clean)) return null
        return Number.parseInt(clean, 2)
      }
      case "hex": {
        const clean = trimmed.replace(/^0x/i, "").replace(/[\s:.]/g, "")
        if (!/^[0-9a-fA-F]{1,8}$/.test(clean)) return null
        return Number.parseInt(clean, 16)
      }
      case "octal": {
        const clean = trimmed.replace(/^0o/i, "")
        if (!/^[0-7]{1,11}$/.test(clean)) return null
        const value = Number.parseInt(clean, 8)
        return value > MAX_IPV4_INT ? null : value
      }
    }
  } catch {
    return null
  }
}

export function convertIPv4(ipInt: number): IPv4Formats {
  // every arithmetic path stays unsigned; `<<` would wrap 128.0.0.0 and above
  const unsigned = ipInt >>> 0
  const dottedDecimal = intToIpv4(unsigned)
  const octets = dottedDecimal.split(".").map(Number)

  return {
    dottedDecimal,
    decimal: unsigned.toString(10),
    binary: octets.map((octet) => octet.toString(2).padStart(8, "0")).join("."),
    hex: "0x" + unsigned.toString(16).toUpperCase().padStart(8, "0"),
    octal: "0o" + unsigned.toString(8),
    ipv6Mapped: `::ffff:${dottedDecimal}`,
    ipv6Compatible: `::${dottedDecimal}`,
    ipClass: classfulName(octets[0]),
    scope: specialUseScope(unsigned),
  }
}
