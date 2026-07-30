import { describe, expect, it } from "vitest"
import { detectMacFormat, formatMac, parseMac } from "@/lib/mac-format"

const ADDRESS = "001A2B3C4D5E"

describe("format round-tripping", () => {
  const spellings = [
    "00:1A:2B:3C:4D:5E",
    "00:1a:2b:3c:4d:5e",
    "00-1A-2B-3C-4D-5E",
    "001a.2b3c.4d5e",
    "001A.2B3C.4D5E",
    "001A2B3C4D5E",
    "001a2b3c4d5e",
    "001a2b-3c4d5e",
    "  00:1A:2B:3C:4D:5E  ",
  ]

  it("parses every spelling of the same address to the same bytes", () => {
    for (const spelling of spellings) {
      expect(parseMac(spelling)?.hex, spelling).toBe(ADDRESS)
    }
  })

  it("emits every notation and parses each one back", () => {
    const info = parseMac(ADDRESS)!
    for (const format of ["colon", "hyphen", "cisco", "bare", "hp"] as const) {
      const rendered = formatMac(info, format)
      expect(parseMac(rendered)?.hex, `${format} -> ${rendered}`).toBe(ADDRESS)
    }
  })

  it("renders the notations engineers expect", () => {
    const info = parseMac(ADDRESS)!
    expect(info.colon).toBe("00:1A:2B:3C:4D:5E")
    expect(info.hyphen).toBe("00-1A-2B-3C-4D-5E")
    expect(info.cisco).toBe("001a.2b3c.4d5e")
    expect(info.bare).toBe("001A2B3C4D5E")
    expect(formatMac(info, "hp")).toBe("001a2b-3c4d5e")
  })

  it("pads BSD style addresses that drop leading zeros", () => {
    expect(parseMac("8:0:27:1a:2b:3c")?.hex).toBe("0800271A2B3C")
  })

  it("splits the OUI from the NIC portion", () => {
    const info = parseMac(ADDRESS)!
    expect(info.oui).toBe("00:1A:2B")
    expect(info.nic).toBe("3C:4D:5E")
  })

  it("reports which notation it was handed", () => {
    expect(detectMacFormat("00:1A:2B:3C:4D:5E")).toBe("colon")
    expect(detectMacFormat("00-1A-2B-3C-4D-5E")).toBe("hyphen")
    expect(detectMacFormat("001a.2b3c.4d5e")).toBe("cisco")
    expect(detectMacFormat("001a2b-3c4d5e")).toBe("hp")
    expect(detectMacFormat("001A2B3C4D5E")).toBe("bare")
  })
})

describe("IEEE 802 address bits", () => {
  it("reads the I/G bit from bit 0 of the first octet", () => {
    // 01:00:5e:.. is the ipv4 multicast prefix; the low bit of 0x01 is set
    expect(parseMac("01:00:5E:00:00:01")?.isMulticast).toBe(true)
    expect(parseMac("33:33:00:00:00:01")?.isMulticast).toBe(true) // ipv6 multicast
    expect(parseMac("00:1A:2B:3C:4D:5E")?.isMulticast).toBe(false)
    expect(parseMac("02:00:00:00:00:01")?.isMulticast).toBe(false)
  })

  it("reads the U/L bit from bit 1 of the first octet", () => {
    expect(parseMac("02:00:00:00:00:01")?.isLocallyAdministered).toBe(true)
    expect(parseMac("06:00:00:00:00:01")?.isLocallyAdministered).toBe(true)
    expect(parseMac("00:1A:2B:3C:4D:5E")?.isLocallyAdministered).toBe(false)
    expect(parseMac("01:00:5E:00:00:01")?.isLocallyAdministered).toBe(false)
  })

  it("treats the two bits as independent across all four combinations", () => {
    const cases = [
      { first: "00", multicast: false, local: false },
      { first: "01", multicast: true, local: false },
      { first: "02", multicast: false, local: true },
      { first: "03", multicast: true, local: true },
    ]
    for (const testCase of cases) {
      const info = parseMac(`${testCase.first}:00:00:00:00:01`)!
      expect(info.isMulticast, testCase.first).toBe(testCase.multicast)
      expect(info.isLocallyAdministered, testCase.first).toBe(testCase.local)
    }
  })

  it("flags the broadcast address, which is both group and local", () => {
    const info = parseMac("FF:FF:FF:FF:FF:FF")!
    expect(info.isBroadcast).toBe(true)
    expect(info.isMulticast).toBe(true)
    expect(info.isLocallyAdministered).toBe(true)
  })

  it("renders 48 bits of binary in six octets", () => {
    expect(parseMac("FF:00:FF:00:FF:00")?.binary).toBe(
      "11111111 00000000 11111111 00000000 11111111 00000000"
    )
  })
})

describe("modified EUI-64 (RFC 4291 appendix A)", () => {
  it("inserts FFFE and inverts the U/L bit", () => {
    expect(parseMac("00:1A:2B:3C:4D:5E")?.modifiedEui64).toBe("021A:2BFF:FE3C:4D5E")
    // a locally administered address flips the other way
    expect(parseMac("02:1A:2B:3C:4D:5E")?.modifiedEui64).toBe("001A:2BFF:FE3C:4D5E")
  })

  it("is its own inverse on the U/L bit", () => {
    const once = parseMac("00:1A:2B:3C:4D:5E")!.modifiedEui64
    const firstOctet = once.slice(0, 2)
    expect(firstOctet).toBe("02")
  })
})

describe("rejection", () => {
  it("refuses anything that is not one of the real notations", () => {
    const bad = [
      "",
      "   ",
      "zz00:1A:2B:3C:4D:5E",
      "00:1A:2B:3C:4D",
      "00:1A:2B:3C:4D:5E:6F",
      "001A2B3C4D5",
      "001A2B3C4D5E7",
      "00:1A:2B:3C:4D:5G",
      "001a.2b3c.4d5",
      "not a mac at all",
      "192.168.1.1",
    ]
    for (const input of bad) {
      expect(parseMac(input), input).toBeNull()
      expect(detectMacFormat(input), input).toBeNull()
    }
  })

  it("does not silently strip junk the way the lenient cli parser does", () => {
    // lib/parsers.normalizeMac exists to survive vendor cli output and would
    // accept this by discarding the letters; the formatter must not
    expect(parseMac("zz001a2b3c4d5e")).toBeNull()
    expect(parseMac("00:1A:2B:3C:4D:5E extra")).toBeNull()
  })
})
