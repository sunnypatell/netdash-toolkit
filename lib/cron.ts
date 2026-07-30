// cron parsing is delegated: cronstrue for the english description, croner for
// next-run projection (zero deps, real iana timezone support, posix dom/dow OR).
// the base cronstrue entry is imported on purpose - cronstrue/i18n drags in 31kB
// of locales we never show.
import { Cron } from "croner"
import cronstrue from "cronstrue"

export type CronFieldRole =
  "second" | "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek" | "year"

export interface CronField {
  role: CronFieldRole
  label: string
  short: string
  value: string
  range: string
}

export interface CronRun {
  date: Date
  /** ms until the run, relative to the instant the projection was made */
  inMs: number
}

export interface CronAnalysis {
  valid: boolean
  /** human description from cronstrue, null when it could not be described */
  description: string | null
  /** why the expression is unusable */
  error: string | null
  fields: CronField[]
  /** true for @daily / @reboot style shorthand, which has no field breakdown */
  macro: boolean
  runs: CronRun[]
  /** the expression was understood but no schedule could be projected */
  runsError: string | null
  timeZone: string
  /** expression actually handed to croner, after wrap-around ranges were expanded */
  normalized: string
}

const FIELD_META: Record<
  CronFieldRole,
  { label: string; short: string; min: number; max: number; range: string }
> = {
  second: { label: "second", short: "SEC", min: 0, max: 59, range: "0-59" },
  minute: { label: "minute", short: "MIN", min: 0, max: 59, range: "0-59" },
  hour: { label: "hour", short: "HOUR", min: 0, max: 23, range: "0-23" },
  dayOfMonth: { label: "day of month", short: "DOM", min: 1, max: 31, range: "1-31, L, W, ?" },
  month: { label: "month", short: "MON", min: 1, max: 12, range: "1-12, JAN-DEC" },
  dayOfWeek: { label: "day of week", short: "DOW", min: 0, max: 7, range: "0-7, SUN-SAT, #" },
  year: { label: "year", short: "YEAR", min: 1970, max: 2099, range: "1970-2099" },
}

const LAYOUTS: Record<number, CronFieldRole[]> = {
  5: ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"],
  6: ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"],
  7: ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek", "year"],
}

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
]
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

export const CRON_MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
  "@reboot": "",
}

export function isCronMacro(expression: string): boolean {
  return expression.trim().startsWith("@")
}

function resolveName(token: string, role: CronFieldRole): number | null {
  const lower = token.toLowerCase()
  if (role === "month") {
    const i = MONTH_NAMES.indexOf(lower)
    return i === -1 ? null : i + 1
  }
  if (role === "dayOfWeek") {
    const i = DAY_NAMES.indexOf(lower)
    return i === -1 ? null : i
  }
  return null
}

function resolveBound(token: string, role: CronFieldRole): number | null {
  if (/^\d{1,4}$/.test(token)) return Number(token)
  return resolveName(token, role)
}

/**
 * croner (like vixie cron) rejects a descending range such as `22-2`. posix
 * crontabs in the wild use them to mean "wrap past the end of the field", so
 * expand those to an explicit list before handing the expression over.
 */
export function expandWrapRanges(expression: string): string {
  const trimmed = expression.trim().replace(/\s+/g, " ")
  if (!trimmed || trimmed.startsWith("@")) return trimmed

  const parts = trimmed.split(" ")
  const layout = LAYOUTS[parts.length]
  if (!layout) return trimmed

  return parts
    .map((part, i) => {
      const role = layout[i]
      const meta = FIELD_META[role]
      return part
        .split(",")
        .map((token) => {
          const m = /^([A-Za-z]{3}|\d{1,4})-([A-Za-z]{3}|\d{1,4})(?:\/(\d+))?$/.exec(token)
          if (!m) return token
          const start = resolveBound(m[1], role)
          const end = resolveBound(m[2], role)
          const step = m[3] ? Number(m[3]) : 1
          if (start === null || end === null || step < 1) return token
          if (start <= end) return token
          // dow 7 is sunday; fold it so the walk stays inside 0-6
          const max = role === "dayOfWeek" ? 6 : meta.max
          const min = meta.min
          const from = role === "dayOfWeek" && start === 7 ? 0 : start
          const to = role === "dayOfWeek" && end === 7 ? 0 : end
          if (from <= to) return `${from}-${to}${m[3] ? `/${step}` : ""}`
          const values: number[] = []
          for (let v = from; v <= max; v += step) values.push(v)
          // keep the stride walking across the field boundary (max + 1 === min)
          const carry = (max - from) % step
          for (let v = min + (step - 1 - carry); v <= to; v += step) values.push(v)
          return values.length > 0 ? values.join(",") : token
        })
        .join(",")
    })
    .join(" ")
}

export function cronFields(expression: string): CronField[] {
  const trimmed = expression.trim().replace(/\s+/g, " ")
  if (!trimmed || trimmed.startsWith("@")) return []
  const parts = trimmed.split(" ")
  const layout = LAYOUTS[parts.length]
  if (!layout) return []
  return layout.map((role, i) => ({
    role,
    label: FIELD_META[role].label,
    short: FIELD_META[role].short,
    value: parts[i],
    range: FIELD_META[role].range,
  }))
}

function messageOf(err: unknown): string {
  // cronstrue throws bare strings, croner throws TypeError
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/^Error:\s*/, "")
    .replace(/^CronPattern:\s*/, "")
    .trim()
}

export function describeCron(expression: string): {
  description: string | null
  error: string | null
} {
  const trimmed = expression.trim()
  if (!trimmed) return { description: null, error: "Enter a cron expression" }
  try {
    const description = cronstrue.toString(trimmed, {
      throwExceptionOnParseError: true,
      use24HourTimeFormat: true,
      verbose: false,
    })
    return { description, error: null }
  } catch (err) {
    return { description: null, error: messageOf(err) || "Could not parse this cron expression" }
  }
}

export function nextCronRuns(
  expression: string,
  options: { timeZone?: string; count?: number; from?: Date | null } = {}
): { runs: CronRun[]; error: string | null } {
  const { timeZone, count = 5, from = new Date() } = options
  // null "from" means the caller has no clock yet (server render) - project nothing
  if (from === null) return { runs: [], error: null }
  const trimmed = expression.trim()
  if (!trimmed) return { runs: [], error: "Enter a cron expression" }
  if (/^@reboot$/i.test(trimmed)) {
    return {
      runs: [],
      error: "@reboot is event-based - it fires at startup, so there is no schedule to project",
    }
  }
  try {
    const job = new Cron(expandWrapRanges(trimmed), timeZone ? { timezone: timeZone } : {})
    const dates = job.nextRuns(count, from)
    if (dates.length === 0) {
      return { runs: [], error: "This expression matches no future date" }
    }
    return {
      runs: dates.map((date) => ({ date, inMs: date.getTime() - from.getTime() })),
      error: null,
    }
  } catch (err) {
    return { runs: [], error: messageOf(err) || "Could not project next runs" }
  }
}

export function analyzeCron(
  expression: string,
  options: { timeZone?: string; count?: number; from?: Date | null } = {}
): CronAnalysis {
  const trimmed = expression.trim().replace(/\s+/g, " ")
  const { description, error } = describeCron(trimmed)
  const { runs, error: runsError } = nextCronRuns(trimmed, options)
  // either engine understanding the expression is enough to call it usable
  const valid = description !== null || runs.length > 0

  return {
    valid,
    description,
    error: valid ? null : (error ?? runsError),
    fields: cronFields(trimmed),
    macro: isCronMacro(trimmed),
    runs,
    runsError: valid ? runsError : null,
    timeZone: options.timeZone ?? "UTC",
    normalized: expandWrapRanges(trimmed),
  }
}

export function formatRelativeMs(ms: number): string {
  const units: Array<[number, string]> = [
    [86400000, "d"],
    [3600000, "h"],
    [60000, "m"],
    [1000, "s"],
  ]
  let left = Math.abs(ms)
  const chunks: string[] = []
  for (const [size, suffix] of units) {
    const value = Math.floor(left / size)
    left -= value * size
    if (value === 0 && chunks.length === 0) continue
    chunks.push(`${value}${suffix}`)
    if (chunks.length === 2) break
  }
  if (chunks.length === 0) return "now"
  return ms < 0 ? `${chunks.join(" ")} ago` : `in ${chunks.join(" ")}`
}
