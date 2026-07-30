import { describe, expect, it } from "vitest"
import {
  isIpv6,
  resolveCommandPath,
  validateDnsServer,
  validateHost,
  validatePorts,
} from "@/electron/network/validation"

// every string in this file is a shape check on the validator. nothing here is
// resolved, connected to or probed: these are the inputs that must never reach
// a command line, asserted as strings.

describe("validateHost", () => {
  it("accepts rfc 1123 hostnames, including internal hyphens", () => {
    for (const host of ["example.com", "my-host.example.com", "a", "a.b.c.d.e", "xn--80ak6aa92e"]) {
      const result = validateHost(host)
      expect(result.valid, host).toBe(true)
    }
  })

  it("lowercases hostnames so results dedupe consistently", () => {
    const result = validateHost("  Example.COM  ")
    expect(result).toEqual({ valid: true, sanitized: "example.com" })
  })

  it("accepts ipv4 literals and rejects ambiguous or out-of-range ones", () => {
    expect(validateHost("192.0.2.1").valid).toBe(true)
    expect(validateHost("255.255.255.255").valid).toBe(true)
    // leading zeros read as octal to some resolvers and decimal to others
    expect(validateHost("010.0.0.1").valid).toBe(false)
    expect(validateHost("256.0.0.1").valid).toBe(false)
    expect(validateHost("1.2.3").valid).toBe(false)
  })

  it("accepts ipv6 literals in every legal shape", () => {
    for (const address of [
      "::",
      "::1",
      "2001:db8::1",
      "2001:0db8:0000:0000:0000:0000:0000:0001",
      "fe80::1:2:3:4",
      "::ffff:192.0.2.1",
      "1:2:3:4:5:6:192.0.2.1",
    ]) {
      expect(isIpv6(address), address).toBe(true)
      expect(validateHost(address).valid, address).toBe(true)
    }
  })

  it("rejects malformed ipv6", () => {
    for (const address of [
      "1::2::3",
      "gggg::1",
      "1:2:3:4:5:6:7:8:9",
      "1:2:3:4:5:6:7",
      "192.0.2.1::1",
      ":1:2",
    ]) {
      expect(isIpv6(address), address).toBe(false)
    }
  })

  it("rejects a leading hyphen, which ping and traceroute would read as a flag", () => {
    expect(validateHost("-c").valid).toBe(false)
    expect(validateHost("--help").valid).toBe(false)
  })

  it("rejects anything outside the hostname and address alphabet", () => {
    // spawn runs without a shell, so none of these were ever interpreted; the
    // point is that a value that is not a host never reaches a command line
    const rejected = [
      "example.com;id",
      "example.com id",
      "example.com|id",
      "example.com&&id",
      "$(id).example.com",
      "example.com\nid",
      "example.com\u0000",
      "fe80::1%en0",
      "http://example.com",
      "example.com/../etc",
      "*",
    ]
    for (const host of rejected) {
      expect(validateHost(host).valid, JSON.stringify(host)).toBe(false)
    }
  })

  it("rejects non-strings and oversized input", () => {
    expect(validateHost(undefined).valid).toBe(false)
    expect(validateHost(42).valid).toBe(false)
    expect(validateHost({ toString: () => "example.com" }).valid).toBe(false)
    expect(validateHost("a".repeat(254)).valid).toBe(false)
  })
})

describe("validatePorts", () => {
  it("de-duplicates so a repeated port cannot multiply the connect attempts", () => {
    const result = validatePorts([80, 443, 80, 80, 443])
    expect(result).toEqual({ valid: true, sanitized: [80, 443] })
  })

  it("drops values that are not integer ports", () => {
    const result = validatePorts([80, 0, 65536, -1, 1.5, "443", null, 22])
    expect(result).toEqual({ valid: true, sanitized: [80, 22] })
  })

  it("bounds the list", () => {
    const tooMany = Array.from({ length: 4097 }, (_, i) => i + 1)
    expect(validatePorts(tooMany).valid).toBe(false)
    expect(validatePorts([]).valid).toBe(false)
    expect(validatePorts("80,443").valid).toBe(false)
  })
})

describe("validateDnsServer", () => {
  it("falls back to the system resolver when nothing was asked for", () => {
    expect(validateDnsServer(undefined)).toEqual({ valid: true, sanitized: "" })
    expect(validateDnsServer("")).toEqual({ valid: true, sanitized: "" })
  })

  it("accepts ip literals only", () => {
    expect(validateDnsServer("192.0.2.53")).toEqual({ valid: true, sanitized: "192.0.2.53" })
    expect(validateDnsServer("2001:db8::53").valid).toBe(true)
    // a hostname would need a resolver to resolve the resolver
    expect(validateDnsServer("dns.example.com").valid).toBe(false)
    expect(validateDnsServer("192.0.2.53;id").valid).toBe(false)
  })
})

describe("resolveCommandPath", () => {
  const nothingExists = () => false
  const only = (path: string) => (candidate: string) => candidate === path

  it("uses the first candidate that exists, not the first candidate", () => {
    // /bin/ping is absent on split-usr linux; the fallbacks used to be dead code
    expect(resolveCommandPath("ping", "linux", only("/usr/bin/ping"))).toBe("/usr/bin/ping")
    expect(resolveCommandPath("ping", "darwin", only("/sbin/ping"))).toBe("/sbin/ping")
  })

  it("falls back to PATH resolution when no known path exists", () => {
    expect(resolveCommandPath("ping", "linux", nothingExists)).toBe("ping")
    expect(resolveCommandPath("traceroute", "freebsd", nothingExists)).toBe("traceroute")
  })

  it("addresses windows binaries under SystemRoot rather than by bare name", () => {
    const systemRoot = "C:\\Windows"
    const expected = "C:\\Windows\\System32\\PING.EXE"
    expect(resolveCommandPath("ping", "win32", only(expected), systemRoot)).toBe(expected)
    expect(
      resolveCommandPath("tracert", "win32", only("C:\\Windows\\System32\\TRACERT.EXE"), systemRoot)
    ).toBe("C:\\Windows\\System32\\TRACERT.EXE")
    // no SystemRoot, or the file is missing: PATH is the only option left
    expect(resolveCommandPath("ping", "win32", nothingExists, systemRoot)).toBe("ping")
    expect(resolveCommandPath("ping", "win32", () => true)).toBe("ping")
  })
})
