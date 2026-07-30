import type { SubnetMaskEntry } from "./types"

// every row is plain prefix arithmetic: mask is the top `prefix` bits set,
// wildcard is its complement, and usable hosts is 2^(32-prefix) - 2 apart from
// the two documented exceptions, /31 (RFC 3021 point-to-point) and /32 (host
// route). tests/unit/reference-data.test.ts recomputes all of it.
export const SUBNET_MASKS: readonly SubnetMaskEntry[] = [
  { prefix: 32, mask: "255.255.255.255", wildcard: "0.0.0.0", usableHosts: 1 },
  { prefix: 31, mask: "255.255.255.254", wildcard: "0.0.0.1", usableHosts: 2 },
  { prefix: 30, mask: "255.255.255.252", wildcard: "0.0.0.3", usableHosts: 2 },
  { prefix: 29, mask: "255.255.255.248", wildcard: "0.0.0.7", usableHosts: 6 },
  { prefix: 28, mask: "255.255.255.240", wildcard: "0.0.0.15", usableHosts: 14 },
  { prefix: 27, mask: "255.255.255.224", wildcard: "0.0.0.31", usableHosts: 30 },
  { prefix: 26, mask: "255.255.255.192", wildcard: "0.0.0.63", usableHosts: 62 },
  { prefix: 25, mask: "255.255.255.128", wildcard: "0.0.0.127", usableHosts: 126 },
  { prefix: 24, mask: "255.255.255.0", wildcard: "0.0.0.255", usableHosts: 254 },
  { prefix: 23, mask: "255.255.254.0", wildcard: "0.0.1.255", usableHosts: 510 },
  { prefix: 22, mask: "255.255.252.0", wildcard: "0.0.3.255", usableHosts: 1022 },
  { prefix: 21, mask: "255.255.248.0", wildcard: "0.0.7.255", usableHosts: 2046 },
  { prefix: 20, mask: "255.255.240.0", wildcard: "0.0.15.255", usableHosts: 4094 },
  { prefix: 19, mask: "255.255.224.0", wildcard: "0.0.31.255", usableHosts: 8190 },
  { prefix: 18, mask: "255.255.192.0", wildcard: "0.0.63.255", usableHosts: 16382 },
  { prefix: 17, mask: "255.255.128.0", wildcard: "0.0.127.255", usableHosts: 32766 },
  { prefix: 16, mask: "255.255.0.0", wildcard: "0.0.255.255", usableHosts: 65534 },
  { prefix: 15, mask: "255.254.0.0", wildcard: "0.1.255.255", usableHosts: 131070 },
  { prefix: 14, mask: "255.252.0.0", wildcard: "0.3.255.255", usableHosts: 262142 },
  { prefix: 13, mask: "255.248.0.0", wildcard: "0.7.255.255", usableHosts: 524286 },
  { prefix: 12, mask: "255.240.0.0", wildcard: "0.15.255.255", usableHosts: 1048574 },
  { prefix: 11, mask: "255.224.0.0", wildcard: "0.31.255.255", usableHosts: 2097150 },
  { prefix: 10, mask: "255.192.0.0", wildcard: "0.63.255.255", usableHosts: 4194302 },
  { prefix: 9, mask: "255.128.0.0", wildcard: "0.127.255.255", usableHosts: 8388606 },
  { prefix: 8, mask: "255.0.0.0", wildcard: "0.255.255.255", usableHosts: 16777214 },
  { prefix: 7, mask: "254.0.0.0", wildcard: "1.255.255.255", usableHosts: 33554430 },
  { prefix: 6, mask: "252.0.0.0", wildcard: "3.255.255.255", usableHosts: 67108862 },
  { prefix: 5, mask: "248.0.0.0", wildcard: "7.255.255.255", usableHosts: 134217726 },
  { prefix: 4, mask: "240.0.0.0", wildcard: "15.255.255.255", usableHosts: 268435454 },
  { prefix: 3, mask: "224.0.0.0", wildcard: "31.255.255.255", usableHosts: 536870910 },
  { prefix: 2, mask: "192.0.0.0", wildcard: "63.255.255.255", usableHosts: 1073741822 },
  { prefix: 1, mask: "128.0.0.0", wildcard: "127.255.255.255", usableHosts: 2147483646 },
  { prefix: 0, mask: "0.0.0.0", wildcard: "255.255.255.255", usableHosts: 4294967294 },
]

export function subnetMaskFor(prefix: number): SubnetMaskEntry | undefined {
  return SUBNET_MASKS.find((entry) => entry.prefix === prefix)
}
