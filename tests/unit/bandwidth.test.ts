import { describe, expect, it } from "vitest"
import {
  SIZE_MULTIPLIERS,
  SPEED_TO_BPS,
  computeDownloadSize,
  computeTransferTime,
  convertSpeed,
  formatTransferDuration,
} from "@/lib/bandwidth"

describe("unit ladders", () => {
  it("keeps the si and iec ladders separate instead of mixing them", () => {
    expect(SIZE_MULTIPLIERS.kB).toBe(1000)
    expect(SIZE_MULTIPLIERS.MB).toBe(1_000_000)
    expect(SIZE_MULTIPLIERS.GB).toBe(1_000_000_000)
    expect(SIZE_MULTIPLIERS.KiB).toBe(1024)
    expect(SIZE_MULTIPLIERS.MiB).toBe(1_048_576)
    expect(SIZE_MULTIPLIERS.GiB).toBe(1_073_741_824)
  })

  it("uses decimal multiples for bit rates, as ieee 802.3 does", () => {
    expect(SPEED_TO_BPS.Kbps).toBe(1000)
    expect(SPEED_TO_BPS.Mbps).toBe(1_000_000)
    expect(SPEED_TO_BPS.Gbps).toBe(1_000_000_000)
    // byte rates are the same ladder times 8 bits
    expect(SPEED_TO_BPS.MBps).toBe(8 * SPEED_TO_BPS.Mbps)
    expect(SPEED_TO_BPS.Bps).toBe(8)
  })
})

describe("transfer time arithmetic", () => {
  const base = { sizeUnit: "GB", speedUnit: "Mbps", overhead: "0" } as const

  it("computes 1 GB over 100 Mbps with no overhead", () => {
    // 1e9 bytes = 8e9 bits; 8e9 / 1e8 = 80 s exactly
    const { result } = computeTransferTime({ ...base, size: "1", speed: "100" })
    expect(result?.totalSeconds).toBe(80)
    expect(result?.formatted).toBe("1m 20s")
  })

  it("applies protocol overhead to the line rate", () => {
    const { result } = computeTransferTime({ ...base, size: "1", speed: "100", overhead: "10" })
    expect(result?.effectiveBitsPerSecond).toBeCloseTo(90_000_000, 6)
    expect(result?.totalSeconds).toBeCloseTo(88.888889, 5)
  })

  it("does not confuse GB with GiB", () => {
    const decimal = computeTransferTime({ ...base, size: "1", speed: "1", speedUnit: "Gbps" })
    const binary = computeTransferTime({
      ...base,
      size: "1",
      sizeUnit: "GiB",
      speed: "1",
      speedUnit: "Gbps",
    })
    expect(decimal.result?.totalSeconds).toBe(8)
    expect(binary.result?.totalSeconds).toBeCloseTo(8.589934592, 9)
  })

  it("refuses to invent a speed when the field is empty or zero", () => {
    // the old code fell back to 1 unit of the selected speed and reported a time
    expect(computeTransferTime({ ...base, size: "1", speed: "" }).result).toBeNull()
    expect(computeTransferTime({ ...base, size: "1", speed: "0" }).result).toBeNull()
    expect(computeTransferTime({ ...base, size: "1", speed: "0" }).error).toMatch(/greater than 0/i)
    expect(computeTransferTime({ ...base, size: "0", speed: "100" }).result).toBeNull()
  })

  it("rejects 100% overhead instead of printing Infinity", () => {
    const at100 = computeTransferTime({ ...base, size: "1", speed: "100", overhead: "100" })
    expect(at100.result).toBeNull()
    expect(at100.error).toMatch(/under 100%/i)
    expect(
      computeTransferTime({ ...base, size: "1", speed: "100", overhead: "-5" }).result
    ).toBeNull()
  })

  it("keeps sub-second transfers visible instead of rounding them to 0s", () => {
    const { result } = computeTransferTime({
      size: "1",
      sizeUnit: "MB",
      speed: "1",
      speedUnit: "Gbps",
      overhead: "0",
    })
    expect(result?.totalSeconds).toBeCloseTo(0.008, 9)
    expect(result?.formatted).toBe("8.00 ms")
  })

  it("formats long transfers with every non-zero unit", () => {
    expect(formatTransferDuration(0)).toBe("0.00 ms")
    expect(formatTransferDuration(1)).toBe("1s")
    expect(formatTransferDuration(61)).toBe("1m 1s")
    expect(formatTransferDuration(3661)).toBe("1h 1m 1s")
    expect(formatTransferDuration(90061)).toBe("1d 1h 1m 1s")
  })
})

describe("download size arithmetic", () => {
  it("computes an hour at 100 Mbps", () => {
    const { result } = computeDownloadSize({
      time: "1",
      timeUnit: "hours",
      speed: "100",
      speedUnit: "Mbps",
    })
    // 1e8 bit/s * 3600 s / 8 = 45e9 bytes
    expect(result?.totalBytes).toBe(45_000_000_000)
  })

  it("round-trips against the transfer-time calculation", () => {
    const download = computeDownloadSize({
      time: "80",
      timeUnit: "seconds",
      speed: "100",
      speedUnit: "Mbps",
    })
    expect(download.result?.totalBytes).toBe(1_000_000_000)

    const transfer = computeTransferTime({
      size: String(download.result!.totalBytes),
      sizeUnit: "B",
      speed: "100",
      speedUnit: "Mbps",
      overhead: "0",
    })
    expect(transfer.result?.totalSeconds).toBe(80)
  })

  it("refuses empty or zero inputs", () => {
    expect(
      computeDownloadSize({ time: "", timeUnit: "hours", speed: "100", speedUnit: "Mbps" }).result
    ).toBeNull()
    expect(
      computeDownloadSize({ time: "1", timeUnit: "hours", speed: "0", speedUnit: "Mbps" }).result
    ).toBeNull()
  })
})

describe("speed conversion", () => {
  it("is exact for 100 Mbps", () => {
    const converted = convertSpeed("100", "Mbps")!
    expect(converted.bps).toBe(100_000_000)
    expect(converted.Kbps).toBe(100_000)
    expect(converted.Mbps).toBe(100)
    expect(converted.Gbps).toBe(0.1)
    expect(converted.Bps).toBe(12_500_000)
    expect(converted.MBps).toBe(12.5)
  })

  it("round-trips through every unit", () => {
    const converted = convertSpeed("2.5", "Gbps")!
    for (const [unit, value] of Object.entries(converted)) {
      const back = convertSpeed(String(value), unit as keyof typeof converted)!
      expect(back.Gbps).toBeCloseTo(2.5, 9)
    }
  })

  it("returns null rather than 0 for unusable input", () => {
    expect(convertSpeed("", "Mbps")).toBeNull()
    expect(convertSpeed("abc", "Mbps")).toBeNull()
    expect(convertSpeed("-1", "Mbps")).toBeNull()
  })
})
