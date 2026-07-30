import { describe, expect, it } from "vitest"
import {
  detectInputKind,
  detectUnit,
  epochMsToUnitString,
  formatRelativeToNow,
  parseTimestampInput,
  startOfLocalDay,
  toLocalDateInputValue,
  toLocalTimeInputValue,
  unitToEpochMs,
} from "@/lib/timestamp"
import { formatInZone, zonedTimeToEpochMs, zoneOffsetMs } from "@/lib/timezones"

describe("detectInputKind", () => {
  it("separates numbers, iso strings and loose date strings", () => {
    expect(detectInputKind("")).toBe("empty")
    expect(detectInputKind("   ")).toBe("empty")
    expect(detectInputKind("1609459200")).toBe("numeric")
    expect(detectInputKind("-14182940")).toBe("numeric")
    expect(detectInputKind("1609459200.5")).toBe("numeric")
    expect(detectInputKind("2021-01-01")).toBe("iso")
    expect(detectInputKind("2021-01-01T00:00:00Z")).toBe("iso")
    expect(detectInputKind("2021-01-01T00:00:00.123+05:30")).toBe("iso")
    expect(detectInputKind("Fri, 01 Jan 2021 00:00:00 GMT")).toBe("text")
  })
})

describe("detectUnit", () => {
  it("ranks positive values by magnitude", () => {
    expect(detectUnit(1609459200)).toBe("s")
    expect(detectUnit(1609459200000)).toBe("ms")
    expect(detectUnit(1609459200000000)).toBe("us")
    expect(detectUnit(1.7e18)).toBe("ns")
  })

  it("ranks negative values on absolute magnitude, not sign", () => {
    // a sign-blind `num > 9999999999` test called every pre-1970 ms/µs/ns
    // timestamp "seconds" and answered with a date thousands of years off
    expect(detectUnit(-1609459200)).toBe("s")
    expect(detectUnit(-1609459200000)).toBe("ms")
    expect(detectUnit(-1609459200000000)).toBe("us")
    expect(detectUnit(-1.7e18)).toBe("ns")
  })

  it("is symmetric around zero", () => {
    for (const value of [1, 1e6, 1609459200, 1.6e12, 1.6e15, 1.6e18]) {
      expect(detectUnit(value), String(value)).toBe(detectUnit(-value))
    }
  })
})

describe("parseTimestampInput", () => {
  it("parses iso 8601 with an explicit offset exactly", () => {
    // parseInt("2021-01-01T00:00:00Z") is 2021, which the old code read as seconds
    const result = parseTimestampInput("2021-01-01T00:00:00Z")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.epochMs).toBe(1609459200000)
    expect(result.kind).toBe("iso")
    expect(result.date.toISOString()).toBe("2021-01-01T00:00:00.000Z")
  })

  it("honours the offset in the iso string", () => {
    const result = parseTimestampInput("2021-01-01T05:30:00+05:30")
    expect(result.ok && result.epochMs).toBe(1609459200000)
  })

  it("reads offset-less iso input in the selected zone and says so", () => {
    const result = parseTimestampInput("2021-01-01T00:00:00", { timeZone: "America/New_York" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.epochMs).toBe(1609477200000) // 05:00Z
    expect(result.note).toMatch(/America\/New_York/)
  })

  it("treats a bare iso date as midnight in the selected zone", () => {
    const utc = parseTimestampInput("2021-01-01", { timeZone: "UTC" })
    const tokyo = parseTimestampInput("2021-01-01", { timeZone: "Asia/Tokyo" })
    expect(utc.ok && utc.epochMs).toBe(1609459200000)
    expect(tokyo.ok && tokyo.epochMs).toBe(1609459200000 - 9 * 3600 * 1000)
  })

  it("parses rfc 2822 and loose date strings", () => {
    const rfc = parseTimestampInput("Fri, 01 Jan 2021 00:00:00 GMT")
    expect(rfc.ok && rfc.epochMs).toBe(1609459200000)
    expect(rfc.ok && rfc.kind).toBe("text")
    expect(parseTimestampInput("January 1, 2021 00:00:00 UTC").ok).toBe(true)
  })

  it("auto-detects nanoseconds instead of dividing them into the year 55 million", () => {
    const result = parseTimestampInput("1700000000000000000")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.unit).toBe("ns")
    expect(result.date.toISOString()).toBe("2023-11-14T22:13:20.000Z")
  })

  it("auto-detects seconds, ms and µs", () => {
    for (const input of ["1609459200", "1609459200000", "1609459200000000"]) {
      const result = parseTimestampInput(input)
      expect(result.ok && result.date.toISOString(), input).toBe("2021-01-01T00:00:00.000Z")
    }
  })

  it("keeps a pre-1970 ms timestamp in ms", () => {
    const result = parseTimestampInput("-1609459200000")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.unit).toBe("ms")
    expect(result.date.toISOString()).toBe("1919-01-01T00:00:00.000Z")
  })

  it("honours an explicit unit over auto-detection", () => {
    const result = parseTimestampInput("1609459200", { unit: "ms" })
    expect(result.ok && result.unit).toBe("ms")
    expect(result.ok && result.date.toISOString()).toBe("1970-01-19T15:04:19.200Z")
  })

  it("converts vendor epochs", () => {
    const cases: Array<[string, Parameters<typeof parseTimestampInput>[1], string]> = [
      ["132539328000000000", { unit: "filetime" }, "2021-01-01T00:00:00.000Z"],
      ["637450560000000000", { unit: "ticks" }, "2021-01-01T00:00:00.000Z"],
      ["631152000", { unit: "cocoa" }, "2021-01-01T00:00:00.000Z"],
      ["44197", { unit: "excel" }, "2021-01-01T00:00:00.000Z"],
    ]
    for (const [input, options, expected] of cases) {
      const result = parseTimestampInput(input, options)
      expect(result.ok && result.date.toISOString(), input).toBe(expected)
    }
  })

  it("rejects junk and out-of-range values with a message", () => {
    for (const input of ["", "   ", "not a date", "2021-13-45", "1e999"]) {
      const result = parseTimestampInput(input)
      expect(result.ok, input).toBe(false)
      if (!result.ok) expect(result.error, input).toBeTruthy()
    }
    const huge = parseTimestampInput("999999999999999999999", { unit: "ms" })
    expect(huge.ok).toBe(false)
    if (!huge.ok) expect(huge.error).toMatch(/range/i)
  })
})

describe("unit round trips", () => {
  it("survives ms -> unit -> ms for every scale", () => {
    const epochMs = 1609459200000
    for (const unit of ["s", "ms", "us", "ns", "filetime", "ticks", "cocoa", "excel"] as const) {
      const asString = epochMsToUnitString(epochMs, unit)
      const back = unitToEpochMs(Number(asString), unit)
      expect(Math.abs(back - epochMs), `${unit}: ${asString}`).toBeLessThan(1)
    }
  })

  it("renders large scales without float rounding", () => {
    expect(epochMsToUnitString(1609459200000, "ns")).toBe("1609459200000000000")
    expect(epochMsToUnitString(1609459200000, "us")).toBe("1609459200000000")
    expect(epochMsToUnitString(1609459200000, "filetime")).toBe("132539328000000000")
    expect(epochMsToUnitString(1609459200000, "ticks")).toBe("637450560000000000")
  })
})

describe("local wall-clock helpers", () => {
  it("takes the date and the time from the same local clock", () => {
    // toISOString().split("T")[0] mixed with toTimeString() shifts the date by a
    // day every evening west of utc
    for (const hour of [0, 6, 12, 18, 23]) {
      const date = new Date(2021, 0, 1, hour, 30, 15)
      const roundTrip = new Date(`${toLocalDateInputValue(date)}T${toLocalTimeInputValue(date)}`)
      expect(roundTrip.getTime(), `hour ${hour}`).toBe(date.getTime())
    }
  })

  it("keeps startOfLocalDay at local midnight across a whole year, dst included", () => {
    const start = new Date(2026, 0, 1, 12, 0, 0)
    for (let day = 0; day < 400; day++) {
      const midnight = startOfLocalDay(start, day)
      expect(midnight.getHours(), `day ${day}`).toBe(0)
      expect(midnight.getMinutes()).toBe(0)
      expect(midnight.getSeconds()).toBe(0)
    }
  })
})

describe("zone math", () => {
  it("maps wall-clock fields to the right instant on both sides of dst", () => {
    expect(zonedTimeToEpochMs({ year: 2021, month: 1, day: 1, hour: 0 }, "UTC")).toBe(1609459200000)
    expect(zonedTimeToEpochMs({ year: 2021, month: 1, day: 1, hour: 0 }, "America/New_York")).toBe(
      1609477200000
    )
    expect(zonedTimeToEpochMs({ year: 2021, month: 7, day: 1, hour: 12 }, "America/New_York")).toBe(
      Date.UTC(2021, 6, 1, 16, 0, 0)
    )
  })

  it("reports offsets east and west of utc", () => {
    const summer = Date.UTC(2021, 6, 1)
    expect(zoneOffsetMs(summer, "UTC")).toBe(0)
    expect(zoneOffsetMs(summer, "America/New_York")).toBe(-4 * 3600 * 1000)
    expect(zoneOffsetMs(summer, "Asia/Kolkata")).toBe(5.5 * 3600 * 1000)
    expect(zoneOffsetMs(Date.UTC(2021, 0, 1), "America/New_York")).toBe(-5 * 3600 * 1000)
  })
})

describe("formatRelativeToNow", () => {
  it("describes both directions", () => {
    const now = 1609459200000
    expect(formatRelativeToNow(now, now)).toBe("now")
    expect(formatRelativeToNow(now - 3600000, now)).toBe("1 hour ago")
    expect(formatRelativeToNow(now + 7200000, now)).toBe("in 2 hours")
    expect(formatRelativeToNow(now + 31536000000, now)).toBe("in 1 year")
  })
})

describe("a wall clock inside a spring-forward gap resolves forward", () => {
  it("returns 03:30 EDT, not 01:30 EST, for a 02:30 that never happens", () => {
    // 2026-03-08 02:00-03:00 does not exist in new york. the two-pass zone
    // solver settled on 06:30Z, which reads back as 01:30 EST: an hour BEFORE
    // the wall clock that was asked for. java.time's ZonedDateTime.of and
    // Temporal's "compatible" disambiguation both push forward instead.
    const parsed = parseTimestampInput("2026-03-08T02:30:00", { timeZone: "America/New_York" })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.date.toISOString()).toBe("2026-03-08T07:30:00.000Z")
    expect(formatInZone(parsed.date, "America/New_York")).toContain("03:30")
  })

  it("picks the first of the two occurrences when fall-back repeats an hour", () => {
    // 2026-11-01 01:30 happens twice in new york; the earlier one is EDT
    const epochMs = zonedTimeToEpochMs(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      "America/New_York"
    )
    expect(new Date(epochMs).toISOString()).toBe("2026-11-01T05:30:00.000Z")
  })

  it("still round trips every ordinary wall clock, all year, in four zones", () => {
    for (const zone of ["America/New_York", "Europe/London", "Australia/Sydney", "Asia/Kolkata"]) {
      for (let day = 1; day <= 365; day++) {
        const probe = new Date(Date.UTC(2026, 0, day, 12))
        const fields = {
          year: probe.getUTCFullYear(),
          month: probe.getUTCMonth() + 1,
          day: probe.getUTCDate(),
          hour: 12,
          minute: 0,
          second: 0,
        }
        const instant = zonedTimeToEpochMs(fields, zone)
        const label = `${zone} ${fields.year}-${fields.month}-${fields.day}`
        expect(formatInZone(new Date(instant), zone), label).toContain("12:00:00")
      }
    }
  })
})
