import { cidrToRange, intToIpv4, prefixToMaskInt, prefixToNetmask } from "@/lib/network-utils"
import { usableHostsForPrefix } from "@/lib/cidr-reference"

export interface RangeSummary {
  cidr: string
  prefix: number
  networkInt: number
  lastInt: number
  networkAddress: string
  broadcastAddress: string | null
  netmask: string
  wildcard: string
  firstUsable: string
  lastUsable: string
  totalAddresses: number
  usableHosts: number
  // a /31 is a point-to-point link (rfc 3021) and a /32 is a host route: neither
  // reserves a network or broadcast address, so neither can be excluded
  hasNetworkAndBroadcast: boolean
}

export function summarizeRange(cidr: string): RangeSummary {
  const { start, end, prefix, cidr: normalized } = cidrToRange(cidr.trim())
  const hasNetworkAndBroadcast = prefix <= 30

  return {
    cidr: normalized,
    prefix,
    networkInt: start,
    lastInt: end,
    networkAddress: intToIpv4(start),
    broadcastAddress: hasNetworkAndBroadcast ? intToIpv4(end) : null,
    netmask: prefixToNetmask(prefix),
    wildcard: intToIpv4(~prefixToMaskInt(prefix) >>> 0),
    firstUsable: intToIpv4(hasNetworkAndBroadcast ? start + 1 : start),
    lastUsable: intToIpv4(hasNetworkAndBroadcast ? end - 1 : end),
    totalAddresses: end - start + 1,
    usableHosts: usableHostsForPrefix(prefix),
    hasNetworkAndBroadcast,
  }
}

export interface EnumerateOptions {
  includeNetwork?: boolean
  includeBroadcast?: boolean
  order?: "asc" | "desc"
  limit: number
}

// walks the range once between two bounds, so an address can never appear twice
// no matter how the include flags are set at /31 and /32
export function enumerateAddresses(summary: RangeSummary, options: EnumerateOptions): string[] {
  const { includeNetwork = false, includeBroadcast = false, order = "asc", limit } = options
  if (limit <= 0) return []

  const first =
    summary.hasNetworkAndBroadcast && !includeNetwork ? summary.networkInt + 1 : summary.networkInt
  const last =
    summary.hasNetworkAndBroadcast && !includeBroadcast ? summary.lastInt - 1 : summary.lastInt

  if (last < first) return []

  const count = Math.min(last - first + 1, limit)
  const out: string[] = new Array(count)
  for (let index = 0; index < count; index++) {
    // descending walks down from the top so the slice is the top of the range
    out[index] = intToIpv4(order === "desc" ? last - index : first + index)
  }
  return out
}

export function selectableCount(summary: RangeSummary, options: EnumerateOptions): number {
  const { includeNetwork = false, includeBroadcast = false } = options
  const first =
    summary.hasNetworkAndBroadcast && !includeNetwork ? summary.networkInt + 1 : summary.networkInt
  const last =
    summary.hasNetworkAndBroadcast && !includeBroadcast ? summary.lastInt - 1 : summary.lastInt
  return Math.max(0, last - first + 1)
}
