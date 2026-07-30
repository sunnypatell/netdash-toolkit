import { describe, expect, it, vi } from "vitest"
import {
  attemptHttpProbe,
  describeTransport,
  formatProbeError,
  parsePingTarget,
  transportForUrl,
} from "@/lib/browser-ping"

describe("parsePingTarget", () => {
  it("defaults a bare host to the page's own scheme", () => {
    expect(parsePingTarget("example.com", true)?.urls).toEqual(["https://example.com"])
    expect(parsePingTarget("example.com", false)?.urls).toEqual([
      "http://example.com",
      "https://example.com",
    ])
  })

  it("says so when it had to drop the http probe the user asked for", () => {
    const target = parsePingTarget("http://example.com", true)
    // the https attempt is still worth making, but the user asked for http
    expect(target?.urls).toEqual(["https://example.com"])
    expect(target?.insecureDropped).toBe(true)
  })

  it("does not claim a drop when the user never asked for http", () => {
    expect(parsePingTarget("example.com", true)?.insecureDropped).toBe(false)
    expect(parsePingTarget("https://example.com", true)?.insecureDropped).toBe(false)
  })

  it("keeps an explicit http target on an http page", () => {
    expect(parsePingTarget("http://example.com", false)?.urls).toEqual([
      "http://example.com",
      "https://example.com",
    ])
  })

  it("brackets a bare ipv6 literal", () => {
    const target = parsePingTarget("2001:db8::1", true)
    expect(target?.urls).toEqual(["https://[2001:db8::1]"])
    expect(target?.displayHost).toBe("[2001:db8::1]")
  })

  it("keeps a port in the display label", () => {
    expect(parsePingTarget("example.com:8443", true)?.displayHost).toBe("example.com:8443")
  })

  it("rejects a scheme that cannot be fetched", () => {
    expect(parsePingTarget("ftp://example.com", false)).toBeNull()
    expect(parsePingTarget("   ", false)).toBeNull()
  })
})

describe("transport labelling", () => {
  it("never calls an http round trip an icmp round trip", () => {
    expect(transportForUrl("https://example.com")).toBe("https-round-trip")
    expect(transportForUrl("http://example.com")).toBe("http-round-trip")
    expect(describeTransport("https-round-trip")).toMatch(/TLS handshake/)
    expect(describeTransport("icmp")).toMatch(/ICMP echo/)
  })
})

describe("attemptHttpProbe", () => {
  it("falls back from HEAD to GET and records which one answered", async () => {
    const probe = vi.fn(async (_url: string, method: "HEAD" | "GET") => {
      if (method === "HEAD") throw new Error("405")
    })
    let ticks = 0
    const outcome = await attemptHttpProbe("https://example.com", probe, () => (ticks += 3))
    expect(outcome.success).toBe(true)
    expect(outcome.methodUsed).toBe("GET")
    expect(outcome.methodFallback).toBe(true)
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it("keeps the last error when both methods fail", async () => {
    const outcome = await attemptHttpProbe("https://example.com", async () => {
      throw new DOMException("aborted", "AbortError")
    })
    expect(outcome.success).toBe(false)
    expect(formatProbeError(outcome.error)).toBe("Request timed out")
  })

  it("does not try GET when HEAD already answered", async () => {
    const probe = vi.fn(async () => undefined)
    const outcome = await attemptHttpProbe("https://example.com", probe)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(outcome.methodUsed).toBe("HEAD")
    expect(outcome.methodFallback).toBe(false)
  })
})

describe("formatProbeError", () => {
  it("never claims to know why a no-cors probe failed", () => {
    expect(formatProbeError({})).toMatch(/unreachable, blocked, or not answering/)
    expect(formatProbeError(new Error("Failed to fetch"))).toBe("Failed to fetch")
  })
})
