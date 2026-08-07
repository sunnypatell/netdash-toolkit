// single source for both unit ladders; the inline copies disagreed on KB vs KiB

// decimal (SI): 1 kB = 1000 B. binary (IEC): 1 KiB = 1024 B.
export const SI_BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"] as const
export const IEC_BYTE_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const

export function formatBytes(
  bytes: number,
  opts: { binary?: boolean; decimals?: number } = {}
): string {
  const { binary = true, decimals = 1 } = opts
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B"
  const base = binary ? 1024 : 1000
  const units = binary ? IEC_BYTE_UNITS : SI_BYTE_UNITS
  if (bytes < base) return `${bytes} B`
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1)
  return `${(bytes / base ** exp).toFixed(decimals)} ${units[exp]}`
}

// 1234567 -> "1.2M"; used for host counts and reference tables
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toString()
}

// milliseconds -> "1.2s" / "340ms" / "2m 05s"; shared by dns + network tester
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0ms"
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
}
