import { SUBNET_MASKS } from "@/lib/reference/subnet-masks"

// ascending view over lib/reference/subnet-masks, plus the total address count it has no use for
export interface CIDREntry {
  prefix: number
  mask: string
  wildcard: string
  totalAddresses: number
  usableHosts: number
}

export const CIDR_TABLE: readonly CIDREntry[] = [...SUBNET_MASKS]
  .sort((a, b) => a.prefix - b.prefix)
  .map((entry) => ({ ...entry, totalAddresses: 2 ** (32 - entry.prefix) }))

export const COMMON_PREFIXES = [8, 16, 24, 25, 26, 27, 28, 29, 30, 31, 32] as const

export const COMMON_CIDR_TABLE: readonly CIDREntry[] = CIDR_TABLE.filter((entry) =>
  (COMMON_PREFIXES as readonly number[]).includes(entry.prefix)
)
