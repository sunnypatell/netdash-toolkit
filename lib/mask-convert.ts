// IPv4 subnet mask conversions between prefix, dotted decimal and wildcard.

import { intToIpv4, netmaskToPrefix, prefixToMaskInt } from "./network-utils"

export interface MaskInfo {
  prefix: number
  netmask: string
  wildcard: string
  binary: string
  hostBits: number
  // rfc 3021: a /31 has 2 usable addresses, and a /32 addresses one host
  usableHosts: number
  totalAddresses: number
  // how many blocks of this size tile the whole address space
  blocksInIPv4Space: number
}

export function usableHostsFor(prefix: number): number {
  if (prefix === 32) return 1
  if (prefix === 31) return 2
  return 2 ** (32 - prefix) - 2
}

// accepts /24, 24, 255.255.255.0 and 0.0.0.255; returns null rather than
// throwing so a half-typed mask is just "no result yet" instead of an error
export function parseMaskInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const prefixText = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed
  if (/^\d{1,2}$/.test(prefixText)) {
    const prefix = Number(prefixText)
    return prefix >= 0 && prefix <= 32 ? prefix : null
  }

  try {
    return netmaskToPrefix(trimmed)
  } catch {
    // a wildcard is the ones complement of a mask, so invert and retry
    try {
      return netmaskToPrefix(invertDotted(trimmed))
    } catch {
      return null
    }
  }
}

function invertDotted(dotted: string): string {
  const octets = dotted.split(".")
  if (octets.length !== 4) throw new Error("Not dotted quad")
  return octets
    .map((octet) => {
      if (!/^\d{1,3}$/.test(octet)) throw new Error("Not dotted quad")
      const value = Number(octet)
      if (value > 255) throw new Error("Not dotted quad")
      return String(255 - value)
    })
    .join(".")
}

export function maskInfo(prefix: number): MaskInfo {
  const maskInt = prefixToMaskInt(prefix)
  const netmask = intToIpv4(maskInt)

  return {
    prefix,
    netmask,
    wildcard: intToIpv4(~maskInt >>> 0),
    binary: netmask
      .split(".")
      .map((octet) => Number(octet).toString(2).padStart(8, "0"))
      .join("."),
    hostBits: 32 - prefix,
    usableHosts: usableHostsFor(prefix),
    totalAddresses: 2 ** (32 - prefix),
    blocksInIPv4Space: 2 ** prefix,
  }
}
