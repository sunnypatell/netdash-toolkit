// random address generation. crypto.getRandomValues only, and every bounded
// draw goes through rejection sampling so no value in the range is more likely
// than another. Math.random was used here before, which is neither seeded from
// an unpredictable source nor uniform once folded into a range.
//
// reserved-range knowledge is cited inline: an address generator whose "public"
// mode emits 169.254.x.x is worse than useless in a test fixture.

import { uniformIndex, type RandomFill } from "@/lib/password-gen"

export type { RandomFill }

/** uniform integer in [min, max], inclusive, by rejection sampling */
export function randomInt(min: number, max: number, fill?: RandomFill): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("bounds must be integers")
  if (max < min) throw new Error("max must be >= min")
  return min + uniformIndex(max - min + 1, fill)
}

export function randomByte(fill?: RandomFill): number {
  return randomInt(0, 255, fill)
}

export type IPv4Kind =
  "any" | "private-a" | "private-b" | "private-c" | "public" | "loopback" | "link-local"

export type IPv6Kind = "global" | "ula" | "link-local" | "documentation"

export type MacScope = "any" | "unicast" | "multicast" | "universal" | "local" | "unicast-local"

export type MacFormat = "colon" | "dash" | "dot" | "none"

export interface MacOptions {
  scope: MacScope
  format: MacFormat
  uppercase: boolean
}

interface Block {
  /** first address of the block as a uint32 */
  start: number
  /** prefix length */
  prefix: number
  why: string
}

const ip = (a: number, b: number, c: number, d: number) =>
  ((a << 24) | (b << 16) | (c << 8) | d) >>> 0

/**
 * IPv4 blocks that are not globally reachable, from the IANA IPv4
 * Special-Purpose Address Registry (RFC 6890 and its updates). "public" mode
 * resamples until it lands outside every one of these.
 */
export const NON_PUBLIC_IPV4: Block[] = [
  { start: ip(0, 0, 0, 0), prefix: 8, why: "this network (RFC 1122)" },
  { start: ip(10, 0, 0, 0), prefix: 8, why: "private (RFC 1918)" },
  { start: ip(100, 64, 0, 0), prefix: 10, why: "shared CGNAT space (RFC 6598)" },
  { start: ip(127, 0, 0, 0), prefix: 8, why: "loopback (RFC 1122)" },
  { start: ip(169, 254, 0, 0), prefix: 16, why: "link-local (RFC 3927)" },
  { start: ip(172, 16, 0, 0), prefix: 12, why: "private (RFC 1918)" },
  { start: ip(192, 0, 0, 0), prefix: 24, why: "IETF protocol assignments (RFC 6890)" },
  { start: ip(192, 0, 2, 0), prefix: 24, why: "TEST-NET-1 (RFC 5737)" },
  { start: ip(192, 88, 99, 0), prefix: 24, why: "deprecated 6to4 relay anycast (RFC 7526)" },
  { start: ip(192, 168, 0, 0), prefix: 16, why: "private (RFC 1918)" },
  { start: ip(198, 18, 0, 0), prefix: 15, why: "benchmarking (RFC 2544)" },
  { start: ip(198, 51, 100, 0), prefix: 24, why: "TEST-NET-2 (RFC 5737)" },
  { start: ip(203, 0, 113, 0), prefix: 24, why: "TEST-NET-3 (RFC 5737)" },
  { start: ip(224, 0, 0, 0), prefix: 4, why: "multicast (RFC 5771)" },
  { start: ip(240, 0, 0, 0), prefix: 4, why: "reserved for future use (RFC 1112)" },
]

function inBlock(address: number, block: Block): boolean {
  const mask = block.prefix === 0 ? 0 : (0xffffffff << (32 - block.prefix)) >>> 0
  return (address & mask) >>> 0 === block.start
}

/** which reserved block an address falls in, or null when it is globally routable */
export function nonPublicReason(address: number): string | null {
  for (const block of NON_PUBLIC_IPV4) {
    if (inBlock(address, block)) return block.why
  }
  return null
}

export function formatIPv4(address: number): string {
  return [
    (address >>> 24) & 0xff,
    (address >>> 16) & 0xff,
    (address >>> 8) & 0xff,
    address & 0xff,
  ].join(".")
}

export function randomIPv4(kind: IPv4Kind, fill?: RandomFill): string {
  switch (kind) {
    case "private-a":
      // 10.0.0.0/8, host part never .0 or .255 so the result is assignable
      return `10.${randomByte(fill)}.${randomByte(fill)}.${randomInt(1, 254, fill)}`
    case "private-b":
      return `172.${randomInt(16, 31, fill)}.${randomByte(fill)}.${randomInt(1, 254, fill)}`
    case "private-c":
      return `192.168.${randomByte(fill)}.${randomInt(1, 254, fill)}`
    case "loopback":
      return `127.${randomByte(fill)}.${randomByte(fill)}.${randomInt(1, 254, fill)}`
    case "link-local":
      // rfc 3927 reserves 169.254.0.0/24 and 169.254.255.0/24
      return `169.254.${randomInt(1, 254, fill)}.${randomInt(1, 254, fill)}`
    case "public": {
      for (;;) {
        const address = randomInt(0, 0xffffffff, fill) >>> 0
        if (nonPublicReason(address) !== null) continue
        const last = address & 0xff
        if (last === 0 || last === 255) continue
        return formatIPv4(address)
      }
    }
    default:
      return `${randomInt(1, 223, fill)}.${randomByte(fill)}.${randomByte(fill)}.${randomInt(1, 254, fill)}`
  }
}

const MULTICAST_BIT = 0x01
const LOCAL_BIT = 0x02

/**
 * first octet bits per IEEE Std 802-2014 clause 8.2: the least significant bit
 * of the first octet is I/G (0 = individual), the next is U/L (1 = locally
 * administered). in the usual hex notation those are 0x01 and 0x02.
 */
export function applyMacScope(firstOctet: number, scope: MacScope): number {
  let octet = firstOctet & 0xff
  switch (scope) {
    case "unicast":
      return octet & ~MULTICAST_BIT & 0xff
    case "multicast":
      return (octet | MULTICAST_BIT) & 0xff
    case "universal":
      return octet & ~LOCAL_BIT & 0xff
    case "local":
      return (octet | LOCAL_BIT) & 0xff
    case "unicast-local":
      octet = (octet | LOCAL_BIT) & 0xff
      return octet & ~MULTICAST_BIT & 0xff
    default:
      return octet
  }
}

export function formatMac(bytes: number[], options: Pick<MacOptions, "format" | "uppercase">) {
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0"))
  let text: string
  switch (options.format) {
    case "dash":
      text = hex.join("-")
      break
    case "dot":
      // cisco style: three dotted 16-bit groups
      text = [hex[0] + hex[1], hex[2] + hex[3], hex[4] + hex[5]].join(".")
      break
    case "none":
      text = hex.join("")
      break
    default:
      text = hex.join(":")
  }
  return options.uppercase ? text.toUpperCase() : text
}

export function randomMac(options: MacOptions, fill?: RandomFill): string {
  const bytes = [applyMacScope(randomByte(fill), options.scope)]
  for (let i = 1; i < 6; i++) bytes.push(randomByte(fill))
  return formatMac(bytes, options)
}

function randomGroup(fill?: RandomFill): string {
  return randomInt(0, 0xffff, fill).toString(16).padStart(4, "0")
}

export function randomIPv6(kind: IPv6Kind, fill?: RandomFill): string {
  const groups: string[] = []
  switch (kind) {
    case "ula":
      // rfc 4193: fc00::/7 with the L bit set is fd00::/8, the only half meant
      // for local assignment
      groups.push(`fd${randomByte(fill).toString(16).padStart(2, "0")}`)
      for (let i = 1; i < 8; i++) groups.push(randomGroup(fill))
      break
    case "link-local":
      // rfc 4291 2.5.6: fe80::/10 with the next 54 bits zero
      groups.push("fe80", "0000", "0000", "0000")
      for (let i = 4; i < 8; i++) groups.push(randomGroup(fill))
      break
    case "documentation":
      // rfc 3849 reserves 2001:db8::/32 for documentation and examples
      groups.push("2001", "0db8")
      for (let i = 2; i < 8; i++) groups.push(randomGroup(fill))
      break
    default:
      // rfc 4291 2.5.4: global unicast is 2000::/3, i.e. 2000:: - 3fff:ffff:...
      groups.push(randomInt(0x2000, 0x3fff, fill).toString(16).padStart(4, "0"))
      for (let i = 1; i < 8; i++) groups.push(randomGroup(fill))
  }
  return groups.join(":")
}
