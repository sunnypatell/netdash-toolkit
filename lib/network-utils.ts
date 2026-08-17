export interface IPv4Result {
  network: string
  broadcast: string
  firstHost: string
  lastHost: string
  hostCount: number
  netmask: string
  wildcardMask: string
  cidr: string
  isPrivate: boolean
  isLoopback: boolean
  isLinkLocal: boolean
  isMulticast: boolean
}

export interface IPv6Result {
  network: string
  compressed: string
  expanded: string
  prefix: number
  hostBits: number
  isPrivate: boolean
  isLoopback: boolean
  isLinkLocal: boolean
  isMulticast: boolean
  solicitedNode?: string
  zone?: string
}

// single octet grammar shared by ipv4ToInt and isValidIPv4 so the two never
// disagree. leading zeros are rejected because "010" is ambiguously octal.
const IPV4_OCTET = /^(?:0|[1-9]\d{0,2})$/

// IPv4 utility functions
export function ipv4ToInt(ip: string): number {
  const parts = ip.split(".")
  const nums = parts.map((p) => (IPV4_OCTET.test(p) ? Number(p) : NaN))
  if (parts.length !== 4 || nums.some((n) => !Number.isInteger(n) || n > 255)) {
    throw new Error("Invalid IPv4 address")
  }
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0
}

export function intToIpv4(int: number): string {
  return [(int >>> 24) & 0xff, (int >>> 16) & 0xff, (int >>> 8) & 0xff, int & 0xff].join(".")
}

// js shift counts are mod 32, so an unguarded /0 gave mask 255.255.255.255, not 0.0.0.0
export function prefixToMaskInt(prefix: number): number {
  // isInteger, not just a range check: a fractional prefix truncates the shift count and
  // returned the wrong mask. the ipv6 sibling already guarded this.
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Invalid prefix length (must be 0-32)")
  }
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

export function prefixToNetmask(prefix: number): string {
  return intToIpv4(prefixToMaskInt(prefix))
}

export function netmaskToPrefix(netmask: string): number {
  const maskInt = ipv4ToInt(netmask)
  let prefix = 0
  let encounteredZero = false

  for (let bit = 31; bit >= 0; bit--) {
    const isOne = ((maskInt >>> bit) & 1) === 1

    if (isOne) {
      if (encounteredZero) {
        throw new Error("Subnet mask must have contiguous 1 bits")
      }
      prefix++
    } else {
      encounteredZero = true
    }
  }

  return prefix
}

export function calculateIPv4Subnet(ip: string, prefix: number): IPv4Result {
  if (prefix < 0 || prefix > 32) {
    throw new Error("Invalid prefix length (must be 0-32)")
  }

  const ipInt = ipv4ToInt(ip)
  const maskInt = prefixToMaskInt(prefix)
  const networkInt = (ipInt & maskInt) >>> 0
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0

  const network = intToIpv4(networkInt)
  const broadcast = intToIpv4(broadcastInt)
  const netmask = intToIpv4(maskInt)
  const wildcardMask = intToIpv4(~maskInt >>> 0)

  let firstHost: string
  let lastHost: string
  let hostCount: number

  if (prefix === 32) {
    firstHost = network
    lastHost = network
    hostCount = 1
  } else if (prefix === 31) {
    // RFC 3021 - /31 networks have 2 usable addresses
    firstHost = network
    lastHost = broadcast
    hostCount = 2
  } else {
    firstHost = intToIpv4(networkInt + 1)
    lastHost = intToIpv4(broadcastInt - 1)
    hostCount = Math.pow(2, 32 - prefix) - 2
  }

  // classify from the host address, not the network: 192.168.1.5/8 lives in
  // network 192.0.0.0 but the address itself is still rfc1918 private
  const firstOctet = (ipInt >>> 24) & 0xff
  const secondOctet = (ipInt >>> 16) & 0xff

  const isPrivate =
    firstOctet === 10 ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168)

  const isLoopback = firstOctet === 127
  const isLinkLocal = firstOctet === 169 && secondOctet === 254
  const isMulticast = firstOctet >= 224 && firstOctet <= 239

  return {
    network,
    broadcast,
    firstHost,
    lastHost,
    hostCount,
    netmask,
    wildcardMask,
    cidr: `${network}/${prefix}`,
    isPrivate,
    isLoopback,
    isLinkLocal,
    isMulticast,
  }
}

// IPv6 utility functions

// rfc 4007 zone ids ("fe80::1%eth0") are part of the textual form: split them
// off before any hex parsing, then re-attach so the zone survives round-trips
export function splitIPv6Zone(ip: string): { address: string; zone?: string } {
  const index = ip.indexOf("%")
  if (index === -1) {
    return { address: ip }
  }
  return { address: ip.slice(0, index), zone: ip.slice(index + 1) }
}

export function expandIPv6(ip: string): string {
  const { address, zone } = splitIPv6Zone(ip.replace(/^\[|\]$/g, ""))
  const suffix = zone === undefined ? "" : `%${zone}`
  let core = address

  // rfc 4291 2.5.5 embedded ipv4: fold the dotted quad to hex so the pipeline only sees 8 groups
  const v4Match = core.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4Match) {
    const v4Int = ipv4ToInt(v4Match[2])
    const high = ((v4Int >>> 16) & 0xffff).toString(16)
    const low = (v4Int & 0xffff).toString(16)
    core = `${v4Match[1]}${high}:${low}`
  }

  let groups: string[]

  if (core.includes("::")) {
    const parts = core.split("::")
    const left = parts[0] ? parts[0].split(":") : []
    const right = parts[1] ? parts[1].split(":") : []
    const missing = 8 - left.length - right.length
    // unguarded this reached Array(-1) and threw a bare "Invalid array length"
    if (missing < 0) {
      throw new Error("Invalid IPv6 address: more than 8 groups")
    }
    groups = [...left, ...Array(missing).fill("0000"), ...right]
  } else {
    groups = core.split(":")
    if (groups.length > 8) {
      throw new Error("Invalid IPv6 address: more than 8 groups")
    }
  }

  // rfc 5952 4.3 mandates lowercase hex
  return (
    groups
      .map((part) => part.padStart(4, "0"))
      .join(":")
      .toLowerCase() + suffix
  )
}

// rfc 5952 s5: embedded ipv4 keeps its dotted quad, but scoped to ::ffff:0:0/96 only. the
// deprecated ::/96 also contains :: and ::1, which must not render as ::0.0.0.0.
function ipv4MappedText(groups: readonly string[]): string | null {
  if (!groups.slice(0, 5).every((g) => g === "0000") || groups[5] !== "ffff") return null
  const high = Number.parseInt(groups[6], 16)
  const low = Number.parseInt(groups[7], 16)
  return `::ffff:${intToIpv4((((high << 16) >>> 0) | low) >>> 0)}`
}

export function compressIPv6(ip: string): string {
  const { address: expanded, zone } = splitIPv6Zone(expandIPv6(ip))
  const suffix = zone === undefined ? "" : `%${zone}`

  const groups = expanded.split(":")

  const mapped = ipv4MappedText(groups)
  if (mapped) return mapped + suffix
  let longestZeroStart = -1
  let longestZeroLength = 0
  let currentZeroStart = -1
  let currentZeroLength = 0

  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0000") {
      if (currentZeroStart === -1) {
        currentZeroStart = i
        currentZeroLength = 1
      } else {
        currentZeroLength++
      }
    } else {
      if (currentZeroLength > longestZeroLength) {
        longestZeroStart = currentZeroStart
        longestZeroLength = currentZeroLength
      }
      currentZeroStart = -1
      currentZeroLength = 0
    }
  }

  if (currentZeroLength > longestZeroLength) {
    longestZeroStart = currentZeroStart
    longestZeroLength = currentZeroLength
  }

  if (longestZeroLength >= 2) {
    const before = groups.slice(0, longestZeroStart).map((g) => g.replace(/^0+/, "") || "0")
    const after = groups
      .slice(longestZeroStart + longestZeroLength)
      .map((g) => g.replace(/^0+/, "") || "0")

    if (before.length === 0 && after.length === 0) {
      return "::" + suffix
    } else if (before.length === 0) {
      return "::" + after.join(":") + suffix
    } else if (after.length === 0) {
      return before.join(":") + "::" + suffix
    } else {
      return before.join(":") + "::" + after.join(":") + suffix
    }
  }

  return groups.map((g) => g.replace(/^0+/, "") || "0").join(":") + suffix
}

// rfc 4291 2.7.1: ff02::1:ff00:0/104 with the low 24 bits of the interface identifier
export function solicitedNodeMulticast(ip: string): string {
  const groups = expandIPv6(splitIPv6Zone(ip).address).split(":")
  if (groups.length !== 8) {
    throw new Error("Invalid IPv6 address")
  }
  const upper = Number.parseInt(groups[6], 16) & 0xff
  const lower = Number.parseInt(groups[7], 16) & 0xffff
  if (!Number.isInteger(upper) || !Number.isInteger(lower)) {
    throw new Error("Invalid IPv6 address")
  }
  // upper is padded because it is the low byte of the group "ff" + XX, not a
  // leading zero; lower is a whole group, so rfc 5952 4.1 forbids padding it
  return `ff02::1:ff${upper.toString(16).padStart(2, "0")}:${lower.toString(16)}`
}

// zero the host bits and return the expanded 8-group network address
export function ipv6NetworkPrefix(address: string, prefixLength: number): string {
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 128) {
    throw new Error("Invalid prefix length (must be 0-128)")
  }

  const groups = expandIPv6(splitIPv6Zone(address).address)
    .split(":")
    .map((group) => Number.parseInt(group, 16))

  return groups
    .map((group, index) => {
      const bitsRemaining = prefixLength - index * 16
      if (bitsRemaining >= 16) return group
      if (bitsRemaining <= 0) return 0
      return group & (0xffff - ((1 << (16 - bitsRemaining)) - 1))
    })
    .map((group) => group.toString(16).padStart(4, "0"))
    .join(":")
}

export function calculateIPv6Subnet(ip: string, prefix: number): IPv6Result {
  const { address, zone } = splitIPv6Zone(ip)
  const expanded = expandIPv6(address)
  const groups = expanded.split(":").map((g) => Number.parseInt(g, 16))

  const network = ipv6NetworkPrefix(address, prefix)
  const compressed = compressIPv6(network)
  const hostBits = 128 - prefix

  const firstGroup = groups[0]
  const isLoopback = expanded === "0000:0000:0000:0000:0000:0000:0000:0001"
  // fe80::/10 spans fe80-febf; the old /16 check disagreed with isPrivate below
  const isLinkLocal = (firstGroup & 0xffc0) === 0xfe80
  const isMulticast = (firstGroup & 0xff00) === 0xff00
  const isPrivate = (firstGroup & 0xfe00) === 0xfc00 || isLinkLocal

  const solicitedNode = !isMulticast && !isLoopback ? solicitedNodeMulticast(expanded) : undefined

  return {
    network,
    compressed,
    expanded,
    prefix,
    hostBits,
    isPrivate,
    isLoopback,
    isLinkLocal,
    isMulticast,
    solicitedNode,
    zone,
  }
}

// CIDR manipulation functions
export interface CIDRRange {
  start: number
  end: number
  cidr: string
  prefix: number
}

// a prefix is decimal digits and nothing else. parseInt read "24.5" as 24 and
// "8abc" as 8, so a mistyped prefix silently returned the wrong network.
export function parsePrefixText(prefixStr: string | undefined, max: 32 | 128): number | null {
  if (prefixStr === undefined || !/^\d{1,3}$/.test(prefixStr)) return null
  const prefix = Number(prefixStr)
  return prefix <= max ? prefix : null
}

export function cidrToRange(cidr: string): CIDRRange {
  const [ip, prefixStr] = cidr.split("/")
  const prefix = parsePrefixText(prefixStr, 32)
  if (prefix === null) {
    throw new Error("Invalid CIDR prefix")
  }
  const ipInt = ipv4ToInt(ip)
  const maskInt = prefixToMaskInt(prefix)
  const networkInt = (ipInt & maskInt) >>> 0
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0

  return {
    start: networkInt,
    end: broadcastInt,
    cidr: `${intToIpv4(networkInt)}/${prefix}`,
    prefix,
  }
}

// minimal set of aligned cidrs; the old version emitted an impossible /33 and dropped ranges
export function summarizeCIDRs(cidrs: string[]): string[] {
  if (cidrs.length === 0) return []

  const ranges = cidrs.map(cidrToRange).sort((a, b) => a.start - b.start)

  // merge overlapping or adjacent ranges
  const merged: Array<{ start: number; end: number }> = []
  let current = { start: ranges[0].start, end: ranges[0].end }
  for (let i = 1; i < ranges.length; i++) {
    const next = ranges[i]
    // "adjacent" means next.start === current.end + 1; written without the
    // subtraction so next.start === 0 can't underflow the comparison
    if (next.start <= current.end + 1) {
      current.end = Math.max(current.end, next.end)
    } else {
      merged.push(current)
      current = { start: next.start, end: next.end }
    }
  }
  merged.push(current)

  // greedy largest-aligned-block cover; 2**k arithmetic instead of shifts
  // because 1 << 31 is negative in js
  const result: string[] = []
  for (const range of merged) {
    let start = range.start
    while (start <= range.end) {
      let prefix = 32
      // grow while the doubled block stays aligned at start and inside range
      while (prefix > 0) {
        const doubled = 2 ** (32 - prefix + 1)
        if (start % doubled === 0 && start + doubled - 1 <= range.end) {
          prefix--
        } else {
          break
        }
      }
      result.push(`${intToIpv4(start)}/${prefix}`)
      start += 2 ** (32 - prefix)
      if (prefix === 0) break // /0 covers everything; avoid wrap-around loop
    }
  }

  return result
}

export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false

  const parts = ip.split(".")
  if (parts.length !== 4) return false

  return parts.every((part) => IPV4_OCTET.test(part) && Number(part) <= 255)
}

export function isValidIPv6(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false

  const { address, zone } = splitIPv6Zone(ip)
  // rfc 4007 zone id: interface name or index, must be present and printable
  if (zone !== undefined && !/^[0-9A-Za-z._~-]+$/.test(zone)) return false

  try {
    if (address.includes(":::")) return false
    if (address.split("::").length > 2) return false
    // a lone leading/trailing colon leaves an empty group that padStart hides
    if (/^:[^:]/.test(address) || /[^:]:$/.test(address)) return false

    const parts = expandIPv6(address).split(":")

    if (parts.length !== 8) return false

    return parts.every((part) => /^[0-9a-f]{4}$/.test(part))
  } catch {
    return false
  }
}

export function isValidCIDR(cidr: string): boolean {
  if (!cidr || typeof cidr !== "string") return false

  const parts = cidr.split("/")
  if (parts.length !== 2) return false

  const [ip, prefixStr] = parts
  const prefix = parsePrefixText(prefixStr, 128)
  if (prefix === null) return false

  if (isValidIPv4(ip)) {
    return prefix <= 32
  }
  // a zone id scopes a single interface address, never a prefix
  if (!ip.includes("%") && isValidIPv6(ip)) {
    return true
  }

  return false
}
