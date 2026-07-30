// Propagation, bandwidth-delay and IPv4 bitwise maths.

import { intToIpv4, ipv4ToInt } from "./network-utils"

// exact defined value of c, in km/s
export const SPEED_OF_LIGHT_KM_S = 299792.458

export type Medium = "fiber" | "copper" | "wireless"
export type DistanceUnit = "km" | "mi"

// velocity factor = 1 / refractive index. standard single mode fibre sits near
// 1.47, so ~0.67c; radio through air is within 0.03% of c
export const VELOCITY_FACTORS: Readonly<Record<Medium, number>> = {
  fiber: 0.67,
  copper: 0.77,
  wireless: 0.9997,
}

export const KM_PER_MILE = 1.609344

export interface LatencyResult {
  distanceKm: number
  speedKmPerSecond: number
  oneWayMs: number
  roundTripMs: number
}

export function propagationLatency(
  distance: number,
  unit: DistanceUnit,
  medium: Medium
): LatencyResult | null {
  if (!Number.isFinite(distance) || distance <= 0) return null

  const distanceKm = unit === "mi" ? distance * KM_PER_MILE : distance
  const speedKmPerSecond = SPEED_OF_LIGHT_KM_S * VELOCITY_FACTORS[medium]
  const oneWayMs = (distanceKm / speedKmPerSecond) * 1000

  return { distanceKm, speedKmPerSecond, oneWayMs, roundTripMs: oneWayMs * 2 }
}

export interface ThroughputResult {
  bdpBytes: number
  maxThroughputMbps: number
  optimalWindowBytes: number
  efficiencyPercent: number
  // rfc 7323 s2.2 caps the window scale shift at 14, so 65535 << 14
  exceedsMaxWindow: boolean
}

export const MAX_SCALED_WINDOW_BYTES = 65535 * 2 ** 14

export function bandwidthDelay(
  bandwidthMbps: number,
  rttMs: number,
  windowBytes: number
): ThroughputResult | null {
  if (![bandwidthMbps, rttMs, windowBytes].every((n) => Number.isFinite(n) && n > 0)) return null

  // bdp in bits = bit/s * seconds
  const bdpBytes = (bandwidthMbps * 1_000_000 * (rttMs / 1000)) / 8
  const maxThroughputMbps = (windowBytes * 8) / (rttMs / 1000) / 1_000_000

  return {
    bdpBytes,
    maxThroughputMbps,
    optimalWindowBytes: bdpBytes,
    efficiencyPercent: Math.min(100, (maxThroughputMbps / bandwidthMbps) * 100),
    exceedsMaxWindow: windowBytes > MAX_SCALED_WINDOW_BYTES,
  }
}

export interface IPMathResult {
  addressCount: number
  distance: number
  and: string
  or: string
  xor: string
  lower: string
  upper: string
  // the shortest aligned prefix that covers both addresses
  commonPrefix: number
  supernet: string
}

export function ipv4Math(first: string, second: string): IPMathResult | null {
  let a: number
  let b: number
  try {
    a = ipv4ToInt(first.trim())
    b = ipv4ToInt(second.trim())
  } catch {
    return null
  }

  const lower = Math.min(a, b)
  const upper = Math.max(a, b)
  const xor = (a ^ b) >>> 0

  // clz32 counts the leading zeros of the difference, which is exactly the
  // number of high bits the two addresses share
  const commonPrefix = xor === 0 ? 32 : Math.clz32(xor)
  const supernetMask = commonPrefix === 0 ? 0 : (0xffffffff << (32 - commonPrefix)) >>> 0

  return {
    addressCount: upper - lower + 1,
    distance: upper - lower,
    and: intToIpv4((a & b) >>> 0),
    or: intToIpv4((a | b) >>> 0),
    xor: intToIpv4(xor),
    lower: intToIpv4(lower),
    upper: intToIpv4(upper),
    commonPrefix,
    supernet: `${intToIpv4((lower & supernetMask) >>> 0)}/${commonPrefix}`,
  }
}
