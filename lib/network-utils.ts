// Core networking utility functions for IPv4 and IPv6 calculations

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
}

// IPv4 utility functions
export function ipv4ToInt(ip: string): number {
  // digits-only per octet: Number("") is 0 and NaN compares false to
  // everything, so "1.2.3." and "a.b.c.d" both slipped through the old check
  const parts = ip.split(".")
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  if (parts.length !== 4 || nums.some((n) => !Number.isInteger(n) || n > 255)) {
    throw new Error("Invalid IPv4 address")
  }
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0
}

export function intToIpv4(int: number): string {
  return [(int >>> 24) & 0xff, (int >>> 16) & 0xff, (int >>> 8) & 0xff, int & 0xff].join(".")
}

// js shift counts are mod 32, so `0xffffffff << 32` is `<< 0`; without the
// guard a /0 produced mask 255.255.255.255 and default routes came out as
// host routes in every config generator
export function prefixToMaskInt(prefix: number): number {
  if (prefix < 0 || prefix > 32) {
    throw new Error("Invalid prefix length")
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
    throw new Error("Invalid prefix length")
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
    // Single host
    firstHost = network
    lastHost = network
    hostCount = 1
  } else if (prefix === 31) {
    // RFC 3021 - /31 networks have 2 usable addresses
    firstHost = network
    lastHost = broadcast
    hostCount = 2
  } else {
    // Standard subnet
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
export function expandIPv6(ip: string): string {
  // Remove any existing brackets
  ip = ip.replace(/^\[|\]$/g, "")

  // rfc 4291 2.5.5 ipv4-embedded form ("::ffff:192.168.1.1"): convert the
  // trailing dotted quad into two hex groups so the rest of the pipeline
  // only ever sees 8 hex groups
  const v4Match = ip.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4Match) {
    const v4Int = ipv4ToInt(v4Match[2])
    const high = ((v4Int >>> 16) & 0xffff).toString(16)
    const low = (v4Int & 0xffff).toString(16)
    ip = `${v4Match[1]}${high}:${low}`
  }

  // Handle :: expansion
  if (ip.includes("::")) {
    const parts = ip.split("::")
    const left = parts[0] ? parts[0].split(":") : []
    const right = parts[1] ? parts[1].split(":") : []
    const missing = 8 - left.length - right.length

    const expanded = [...left, ...Array(missing).fill("0000"), ...right]

    return expanded.map((part) => part.padStart(4, "0")).join(":")
  }

  // Just pad existing parts
  return ip
    .split(":")
    .map((part) => part.padStart(4, "0"))
    .join(":")
}

export function compressIPv6(ip: string): string {
  const expanded = expandIPv6(ip)

  // Find the longest sequence of consecutive zero groups
  const groups = expanded.split(":")
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

  // Check final sequence
  if (currentZeroLength > longestZeroLength) {
    longestZeroStart = currentZeroStart
    longestZeroLength = currentZeroLength
  }

  // Apply compression if we found a sequence of 2 or more zeros
  if (longestZeroLength >= 2) {
    const before = groups.slice(0, longestZeroStart).map((g) => g.replace(/^0+/, "") || "0")
    const after = groups
      .slice(longestZeroStart + longestZeroLength)
      .map((g) => g.replace(/^0+/, "") || "0")

    if (before.length === 0 && after.length === 0) {
      return "::"
    } else if (before.length === 0) {
      return "::" + after.join(":")
    } else if (after.length === 0) {
      return before.join(":") + "::"
    } else {
      return before.join(":") + "::" + after.join(":")
    }
  }

  // No compression possible, just remove leading zeros
  return groups.map((g) => g.replace(/^0+/, "") || "0").join(":")
}

export function calculateIPv6Subnet(ip: string, prefix: number): IPv6Result {
  if (prefix < 0 || prefix > 128) {
    throw new Error("Invalid prefix length")
  }

  const expanded = expandIPv6(ip)
  const groups = expanded.split(":").map((g) => Number.parseInt(g, 16))

  // Calculate network address by zeroing host bits
  const networkGroups = [...groups]
  const hostBits = 128 - prefix
  let bitsToZero = hostBits

  for (let i = 7; i >= 0 && bitsToZero > 0; i--) {
    if (bitsToZero >= 16) {
      networkGroups[i] = 0
      bitsToZero -= 16
    } else {
      const mask = (0xffff << bitsToZero) & 0xffff
      networkGroups[i] = networkGroups[i] & mask
      bitsToZero = 0
    }
  }

  const network = networkGroups.map((g) => g.toString(16).padStart(4, "0")).join(":")
  const compressed = compressIPv6(network)

  // Determine address type
  const firstGroup = groups[0]
  const isLoopback = expanded === "0000:0000:0000:0000:0000:0000:0000:0001"
  const isLinkLocal = firstGroup === 0xfe80
  const isMulticast = (firstGroup & 0xff00) === 0xff00
  const isPrivate = (firstGroup & 0xfe00) === 0xfc00 || (firstGroup & 0xffc0) === 0xfe80

  // Calculate solicited-node multicast for unicast addresses
  let solicitedNode: string | undefined
  if (!isMulticast && !isLoopback) {
    const lastGroup = groups[7]
    const secondLastGroup = groups[6]
    solicitedNode = `ff02::1:ff${(secondLastGroup & 0xff).toString(16).padStart(2, "0")}:${lastGroup.toString(16).padStart(4, "0")}`
  }

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
  }
}

// CIDR manipulation functions
export interface CIDRRange {
  start: number
  end: number
  cidr: string
  prefix: number
}

export function cidrToRange(cidr: string): CIDRRange {
  const [ip, prefixStr] = cidr.split("/")
  const prefix = Number.parseInt(prefixStr, 10)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
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

// merge input blocks into the minimal set of aligned cidrs covering the same
// addresses. the old implementation emitted prefixes one bit too specific
// (including an impossible /33) and silently dropped half of merged ranges.
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

// Validation functions
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false

  const parts = ip.split(".")
  if (parts.length !== 4) return false

  return parts.every((part) => {
    if (part === "" || part.length > 3) return false
    const num = Number.parseInt(part, 10)
    return (
      (!isNaN(num) && num >= 0 && num <= 255 && part === num.toString() && !part.startsWith("0")) ||
      part === "0"
    )
  })
}

export function isValidIPv6(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false

  try {
    // Basic IPv6 format validation
    if (ip.includes(":::")) return false
    if (ip.split("::").length > 2) return false

    const expanded = expandIPv6(ip)
    const parts = expanded.split(":")

    if (parts.length !== 8) return false

    return parts.every((part) => {
      if (part.length !== 4) return false
      return /^[0-9a-fA-F]{4}$/.test(part)
    })
  } catch {
    return false
  }
}

export function isValidCIDR(cidr: string): boolean {
  const parts = cidr.split("/")
  if (parts.length !== 2) return false

  const [ip, prefixStr] = parts
  const prefix = Number.parseInt(prefixStr, 10)

  if (isValidIPv4(ip)) {
    return prefix >= 0 && prefix <= 32
  } else if (isValidIPv6(ip)) {
    return prefix >= 0 && prefix <= 128
  }

  return false
}
