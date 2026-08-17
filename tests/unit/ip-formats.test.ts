import { describe, expect, it } from "vitest"
import {
  IPV4_INPUT_FORMATS,
  MAX_IPV4_INT,
  convertIPv4,
  parseIPv4Input,
  specialUseScope,
} from "@/lib/ip-formats"
import { ipv4ToInt } from "@/lib/network-utils"

describe("ipv4 format conversion", () => {
  // signed 32-bit arithmetic corrupts everything above 2147483647, so walk the whole top half
  const highAddresses = [
    "128.0.0.0",
    "192.168.1.1",
    "203.0.113.255",
    "224.0.0.1",
    "240.0.0.0",
    "255.255.255.254",
    "255.255.255.255",
  ]

  it.each(highAddresses)("%s round-trips through every format", (address) => {
    const asInt = ipv4ToInt(address)
    expect(asInt).toBeGreaterThan(2147483647)

    const formats = convertIPv4(asInt)
    expect(formats.dottedDecimal).toBe(address)
    expect(Number(formats.decimal)).toBe(asInt)

    for (const format of IPV4_INPUT_FORMATS) {
      const text =
        format === "dotted"
          ? formats.dottedDecimal
          : format === "decimal"
            ? formats.decimal
            : format === "binary"
              ? formats.binary
              : format === "hex"
                ? formats.hex
                : formats.octal
      expect(parseIPv4Input(text, format), `${format} of ${address}`).toBe(asInt)
    }
  })

  it("never emits a negative integer", () => {
    expect(convertIPv4(ipv4ToInt("255.255.255.255")).decimal).toBe("4294967295")
    expect(convertIPv4(ipv4ToInt("128.0.0.1")).decimal).toBe("2147483649")
    expect(convertIPv4(ipv4ToInt("255.255.255.255")).hex).toBe("0xFFFFFFFF")
    expect(convertIPv4(ipv4ToInt("255.255.255.255")).octal).toBe("0o37777777777")
  })

  it("rejects trailing garbage instead of silently truncating it", () => {
    // parseInt("3232235777abc") is 3232235777, which is how bad input became a result
    expect(parseIPv4Input("3232235777abc", "decimal")).toBeNull()
    expect(parseIPv4Input("192.168.1.1", "decimal")).toBeNull()
    expect(parseIPv4Input("1010zzz", "binary")).toBeNull()
    expect(parseIPv4Input("0xZZ", "hex")).toBeNull()
    expect(parseIPv4Input("0o9", "octal")).toBeNull()
  })

  it("rejects values past the top of the space", () => {
    expect(parseIPv4Input(String(MAX_IPV4_INT), "decimal")).toBe(MAX_IPV4_INT)
    expect(parseIPv4Input(String(MAX_IPV4_INT + 1), "decimal")).toBeNull()
    expect(parseIPv4Input("1".repeat(33), "binary")).toBeNull()
    expect(parseIPv4Input("1FFFFFFFF", "hex")).toBeNull()
    expect(parseIPv4Input("0o40000000000", "octal")).toBeNull()
  })

  it("keeps the 0x prefix strip from eating literal digits", () => {
    // a character-class strip once turned 0xC0A80101 into 0.12.164.17
    expect(parseIPv4Input("0xC0A80101", "hex")).toBe(ipv4ToInt("192.168.1.1"))
    expect(parseIPv4Input("C0A80101", "hex")).toBe(ipv4ToInt("192.168.1.1"))
    expect(parseIPv4Input("C0.A8.01.01", "hex")).toBe(ipv4ToInt("192.168.1.1"))
  })

  it("pads binary input from the right", () => {
    expect(parseIPv4Input("1", "binary")).toBe(1)
    expect(parseIPv4Input("11000000.10101000.00000001.00000001", "binary")).toBe(
      ipv4ToInt("192.168.1.1")
    )
  })

  it("emits the rfc 4291 ipv4-mapped and ipv4-compatible forms", () => {
    const formats = convertIPv4(ipv4ToInt("192.0.2.33"))
    expect(formats.ipv6Mapped).toBe("::ffff:192.0.2.33")
    expect(formats.ipv6Compatible).toBe("::192.0.2.33")
  })
})

describe("special-use address scopes", () => {
  it.each([
    ["10.0.0.1", "Private"],
    ["172.16.0.1", "Private"],
    ["172.32.0.1", "Globally Routable Unicast"],
    ["192.168.0.1", "Private"],
    ["100.64.0.1", "Shared Address Space (CGNAT)"],
    ["100.128.0.1", "Globally Routable Unicast"],
    ["127.0.0.1", "Loopback"],
    ["169.254.1.1", "Link-Local"],
    ["192.0.2.1", "Documentation (TEST-NET-1)"],
    ["198.51.100.1", "Documentation (TEST-NET-2)"],
    ["203.0.113.1", "Documentation (TEST-NET-3)"],
    ["198.18.0.1", "Benchmarking"],
    ["224.0.0.1", "Multicast"],
    ["240.0.0.1", "Reserved"],
    ["255.255.255.255", "Limited Broadcast"],
    ["0.0.0.0", "This Network"],
    ["8.8.8.8", "Globally Routable Unicast"],
  ])("%s is %s", (address, expected) => {
    expect(specialUseScope(ipv4ToInt(address)).name).toBe(expected)
  })

  it("classifies rfc 791 classes without inventing a class for 0.0.0.0", () => {
    expect(convertIPv4(ipv4ToInt("10.0.0.1")).ipClass).toBe("A")
    expect(convertIPv4(ipv4ToInt("128.0.0.1")).ipClass).toBe("B")
    expect(convertIPv4(ipv4ToInt("192.0.2.1")).ipClass).toBe("C")
    expect(convertIPv4(ipv4ToInt("224.0.0.1")).ipClass).toBe("D (Multicast)")
    expect(convertIPv4(ipv4ToInt("240.0.0.1")).ipClass).toBe("E (Reserved)")
    expect(convertIPv4(ipv4ToInt("0.0.0.0")).ipClass).toBe("Unspecified")
  })
})
