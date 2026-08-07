// timestamp parsing/formatting helpers. pure functions so they can be tested
// without a dom, and so the component never re-implements unit math inline.
import { zonedTimeToEpochMs } from "@/lib/timezones"

export type TimestampUnit = "s" | "ms" | "us" | "ns" | "filetime" | "ticks" | "cocoa" | "excel"

export type TimestampKind = "numeric" | "iso" | "text"

export interface TimestampUnitMeta {
  id: TimestampUnit
  label: string
  hint: string
  /** auto-detect only ranks the plain unix scales; the rest need an explicit pick */
  autoDetectable: boolean
}

export const TIMESTAMP_UNITS: TimestampUnitMeta[] = [
  { id: "s", label: "Seconds", hint: "unix epoch seconds", autoDetectable: true },
  { id: "ms", label: "Milliseconds", hint: "unix epoch ms (java, js)", autoDetectable: true },
  {
    id: "us",
    label: "Microseconds",
    hint: "unix epoch µs (postgres, chrome)",
    autoDetectable: true,
  },
  {
    id: "ns",
    label: "Nanoseconds",
    hint: "unix epoch ns (go, prometheus, cassandra)",
    autoDetectable: true,
  },
  {
    id: "filetime",
    label: "Windows FILETIME",
    hint: "100ns ticks since 1601-01-01",
    autoDetectable: false,
  },
  { id: "ticks", label: ".NET ticks", hint: "100ns ticks since 0001-01-01", autoDetectable: false },
  { id: "cocoa", label: "Apple/Cocoa", hint: "seconds since 2001-01-01", autoDetectable: false },
  { id: "excel", label: "Excel serial", hint: "days since 1899-12-30", autoDetectable: false },
]

// epoch offsets in ms relative to 1970-01-01T00:00:00Z
const FILETIME_EPOCH_MS = -11644473600000
const NET_TICKS_EPOCH_MS = -62135596800000
const COCOA_EPOCH_MS = 978307200000
const EXCEL_EPOCH_DAYS = 25569
const MAX_DATE_MS = 8.64e15

const NUMERIC_RE = /^[+-]?(?:\d+|\d*\.\d+)$/
const ISO_RE =
  /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?\s*(Z|z|[+-]\d{2}:?\d{2})?)?$/

export function detectInputKind(input: string): TimestampKind | "empty" {
  const value = input.trim()
  if (!value) return "empty"
  if (NUMERIC_RE.test(value)) return "numeric"
  if (ISO_RE.test(value)) return "iso"
  return "text"
}

// classify on absolute value, or every pre-epoch ms/µs timestamp reads as seconds
export function detectUnit(value: number): Extract<TimestampUnit, "s" | "ms" | "us" | "ns"> {
  const abs = Math.abs(value)
  if (abs < 1e11) return "s"
  if (abs < 1e14) return "ms"
  if (abs < 1e17) return "us"
  return "ns"
}

export function unitToEpochMs(value: number, unit: TimestampUnit): number {
  switch (unit) {
    case "s":
      return value * 1000
    case "ms":
      return value
    case "us":
      return value / 1000
    case "ns":
      return value / 1e6
    case "filetime":
      return value / 10000 + FILETIME_EPOCH_MS
    case "ticks":
      return value / 10000 + NET_TICKS_EPOCH_MS
    case "cocoa":
      return value * 1000 + COCOA_EPOCH_MS
    case "excel":
      return (value - EXCEL_EPOCH_DAYS) * 86400000
  }
}

/** integer-exact large-unit rendering; ms * 1e6 overflows float precision for ns */
export function epochMsToUnitString(epochMs: number, unit: TimestampUnit): string {
  const whole = Math.trunc(epochMs)
  switch (unit) {
    case "s":
      return Math.floor(epochMs / 1000).toString()
    case "ms":
      return whole.toString()
    case "us":
      return (BigInt(whole) * 1000n).toString()
    case "ns":
      return (BigInt(whole) * 1000000n).toString()
    case "filetime":
      return (BigInt(whole - FILETIME_EPOCH_MS) * 10000n).toString()
    case "ticks":
      return (BigInt(whole - NET_TICKS_EPOCH_MS) * 10000n).toString()
    case "cocoa":
      return Math.floor((epochMs - COCOA_EPOCH_MS) / 1000).toString()
    case "excel":
      return (epochMs / 86400000 + EXCEL_EPOCH_DAYS).toFixed(6)
  }
}

export type TimestampParse =
  | {
      ok: true
      epochMs: number
      date: Date
      kind: TimestampKind
      unit: TimestampUnit | null
      autoDetected: boolean
      note: string | null
    }
  | { ok: false; error: string }

// ISO input without an offset resolves in `timeZone`, not the browser's ambient zone
export function parseTimestampInput(
  input: string,
  options: { unit?: TimestampUnit | "auto"; timeZone?: string } = {}
): TimestampParse {
  const value = input.trim()
  const kind = detectInputKind(value)
  if (kind === "empty")
    return { ok: false, error: "Enter a timestamp, ISO 8601 date, or date string" }

  const unitPref = options.unit ?? "auto"

  if (kind === "numeric") {
    const num = Number(value)
    if (!Number.isFinite(num)) return { ok: false, error: `"${value}" is not a finite number` }
    const autoDetected = unitPref === "auto"
    const unit = autoDetected ? detectUnit(num) : (unitPref as TimestampUnit)
    const epochMs = unitToEpochMs(num, unit)
    return finish(epochMs, kind, unit, autoDetected, null)
  }

  if (kind === "iso") {
    const m = ISO_RE.exec(value)!
    const hasOffset = Boolean(m[8])
    if (hasOffset) {
      const epochMs = Date.parse(value.replace(" ", "T"))
      if (Number.isNaN(epochMs))
        return { ok: false, error: `"${value}" is not a valid ISO 8601 date` }
      return finish(epochMs, kind, null, false, null)
    }
    const zone = options.timeZone
    const fields = {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4] ?? 0),
      minute: Number(m[5] ?? 0),
      second: Number(m[6] ?? 0),
    }
    if (fields.month < 1 || fields.month > 12 || fields.day < 1 || fields.day > 31) {
      return { ok: false, error: `"${value}" is not a valid ISO 8601 date` }
    }
    const fraction = m[7] ? Number(`0.${m[7]}`) * 1000 : 0
    const epochMs = zone
      ? zonedTimeToEpochMs(fields, zone) + fraction
      : Date.UTC(
          fields.year,
          fields.month - 1,
          fields.day,
          fields.hour,
          fields.minute,
          fields.second
        ) + fraction
    return finish(
      epochMs,
      kind,
      null,
      false,
      `No UTC offset in input - read as wall-clock time in ${zone ?? "UTC"}`
    )
  }

  const epochMs = Date.parse(value)
  if (Number.isNaN(epochMs)) {
    return { ok: false, error: `Could not read "${value}" as a timestamp or a date` }
  }
  return finish(epochMs, "text", null, false, "Parsed as a date string (RFC 2822 style)")
}

function finish(
  epochMs: number,
  kind: TimestampKind,
  unit: TimestampUnit | null,
  autoDetected: boolean,
  note: string | null
): TimestampParse {
  if (!Number.isFinite(epochMs)) return { ok: false, error: "Timestamp is not a finite instant" }
  if (Math.abs(epochMs) > MAX_DATE_MS) {
    return {
      ok: false,
      error: "Outside the range a date can represent (±8.64e15 ms from 1970) - check the unit",
    }
  }
  const date = new Date(epochMs)
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Invalid date" }
  return { ok: true, epochMs, date, kind, unit, autoDetected, note }
}

/** local wall-clock yyyy-mm-dd, never the UTC calendar date */
export function toLocalDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function toLocalTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${h}:${m}:${s}`
}

/** start of the local calendar day, offset by whole days - dst safe, unlike ±86400 */
export function startOfLocalDay(from: Date, dayOffset = 0): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + dayOffset, 0, 0, 0, 0)
}

export function formatRelativeToNow(epochMs: number, nowMs: number): string {
  const diff = epochMs - nowMs
  const abs = Math.abs(diff)
  const steps: Array<[number, string]> = [
    [31536000000, "year"],
    [2592000000, "month"],
    [604800000, "week"],
    [86400000, "day"],
    [3600000, "hour"],
    [60000, "minute"],
    [1000, "second"],
  ]
  for (const [size, label] of steps) {
    if (abs >= size) {
      const value = Math.round(abs / size)
      const plural = value === 1 ? label : `${label}s`
      return diff < 0 ? `${value} ${plural} ago` : `in ${value} ${plural}`
    }
  }
  return "now"
}
