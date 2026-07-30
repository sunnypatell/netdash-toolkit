import { describe, expect, it } from "vitest"
import {
  cleanHostname,
  coversHost,
  daysUntil,
  sortIssuancesByExpiry,
  type CtIssuance,
} from "@/lib/cert-transparency"

describe("cleanHostname", () => {
  it("reduces anything the user pastes to a hostname", () => {
    expect(cleanHostname("HTTPS://Example.com:8443/path?q=1")).toBe("example.com")
    expect(cleanHostname("  example.com  ")).toBe("example.com")
  })
})

describe("coversHost (rfc 6125 6.4.3)", () => {
  it("matches an exact name", () => {
    expect(coversHost(["example.com"], "example.com")).toBe(true)
  })

  it("lets a wildcard cover exactly one label", () => {
    expect(coversHost(["*.example.com"], "www.example.com")).toBe(true)
    expect(coversHost(["*.example.com"], "a.b.example.com")).toBe(false)
    expect(coversHost(["*.example.com"], "example.com")).toBe(false)
  })

  it("is false for an unrelated name and for no names at all", () => {
    expect(coversHost(["other.com"], "example.com")).toBe(false)
    expect(coversHost(undefined, "example.com")).toBe(false)
  })
})

describe("daysUntil", () => {
  it("counts forward and backward from a fixed now", () => {
    const now = Date.parse("2026-01-01T00:00:00Z")
    expect(daysUntil("2026-01-31T00:00:00Z", now)).toBe(30)
    expect(daysUntil("2025-12-02T00:00:00Z", now)).toBe(-30)
  })

  it("returns null rather than a number it cannot justify", () => {
    expect(daysUntil(undefined)).toBeNull()
    expect(daysUntil("not a date")).toBeNull()
  })
})

describe("sortIssuancesByExpiry", () => {
  it("puts the newest expiry first without mutating the input", () => {
    const input: CtIssuance[] = [
      { id: "a", not_after: "2026-01-01T00:00:00Z" },
      { id: "b", not_after: "2027-01-01T00:00:00Z" },
    ]
    expect(sortIssuancesByExpiry(input).map((c) => c.id)).toEqual(["b", "a"])
    expect(input.map((c) => c.id)).toEqual(["a", "b"])
  })
})
