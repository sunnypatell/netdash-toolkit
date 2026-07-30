import { describe, expect, it } from "vitest"
import {
  SLA_LEVELS,
  UPTIME_PERIODS,
  analyzeUptime,
  availabilityFor,
  downtimeSeconds,
  formatDowntime,
  ninesOf,
  slaLevelFor,
} from "@/lib/uptime"

// the figures below are the ones on every SLA cheat sheet, derived from the
// period length each label states rather than copied out of the implementation.

const seconds = (id: string) => UPTIME_PERIODS.find((p) => p.id === id)!.seconds

describe("period lengths match their labels", () => {
  it("derives seconds from the stated day count", () => {
    for (const period of UPTIME_PERIODS) {
      expect(period.seconds, period.label).toBe(period.days * 86400)
    }
  })
})

describe("downtime arithmetic", () => {
  it("matches the canonical per-year figures", () => {
    expect(downtimeSeconds(90, seconds("year"))).toBeCloseTo(3153600, 3) // 36d 12h
    expect(downtimeSeconds(99, seconds("year"))).toBeCloseTo(315360, 3) // 3d 15h 36m
    expect(downtimeSeconds(99.9, seconds("year"))).toBeCloseTo(31536, 3) // 8h 45m 36s
    expect(downtimeSeconds(99.99, seconds("year"))).toBeCloseTo(3153.6, 3) // 52m 33.6s
    expect(downtimeSeconds(99.999, seconds("year"))).toBeCloseTo(315.36, 4) // 5m 15.36s
    expect(downtimeSeconds(99.9999, seconds("year"))).toBeCloseTo(31.536, 5)
  })

  it("matches the canonical per-30-day-month figures", () => {
    expect(downtimeSeconds(99.9, seconds("month"))).toBeCloseTo(2592, 4) // 43m 12s
    expect(downtimeSeconds(99.99, seconds("month"))).toBeCloseTo(259.2, 5)
    expect(downtimeSeconds(99.95, seconds("month"))).toBeCloseTo(1296, 4)
  })

  it("scales linearly across periods", () => {
    for (const p of [90, 99, 99.9, 99.99]) {
      const perDay = downtimeSeconds(p, seconds("day"))
      expect(downtimeSeconds(p, seconds("week"))).toBeCloseTo(perDay * 7, 6)
      expect(downtimeSeconds(p, seconds("year"))).toBeCloseTo(perDay * 365, 6)
    }
  })

  it("is zero at 100% and the whole period at 0%", () => {
    expect(downtimeSeconds(100, seconds("year"))).toBe(0)
    expect(downtimeSeconds(0, seconds("year"))).toBe(seconds("year"))
  })

  it("inverts back to the availability it came from", () => {
    for (const p of [90, 99, 99.9, 99.99, 99.999]) {
      const down = downtimeSeconds(p, seconds("month"))
      expect(availabilityFor(down, seconds("month"))).toBeCloseTo(p, 9)
    }
  })
})

describe("the nines figures match the actual percentages", () => {
  it("counts nines as -log10 of the unavailability", () => {
    expect(ninesOf(90)).toBeCloseTo(1, 9)
    expect(ninesOf(99)).toBeCloseTo(2, 9)
    expect(ninesOf(99.9)).toBeCloseTo(3, 9)
    expect(ninesOf(99.99)).toBeCloseTo(4, 9)
    expect(ninesOf(99.999)).toBeCloseTo(5, 9)
    expect(ninesOf(99.9999)).toBeCloseTo(6, 9)
    expect(ninesOf(100)).toBe(Infinity)
    expect(ninesOf(0)).toBe(0)
  })

  it("labels every whole-nines level with the count its percentage earns", () => {
    for (const level of SLA_LEVELS.filter((l) => !l.nines.includes("."))) {
      expect(ninesOf(level.percentage), level.label).toBeCloseTo(Number(level.nines), 9)
    }
  })

  it("keeps the level table ascending, so the best match is the last one that fits", () => {
    for (let i = 1; i < SLA_LEVELS.length; i++) {
      expect(SLA_LEVELS[i].percentage).toBeGreaterThan(SLA_LEVELS[i - 1].percentage)
    }
  })

  it("picks the highest level a percentage actually meets", () => {
    expect(slaLevelFor(99.9)?.nines).toBe("3")
    expect(slaLevelFor(99.95)?.nines).toBe("3.5")
    expect(slaLevelFor(99.94)?.nines).toBe("3")
    expect(slaLevelFor(100)?.nines).toBe("6")
    expect(slaLevelFor(50)).toBeNull()
  })
})

describe("duration formatting carries between units", () => {
  it("never prints 60 minutes or 24 hours", () => {
    // 119.8 minutes used to render as "1h 60m": the minutes were rounded
    // independently of the hours they belong to
    expect(formatDowntime(119.8 * 60)).toBe("1h 59m 48s")
    expect(formatDowntime(86399.6)).toBe("1d 0h 0m")
    for (let s = 0; s < 200000; s += 7) {
      const text = formatDowntime(s)
      expect(text, `${s}s -> ${text}`).not.toMatch(/\b60m\b/)
      expect(text, `${s}s -> ${text}`).not.toMatch(/\b24h\b/)
      expect(text, `${s}s -> ${text}`).not.toMatch(/\b60s\b/)
    }
  })

  it("renders the canonical SLA durations", () => {
    expect(formatDowntime(31536)).toBe("8h 45m 36s")
    expect(formatDowntime(315360)).toBe("3d 15h 36m")
    expect(formatDowntime(3153.6)).toBe("52m 34s")
    expect(formatDowntime(315.36)).toBe("5m 15s")
    expect(formatDowntime(31.536)).toBe("31.54s")
    expect(formatDowntime(3153600)).toBe("36d 12h 0m")
  })

  it("handles the ends of the range", () => {
    expect(formatDowntime(0)).toBe("0s")
    expect(formatDowntime(0.5)).toBe("0.500s")
    expect(formatDowntime(NaN)).toBe("-")
  })
})

describe("analyzeUptime", () => {
  it("reports every period at once", () => {
    const result = analyzeUptime(99.9)!
    expect(result.byPeriod).toHaveLength(UPTIME_PERIODS.length)
    expect(result.byPeriod.find((p) => p.period.id === "year")!.seconds).toBeCloseTo(31536, 3)
    expect(result.level?.nines).toBe("3")
    expect(result.nines).toBeCloseTo(3, 9)
  })

  it("refuses percentages that are not percentages", () => {
    expect(analyzeUptime(-1)).toBeNull()
    expect(analyzeUptime(100.1)).toBeNull()
    expect(analyzeUptime(NaN)).toBeNull()
  })
})
