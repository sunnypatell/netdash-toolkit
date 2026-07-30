import { describe, expect, it } from "vitest"
import {
  bandwidthDelay,
  ipv4Math,
  KM_PER_MILE,
  MAX_SCALED_WINDOW_BYTES,
  propagationLatency,
  SPEED_OF_LIGHT_KM_S,
  VELOCITY_FACTORS,
} from "@/lib/network-math"

describe("propagation delay", () => {
  it("uses the defined value of c and a velocity factor per medium", () => {
    expect(SPEED_OF_LIGHT_KM_S).toBe(299792.458)
    // radio through air is within 0.03% of c, not 95% of it
    expect(VELOCITY_FACTORS.wireless).toBeGreaterThan(0.99)
    expect(VELOCITY_FACTORS.fiber).toBeCloseTo(0.67, 2)
  })

  it("gives the ~5 ms per 1000 km of fibre that operators use as a rule of thumb", () => {
    const result = propagationLatency(1000, "km", "fiber")!
    expect(result.oneWayMs).toBeCloseTo(4.979, 2)
    expect(result.roundTripMs).toBeCloseTo(result.oneWayMs * 2, 10)
  })

  it("converts miles with the exact statute mile", () => {
    expect(KM_PER_MILE).toBe(1.609344)
    const miles = propagationLatency(100, "mi", "fiber")!
    const km = propagationLatency(160.9344, "km", "fiber")!
    expect(miles.distanceKm).toBeCloseTo(160.9344, 6)
    expect(miles.oneWayMs).toBeCloseTo(km.oneWayMs, 9)
  })

  it("gets faster as the velocity factor rises", () => {
    const fiber = propagationLatency(1000, "km", "fiber")!.oneWayMs
    const copper = propagationLatency(1000, "km", "copper")!.oneWayMs
    const wireless = propagationLatency(1000, "km", "wireless")!.oneWayMs
    expect(copper).toBeLessThan(fiber)
    expect(wireless).toBeLessThan(copper)
  })

  it("returns null rather than Infinity or a negative delay", () => {
    for (const distance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(propagationLatency(distance, "km", "fiber"), `${distance}`).toBeNull()
    }
  })
})

describe("bandwidth delay product", () => {
  it("computes the in-flight bytes for a 1 Gbps 50 ms path", () => {
    // 1e9 bit/s * 0.05 s / 8 = 6.25 MB
    const result = bandwidthDelay(1000, 50, 65535)!
    expect(result.bdpBytes).toBeCloseTo(6_250_000, 6)
  })

  it("makes the window needed to fill the pipe equal the BDP by definition", () => {
    const result = bandwidthDelay(250, 30, 65535)!
    expect(result.optimalWindowBytes).toBeCloseTo(result.bdpBytes, 9)
  })

  it("derives throughput from the window and the RTT", () => {
    // 65535 bytes per 50 ms = 10.4856 Mbps
    expect(bandwidthDelay(1000, 50, 65535)!.maxThroughputMbps).toBeCloseTo(10.4856, 3)
  })

  it("reaches 100% utilisation once the window equals the BDP", () => {
    const bdp = bandwidthDelay(100, 20, 1)!.bdpBytes
    expect(bandwidthDelay(100, 20, bdp)!.efficiencyPercent).toBeCloseTo(100, 6)
  })

  it("caps utilisation at 100 rather than reporting an impossible figure", () => {
    expect(bandwidthDelay(1, 50, 10_000_000)!.efficiencyPercent).toBe(100)
  })

  it("flags a window beyond the RFC 7323 window scale ceiling", () => {
    expect(MAX_SCALED_WINDOW_BYTES).toBe(65535 * 2 ** 14)
    expect(bandwidthDelay(1000, 50, MAX_SCALED_WINDOW_BYTES)!.exceedsMaxWindow).toBe(false)
    expect(bandwidthDelay(1000, 50, MAX_SCALED_WINDOW_BYTES + 1)!.exceedsMaxWindow).toBe(true)
  })

  it("returns null for any non-positive input", () => {
    expect(bandwidthDelay(0, 50, 65535)).toBeNull()
    expect(bandwidthDelay(100, 0, 65535)).toBeNull()
    expect(bandwidthDelay(100, 50, 0)).toBeNull()
    expect(bandwidthDelay(Number.NaN, 50, 65535)).toBeNull()
  })
})

describe("IPv4 address math", () => {
  it("does the bitwise operations across a /24", () => {
    const result = ipv4Math("192.168.1.0", "192.168.1.255")!
    expect(result.and).toBe("192.168.1.0")
    expect(result.or).toBe("192.168.1.255")
    expect(result.xor).toBe("0.0.0.255")
    expect(result.addressCount).toBe(256)
    expect(result.distance).toBe(255)
    expect(result.commonPrefix).toBe(24)
    expect(result.supernet).toBe("192.168.1.0/24")
  })

  it("stays unsigned above 127.0.0.0, where a signed shift would go negative", () => {
    const result = ipv4Math("224.0.0.1", "239.255.255.255")!
    expect(result.and).toBe("224.0.0.1")
    expect(result.or).toBe("239.255.255.255")
    expect(result.lower).toBe("224.0.0.1")
    expect(result.upper).toBe("239.255.255.255")
    expect(result.commonPrefix).toBe(4)
    expect(result.supernet).toBe("224.0.0.0/4")
  })

  it("orders the pair regardless of which argument is larger", () => {
    const forward = ipv4Math("10.0.0.1", "10.0.0.9")!
    const reverse = ipv4Math("10.0.0.9", "10.0.0.1")!
    expect(forward.lower).toBe(reverse.lower)
    expect(forward.upper).toBe(reverse.upper)
    expect(forward.addressCount).toBe(reverse.addressCount)
  })

  it("treats an identical pair as a /32", () => {
    const result = ipv4Math("10.0.0.1", "10.0.0.1")!
    expect(result.addressCount).toBe(1)
    expect(result.distance).toBe(0)
    expect(result.commonPrefix).toBe(32)
    expect(result.supernet).toBe("10.0.0.1/32")
    expect(result.xor).toBe("0.0.0.0")
  })

  it("spans the whole space as a /0", () => {
    const result = ipv4Math("0.0.0.0", "255.255.255.255")!
    expect(result.addressCount).toBe(4294967296)
    expect(result.commonPrefix).toBe(0)
    expect(result.supernet).toBe("0.0.0.0/0")
  })

  it("returns a supernet that actually contains both addresses", () => {
    const pairs: Array<[string, string]> = [
      ["10.0.0.5", "10.0.3.200"],
      ["172.16.0.1", "172.31.255.254"],
      ["192.0.2.1", "203.0.113.9"],
      ["1.2.3.4", "1.2.3.5"],
    ]
    for (const [first, second] of pairs) {
      const result = ipv4Math(first, second)!
      const [network, prefixText] = result.supernet.split("/")
      const prefix = Number(prefixText)
      const size = 2 ** (32 - prefix)
      const toInt = (ip: string) =>
        ip.split(".").reduce((accumulator, octet) => accumulator * 256 + Number(octet), 0)
      const start = toInt(network)
      expect(start % size, `${result.supernet} is not aligned`).toBe(0)
      expect(toInt(first)).toBeGreaterThanOrEqual(start)
      expect(toInt(second)).toBeLessThanOrEqual(start + size - 1)
    }
  })

  it("returns null for an invalid address instead of NaN output", () => {
    expect(ipv4Math("nope", "10.0.0.1")).toBeNull()
    expect(ipv4Math("10.0.0.1", "10.0.0.256")).toBeNull()
    expect(ipv4Math("", "")).toBeNull()
    expect(ipv4Math("10.0.0", "10.0.0.1")).toBeNull()
  })
})
