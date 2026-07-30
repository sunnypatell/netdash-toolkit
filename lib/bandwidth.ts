// bit rates are decimal everywhere in ieee 802.3 and itu-t, so 1 Mbps is
// exactly 1e6 bit/s. byte sizes are offered in both ladders, labelled honestly,
// because "how long does my 4 GiB iso take" and "my 4 GB iso" are different sums.

export const SI_SIZE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"] as const
export const IEC_SIZE_UNITS = ["KiB", "MiB", "GiB", "TiB", "PiB"] as const

export type SizeUnit = (typeof SI_SIZE_UNITS)[number] | (typeof IEC_SIZE_UNITS)[number]

export const SIZE_UNITS: readonly SizeUnit[] = [...SI_SIZE_UNITS, ...IEC_SIZE_UNITS]

export const SIZE_MULTIPLIERS: Record<SizeUnit, number> = {
  B: 1,
  kB: 1000,
  MB: 1000 ** 2,
  GB: 1000 ** 3,
  TB: 1000 ** 4,
  PB: 1000 ** 5,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
  PiB: 1024 ** 5,
}

// pre-SI-fix saves stored 1024-based "KB"
export const LEGACY_SIZE_UNITS: Record<string, SizeUnit> = { KB: "kB" }

export const SPEED_UNITS = ["bps", "Kbps", "Mbps", "Gbps", "Bps", "KBps", "MBps", "GBps"] as const
export type SpeedUnit = (typeof SPEED_UNITS)[number]

export const SPEED_TO_BPS: Record<SpeedUnit, number> = {
  bps: 1,
  Kbps: 1000,
  Mbps: 1000 ** 2,
  Gbps: 1000 ** 3,
  Bps: 8,
  KBps: 8000,
  MBps: 8 * 1000 ** 2,
  GBps: 8 * 1000 ** 3,
}

// the si prefix for 1000 is a lowercase k; the stored keys stay for saved projects
export const SPEED_LABELS: Record<SpeedUnit, string> = {
  bps: "bit/s",
  Kbps: "kbit/s",
  Mbps: "Mbit/s",
  Gbps: "Gbit/s",
  Bps: "B/s",
  KBps: "kB/s",
  MBps: "MB/s",
  GBps: "GB/s",
}

export const TIME_UNITS = ["seconds", "minutes", "hours", "days"] as const
export type TimeUnit = (typeof TIME_UNITS)[number]

export const TIME_TO_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
}

function positiveNumber(text: string): number | null {
  if (!text.trim()) return null
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function formatTransferDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "n/a"
  if (totalSeconds < 1) return `${(totalSeconds * 1000).toPrecision(3)} ms`
  // flooring under a minute hid the whole point of picking GB over GiB: 8.59 s
  // and 8 s both printed "8s"
  if (totalSeconds < 60) return `${+totalSeconds.toFixed(2)}s`

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 || days > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

export interface TransferTimeResult {
  sizeBytes: number
  nominalBitsPerSecond: number
  effectiveBitsPerSecond: number
  totalSeconds: number
  formatted: string
}

export interface Computed<T> {
  result: T | null
  error: string
}

export function computeTransferTime(input: {
  size: string
  sizeUnit: SizeUnit
  speed: string
  speedUnit: SpeedUnit
  overhead: string
}): Computed<TransferTimeResult> {
  const size = positiveNumber(input.size)
  const speed = positiveNumber(input.speed)

  if (size === null) {
    return { result: null, error: input.size.trim() ? "File size must be greater than 0" : "" }
  }
  if (speed === null) {
    // the old code substituted 1 unit of speed here, which quietly invented a result
    return {
      result: null,
      error: input.speed.trim() ? "Transfer speed must be greater than 0" : "",
    }
  }

  const overheadText = input.overhead.trim()
  const overhead = overheadText === "" ? 0 : Number(overheadText)
  if (!Number.isFinite(overhead) || overhead < 0 || overhead >= 100) {
    return { result: null, error: "Protocol overhead must be at least 0% and under 100%" }
  }

  const sizeBytes = size * SIZE_MULTIPLIERS[input.sizeUnit]
  const nominalBitsPerSecond = speed * SPEED_TO_BPS[input.speedUnit]
  const effectiveBitsPerSecond = nominalBitsPerSecond * (1 - overhead / 100)
  const totalSeconds = (sizeBytes * 8) / effectiveBitsPerSecond

  return {
    result: {
      sizeBytes,
      nominalBitsPerSecond,
      effectiveBitsPerSecond,
      totalSeconds,
      formatted: formatTransferDuration(totalSeconds),
    },
    error: "",
  }
}

export interface DownloadSizeResult {
  seconds: number
  bitsPerSecond: number
  totalBytes: number
}

export function computeDownloadSize(input: {
  time: string
  timeUnit: TimeUnit
  speed: string
  speedUnit: SpeedUnit
}): Computed<DownloadSizeResult> {
  const time = positiveNumber(input.time)
  const speed = positiveNumber(input.speed)

  if (time === null) {
    return { result: null, error: input.time.trim() ? "Time must be greater than 0" : "" }
  }
  if (speed === null) {
    return {
      result: null,
      error: input.speed.trim() ? "Download speed must be greater than 0" : "",
    }
  }

  const seconds = time * TIME_TO_SECONDS[input.timeUnit]
  const bitsPerSecond = speed * SPEED_TO_BPS[input.speedUnit]

  return {
    result: { seconds, bitsPerSecond, totalBytes: (bitsPerSecond * seconds) / 8 },
    error: "",
  }
}

export function convertSpeed(value: string, from: SpeedUnit): Record<SpeedUnit, number> | null {
  if (!value.trim()) return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null

  const bitsPerSecond = amount * SPEED_TO_BPS[from]
  const out = {} as Record<SpeedUnit, number>
  for (const unit of SPEED_UNITS) {
    out[unit] = bitsPerSecond / SPEED_TO_BPS[unit]
  }
  return out
}

export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "n/a"
  if (value === 0) return "0"
  return value.toLocaleString("en-US", { maximumSignificantDigits: 6 })
}
