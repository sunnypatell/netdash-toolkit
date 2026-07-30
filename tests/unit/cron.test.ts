import { describe, expect, it } from "vitest"
import {
  analyzeCron,
  cronFields,
  describeCron,
  expandWrapRanges,
  formatRelativeMs,
  nextCronRuns,
} from "@/lib/cron"

// the old hand-rolled parser stepped one minute at a time for 1000 iterations,
// which is a 16h40m search window: any expression firing later than that
// returned nothing and the tool claimed the expression was invalid.
const FROM = new Date("2026-07-29T18:30:00Z")

function partsIn(date: Date, timeZone: string) {
  const bag: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date)) {
    bag[part.type] = part.value
  }
  return bag
}

describe("nextCronRuns", () => {
  it("projects weekday 09:00 runs far past the old 16h40m search window", () => {
    const { runs, error } = nextCronRuns("0 9 * * 1-5", {
      timeZone: "America/New_York",
      count: 5,
      from: FROM,
    })
    expect(error).toBeNull()
    expect(runs).toHaveLength(5)
    for (const run of runs) {
      const p = partsIn(run.date, "America/New_York")
      expect(`${p.hour}:${p.minute}`).toBe("09:00")
      expect(["Mon", "Tue", "Wed", "Thu", "Fri"]).toContain(p.weekday)
    }
    // strictly increasing
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].date.getTime()).toBeGreaterThan(runs[i - 1].date.getTime())
    }
  })

  it("projects the monthly preset, which is a month away not minutes", () => {
    const { runs, error } = nextCronRuns("0 0 1 * *", { timeZone: "UTC", count: 3, from: FROM })
    expect(error).toBeNull()
    expect(runs.map((r) => r.date.toISOString())).toEqual([
      "2026-08-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    ])
  })

  it("ORs day-of-month with day-of-week, as posix cron does", () => {
    const { runs } = nextCronRuns("0 0 13 * 5", { timeZone: "UTC", count: 6, from: FROM })
    const days = runs.map((r) => partsIn(r.date, "UTC"))
    // AND-ing would only ever produce Friday the 13th
    expect(days.some((p) => p.weekday === "Fri" && p.day !== "13")).toBe(true)
    expect(days.some((p) => p.day === "13")).toBe(true)
  })

  it("accepts 7 as a sunday alias", () => {
    const { runs, error } = nextCronRuns("0 9 * * 7", { timeZone: "UTC", count: 3, from: FROM })
    expect(error).toBeNull()
    expect(runs).toHaveLength(3)
    for (const run of runs) expect(partsIn(run.date, "UTC").weekday).toBe("Sun")
  })

  it("handles names, L, nth-weekday, ? and seconds", () => {
    for (const expression of [
      "0 0 * * MON-FRI",
      "0 0 1 JAN,APR,JUL,OCT *",
      "0 0 L * *",
      "0 0 * * 5#3",
      "0 0 ? * MON-FRI",
      "*/30 * * * * *",
      "0 0 0 1 1 * 2030",
    ]) {
      const { runs, error } = nextCronRuns(expression, { timeZone: "UTC", count: 2, from: FROM })
      expect(error, `${expression} failed: ${error}`).toBeNull()
      expect(runs.length, expression).toBeGreaterThan(0)
    }
  })

  it("resolves @daily and reports @reboot honestly instead of silently empty", () => {
    expect(nextCronRuns("@daily", { timeZone: "UTC", count: 1, from: FROM }).runs).toHaveLength(1)
    const reboot = nextCronRuns("@reboot", { timeZone: "UTC", count: 1, from: FROM })
    expect(reboot.runs).toHaveLength(0)
    expect(reboot.error).toMatch(/startup/i)
  })

  it("keeps a daily run at the same local wall clock across a dst transition", () => {
    // 2027-03-14 is spring forward in New York; naive local-hour arithmetic
    // duplicates or skips the run here
    const { runs } = nextCronRuns("0 3 * * *", {
      timeZone: "America/New_York",
      count: 4,
      from: new Date("2027-03-12T12:00:00Z"),
    })
    expect(runs).toHaveLength(4)
    for (const run of runs) {
      expect(partsIn(run.date, "America/New_York").hour).toBe("03")
    }
    const utcHours = runs.map((r) => r.date.getUTCHours())
    // the utc hour must shift when the offset changes, proving the zone is real
    expect(new Set(utcHours).size).toBe(2)
  })

  it("returns nothing without an error when the caller has no clock yet", () => {
    expect(nextCronRuns("0 9 * * 1-5", { from: null })).toEqual({ runs: [], error: null })
  })

  it("reports invalid expressions instead of silently returning nothing", () => {
    expect(nextCronRuns("not a cron", { from: FROM }).error).toBeTruthy()
    expect(nextCronRuns("", { from: FROM }).error).toBeTruthy()
  })
})

describe("expandWrapRanges", () => {
  it("expands descending ranges that vixie-style parsers reject", () => {
    expect(expandWrapRanges("0 22-2 * * *")).toBe("0 22,23,0,1,2 * * *")
    expect(expandWrapRanges("0 0 * * FRI-MON")).toBe("0 0 * * 5,6,0,1")
    expect(expandWrapRanges("0 0 * NOV-FEB *")).toBe("0 0 * 11,12,1,2 *")
  })

  it("keeps the stride when a step crosses the field boundary", () => {
    expect(expandWrapRanges("0 22-2/2 * * *")).toBe("0 22,0,2 * * *")
  })

  it("leaves ordinary expressions untouched", () => {
    for (const expression of [
      "0 9 * * 1-5",
      "*/15 * * * *",
      "0 0 L * *",
      "@daily",
      "0 0 * * 5#3",
    ]) {
      expect(expandWrapRanges(expression)).toBe(expression)
    }
  })

  it("collapses whitespace and survives junk", () => {
    expect(expandWrapRanges("  0   9 * * 1-5 ")).toBe("0 9 * * 1-5")
    expect(expandWrapRanges("nonsense")).toBe("nonsense")
  })

  it("makes wrap-around ranges actually schedulable", () => {
    const { runs, error } = nextCronRuns("0 22-2 * * *", { timeZone: "UTC", count: 5, from: FROM })
    expect(error).toBeNull()
    expect(runs.map((r) => r.date.getUTCHours())).toEqual([22, 23, 0, 1, 2])
  })
})

describe("describeCron", () => {
  it("describes plain and extended syntax", () => {
    expect(describeCron("0 9 * * 1-5").description).toMatch(/09:00/)
    expect(describeCron("0 0 L * *").description).toMatch(/last day/i)
    expect(describeCron("0 0 * * 5#3").description).toMatch(/third Friday/i)
    expect(describeCron("@reboot").description).toMatch(/startup/i)
    expect(describeCron("0 0 L-2 * *").description).toMatch(/2 days before/i)
  })

  it("surfaces an error string rather than throwing on junk", () => {
    const result = describeCron("nope")
    expect(result.description).toBeNull()
    expect(result.error).toBeTruthy()
    expect(describeCron("").error).toBeTruthy()
  })
})

describe("cronFields", () => {
  it("labels 5, 6 and 7 field layouts", () => {
    expect(cronFields("0 9 * * 1-5").map((f) => f.short)).toEqual([
      "MIN",
      "HOUR",
      "DOM",
      "MON",
      "DOW",
    ])
    expect(cronFields("*/30 * * * * *").map((f) => f.short)).toEqual([
      "SEC",
      "MIN",
      "HOUR",
      "DOM",
      "MON",
      "DOW",
    ])
    expect(cronFields("0 0 0 1 1 * 2030").map((f) => f.short)).toContain("YEAR")
    expect(cronFields("@daily")).toEqual([])
    expect(cronFields("1 2 3")).toEqual([])
  })
})

describe("analyzeCron", () => {
  it("reports a valid expression with a description and runs", () => {
    const result = analyzeCron("0 9 * * 1-5", { timeZone: "UTC", count: 5, from: FROM })
    expect(result.valid).toBe(true)
    expect(result.error).toBeNull()
    expect(result.runs).toHaveLength(5)
    expect(result.description).toBeTruthy()
  })

  it("stays valid when only the projection fails", () => {
    const result = analyzeCron("0 0 L-2 * *", { timeZone: "UTC", from: FROM })
    expect(result.valid).toBe(true)
    expect(result.description).toBeTruthy()
    expect(result.runsError).toBeTruthy()
  })

  it("is invalid, but does not throw, for junk and empty input", () => {
    for (const expression of ["", "   ", "x y z", "60 99 * * *"]) {
      const result = analyzeCron(expression, { from: FROM })
      expect(result.valid, expression).toBe(false)
      expect(result.error, expression).toBeTruthy()
      expect(result.runs, expression).toEqual([])
    }
  })
})

describe("formatRelativeMs", () => {
  it("renders two coarse units", () => {
    expect(formatRelativeMs(0)).toBe("now")
    expect(formatRelativeMs(90000)).toBe("in 1m 30s")
    expect(formatRelativeMs(90061000)).toBe("in 1d 1h")
    expect(formatRelativeMs(-3600000)).toBe("1h 0m ago")
  })
})
