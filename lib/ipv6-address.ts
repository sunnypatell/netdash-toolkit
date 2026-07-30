import { compressIPv6, expandIPv6, solicitedNodeMulticast } from "@/lib/network-utils"
import { normalizeMac } from "@/lib/parsers"

export interface IPv6Classification {
  type: string
  prefix: string
  source: string
}

const UNSPECIFIED = "0000:0000:0000:0000:0000:0000:0000:0000"
const LOOPBACK = "0000:0000:0000:0000:0000:0000:0000:0001"

// rfc 4291 section 2.4 plus the prefixes rfc 4291 defers to other documents for
export function classifyIPv6(address: string): IPv6Classification {
  const expanded = expandIPv6(address)
  if (expanded === UNSPECIFIED) {
    return { type: "Unspecified", prefix: "::/128", source: "RFC 4291 2.5.2" }
  }
  if (expanded === LOOPBACK) {
    return { type: "Loopback", prefix: "::1/128", source: "RFC 4291 2.5.3" }
  }

  const groups = expanded.split(":").map((group) => Number.parseInt(group, 16))
  const [g0, g1, g2, g3, g4, g5] = groups

  const zeroTop80 = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0
  if (zeroTop80 && g5 === 0xffff) {
    return { type: "IPv4-Mapped", prefix: "::ffff:0:0/96", source: "RFC 4291 2.5.5.2" }
  }
  if (zeroTop80 && g5 === 0) {
    return {
      type: "IPv4-Compatible (deprecated)",
      prefix: "::/96",
      source: "RFC 4291 2.5.5.1",
    }
  }
  if (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return { type: "NAT64 Well-Known Prefix", prefix: "64:ff9b::/96", source: "RFC 6052" }
  }
  if ((g0 & 0xff00) === 0xff00) {
    return { type: "Multicast", prefix: "ff00::/8", source: "RFC 4291 2.7" }
  }
  // fe80::/10 spans fe80 through febf, not just fe80::/16
  if ((g0 & 0xffc0) === 0xfe80) {
    return { type: "Link-Local Unicast", prefix: "fe80::/10", source: "RFC 4291 2.5.6" }
  }
  if ((g0 & 0xfe00) === 0xfc00) {
    return { type: "Unique Local", prefix: "fc00::/7", source: "RFC 4193" }
  }
  if (g0 === 0x2001 && g1 === 0x0db8) {
    return { type: "Documentation", prefix: "2001:db8::/32", source: "RFC 3849" }
  }
  if (g0 === 0x2002) {
    return { type: "6to4 (deprecated)", prefix: "2002::/16", source: "RFC 7526" }
  }
  if ((g0 & 0xe000) === 0x2000) {
    return { type: "Global Unicast", prefix: "2000::/3", source: "RFC 4291 2.5.4" }
  }
  // everything outside 2000::/3 that is not named above is still unassigned
  return { type: "Reserved by IETF", prefix: "::/0", source: "RFC 4291 2.4" }
}

// rfc 4291 appendix a: insert fffe in the middle and invert the u/l bit (0x02)
export function eui64InterfaceId(mac: string): string {
  const octets = normalizeMac(mac).split(":")
  const flipped = (Number.parseInt(octets[0], 16) ^ 0x02).toString(16).padStart(2, "0")
  return `${flipped}${octets[1]}:${octets[2]}ff:fe${octets[3]}:${octets[4]}${octets[5]}`
}

// an eui-64 interface identifier is 64 bits wide, so it needs a /64 or shorter
export function eui64Address(networkPrefix: string, mac: string, prefixLength: number): string {
  if (prefixLength > 64) {
    throw new Error("EUI-64 interface identifiers need a prefix of /64 or shorter")
  }
  const base = expandIPv6(networkPrefix).split(":").slice(0, 4)
  return compressIPv6(`${base.join(":")}:${eui64InterfaceId(mac)}`)
}

export function linkLocalFromMac(mac: string): string {
  return eui64Address("fe80::", mac, 64)
}

export function solicitedNode(address: string): string {
  return solicitedNodeMulticast(address)
}
