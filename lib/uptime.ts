// availability -> allowed downtime arithmetic.
//
// two things this module exists to keep honest:
//   1. a period is a stated number of seconds, never a vague "month". a 30-day
//      month and a 365-day year are what the figures below are computed from,
//      and the labels say so.
//   2. duration formatting carries properly. rounding minutes independently of
//      hours printed "1h 60m" for 119.8 minutes.

export type UptimePeriod = "day" | "week" | "month" | "quarter" | "year"

export interface PeriodMeta {
  id: UptimePeriod
  label: string
  /** exact seconds in the period, from the day count the label states */
  seconds: number
  days: number
}

export const UPTIME_PERIODS: PeriodMeta[] = [
  { id: "day", label: "Day (24h)", days: 1, seconds: 86400 },
  { id: "week", label: "Week (7d)", days: 7, seconds: 604800 },
  { id: "month", label: "Month (30d)", days: 30, seconds: 2592000 },
  { id: "quarter", label: "Quarter (90d)", days: 90, seconds: 7776000 },
  { id: "year", label: "Year (365d)", days: 365, seconds: 31536000 },
]

const PERIOD_BY_ID = new Map(UPTIME_PERIODS.map((p) => [p.id, p]))

export function findPeriod(id: string): PeriodMeta | null {
  return PERIOD_BY_ID.get(id as UptimePeriod) ?? null
}

export interface SLALevel {
  /** how many nines, as written on a slide */
  nines: string
  percentage: number
  label: string
  typical: string
}

export const SLA_LEVELS: SLALevel[] = [
  { nines: "1", percentage: 90, label: "One Nine", typical: "Internal tools" },
  { nines: "2", percentage: 99, label: "Two Nines", typical: "Basic hosting" },
  { nines: "2.5", percentage: 99.5, label: "Two and a Half Nines", typical: "Shared hosting" },
  { nines: "3", percentage: 99.9, label: "Three Nines", typical: "Standard SaaS" },
  { nines: "3.5", percentage: 99.95, label: "Three and a Half Nines", typical: "Paid SaaS tier" },
  { nines: "4", percentage: 99.99, label: "Four Nines", typical: "Enterprise" },
  { nines: "5", percentage: 99.999, label: "Five Nines", typical: "Carrier-grade" },
  { nines: "6", percentage: 99.9999, label: "Six Nines", typical: "Mission critical" },
]

/**
 * downtime seconds allowed by an availability percentage over a period.
 * unavailability is taken as (100 - p) / 100 rather than 1 - p/100 so the
 * subtraction happens before the division and loses fewer bits.
 */
export function downtimeSeconds(availabilityPercent: number, periodSeconds: number): number {
  return (periodSeconds * (100 - availabilityPercent)) / 100
}

/** the "nines" count a percentage actually earns: 99.9 -> 3 */
export function ninesOf(availabilityPercent: number): number {
  const unavailable = (100 - availabilityPercent) / 100
  if (unavailable <= 0) return Infinity
  if (unavailable >= 1) return 0
  return -Math.log10(unavailable)
}

/** the highest tabulated level a percentage meets, or null when it meets none */
export function slaLevelFor(availabilityPercent: number): SLALevel | null {
  let best: SLALevel | null = null
  for (const level of SLA_LEVELS) {
    if (availabilityPercent >= level.percentage) best = level
  }
  return best
}

/**
 * Round to whole seconds first, then decompose. Decomposing before rounding is
 * what produced "1h 60m": 119.8 min floors to 1h and rounds 59.8 min to 60.
 */
export function formatDowntime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-"
  if (seconds <= 0) return "0s"
  if (seconds < 1) return `${seconds.toFixed(3)}s`
  if (seconds < 60) return `${Number(seconds.toFixed(2))}s`

  const total = Math.round(seconds)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0 || parts.length > 0) parts.push(`${h}h`)
  if (m > 0 || parts.length > 0) parts.push(`${m}m`)
  parts.push(`${s}s`)
  // three units is enough resolution at every scale this tool produces
  return parts.slice(0, 3).join(" ")
}

export interface UptimeAnalysis {
  availabilityPercent: number
  nines: number
  level: SLALevel | null
  /** downtime seconds for every period, keyed by period id */
  byPeriod: { period: PeriodMeta; seconds: number }[]
}

export function analyzeUptime(availabilityPercent: number): UptimeAnalysis | null {
  if (!Number.isFinite(availabilityPercent)) return null
  if (availabilityPercent < 0 || availabilityPercent > 100) return null
  return {
    availabilityPercent,
    nines: ninesOf(availabilityPercent),
    level: slaLevelFor(availabilityPercent),
    byPeriod: UPTIME_PERIODS.map((period) => ({
      period,
      seconds: downtimeSeconds(availabilityPercent, period.seconds),
    })),
  }
}

/** inverse direction: what availability a downtime budget buys over a period */
export function availabilityFor(downtimeSecs: number, periodSeconds: number): number {
  if (periodSeconds <= 0) return 0
  return ((periodSeconds - downtimeSecs) / periodSeconds) * 100
}
