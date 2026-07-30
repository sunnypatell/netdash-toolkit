import { describe, expect, it } from "vitest"
import { looksLikeIpAddress, resolveQueryName, reverseDnsName } from "@/lib/reverse-dns"

describe("reverseDnsName", () => {
  it("builds the in-addr.arpa name for ipv4 (rfc 1035 3.5)", () => {
    expect(reverseDnsName("192.0.2.10")).toBe("10.2.0.192.in-addr.arpa")
    expect(reverseDnsName("8.8.8.8")).toBe("8.8.8.8.in-addr.arpa")
  })

  it("builds the reversed-nibble ip6.arpa name (rfc 3596 2.5)", () => {
    expect(reverseDnsName("2001:db8::1")).toBe(
      "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa"
    )
  })

  it("returns null for a name, which needs no rewriting", () => {
    expect(reverseDnsName("example.com")).toBeNull()
    expect(reverseDnsName("")).toBeNull()
  })
})

describe("resolveQueryName", () => {
  it("rewrites a PTR query for an address, which is the whole point of PTR", () => {
    expect(resolveQueryName("8.8.8.8", "PTR")).toEqual({
      name: "8.8.8.8.in-addr.arpa",
      rewrittenFrom: "8.8.8.8",
    })
  })

  it("leaves an already-reversed PTR name alone", () => {
    expect(resolveQueryName("8.8.8.8.in-addr.arpa", "ptr")).toEqual({
      name: "8.8.8.8.in-addr.arpa",
    })
  })

  it("never rewrites a forward query", () => {
    expect(resolveQueryName("8.8.8.8", "A")).toEqual({ name: "8.8.8.8" })
    expect(resolveQueryName("example.com", "PTR")).toEqual({ name: "example.com" })
  })
})

describe("looksLikeIpAddress", () => {
  it("recognises both families", () => {
    expect(looksLikeIpAddress("192.0.2.1")).toBe(true)
    expect(looksLikeIpAddress("2001:db8::1")).toBe(true)
    expect(looksLikeIpAddress("example.com")).toBe(false)
  })
})
