import { intToIpv4, prefixToMaskInt, prefixToNetmask } from "@/lib/network-utils"

export interface CIDREntry {
  prefix: number
  mask: string
  wildcard: string
  totalAddresses: number
  usableHosts: number
}

// rfc 3021: a /31 has 2 usable addresses, not 0. a /32 is a host route with 1.
export function usableHostsForPrefix(prefix: number): number {
  const total = 2 ** (32 - prefix)
  if (prefix >= 31) return total
  return total - 2
}

function entryFor(prefix: number): CIDREntry {
  return {
    prefix,
    mask: prefixToNetmask(prefix),
    wildcard: intToIpv4(~prefixToMaskInt(prefix) >>> 0),
    totalAddresses: 2 ** (32 - prefix),
    usableHosts: usableHostsForPrefix(prefix),
  }
}

export const CIDR_TABLE: readonly CIDREntry[] = Array.from({ length: 33 }, (_, prefix) =>
  entryFor(prefix)
)

export const COMMON_PREFIXES = [8, 16, 24, 25, 26, 27, 28, 29, 30, 31, 32] as const

export const COMMON_CIDR_TABLE: readonly CIDREntry[] = CIDR_TABLE.filter((entry) =>
  (COMMON_PREFIXES as readonly number[]).includes(entry.prefix)
)
