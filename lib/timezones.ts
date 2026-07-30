// iana timezone helpers built on Intl only - no date library, zero bundle cost.

const FALLBACK_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
]

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function listTimeZones(): string[] {
  let zones: string[] = []
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      zones = Intl.supportedValuesOf("timeZone")
    }
  } catch {
    zones = []
  }
  if (zones.length === 0) zones = FALLBACK_ZONES
  const local = localTimeZone()
  const seen = new Set<string>()
  const ordered: string[] = []
  // pinning UTC and the ambient zone to the top keeps the common picks reachable
  for (const zone of ["UTC", local, ...zones]) {
    if (zone && !seen.has(zone)) {
      seen.add(zone)
      ordered.push(zone)
    }
  }
  return ordered
}

interface ZoneParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(utcMs: number, timeZone: string): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs))

  const bag: Record<string, string> = {}
  for (const part of parts) bag[part.type] = part.value

  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour) % 24,
    minute: Number(bag.minute),
    second: Number(bag.second),
  }
}

/** offset of `timeZone` at the given instant, in ms east of UTC */
export function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = zonedParts(utcMs, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/** wall-clock fields in `timeZone` -> epoch ms. two passes so dst transitions land right. */
export function zonedTimeToEpochMs(
  fields: {
    year: number
    month: number
    day: number
    hour?: number
    minute?: number
    second?: number
  },
  timeZone: string
): number {
  const guess = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour ?? 0,
    fields.minute ?? 0,
    fields.second ?? 0
  )
  const first = guess - zoneOffsetMs(guess, timeZone)
  const second = guess - zoneOffsetMs(first, timeZone)
  return second
}

export function formatOffset(offsetMs: number): string {
  const sign = offsetMs < 0 ? "-" : "+"
  const total = Math.abs(Math.round(offsetMs / 60000))
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/** full date + time + offset name in a specific zone. dateStyle/timeStyle cannot carry timeZoneName. */
export function formatInZone(
  date: Date,
  timeZone: string,
  options: { seconds?: boolean; weekday?: boolean; offsetName?: boolean } = {}
): string {
  const { seconds = true, weekday = true, offsetName = true } = options
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: weekday ? "short" : undefined,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: seconds ? "2-digit" : undefined,
      timeZoneName: offsetName ? "longOffset" : undefined,
    }).format(date)
  } catch {
    return date.toISOString()
  }
}
