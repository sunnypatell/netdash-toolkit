import { describe, expect, it } from "vitest"
import { maskInfo, parseMaskInput, usableHostsFor } from "@/lib/mask-convert"
import { SUBNET_MASKS } from "@/lib/reference/subnet-masks"

const ALL_PREFIXES = Array.from({ length: 33 }, (_, index) => index)

describe("prefix to mask to wildcard, across the whole range", () => {
  it("agrees with the reference table for every prefix 0 to 32", () => {
    for (const prefix of ALL_PREFIXES) {
      const info = maskInfo(prefix)
      const reference = SUBNET_MASKS.find((entry) => entry.prefix === prefix)
      expect(reference, `/${prefix} missing from SUBNET_MASKS`).toBeDefined()
      expect(info.netmask, `/${prefix} mask`).toBe(reference!.mask)
      expect(info.wildcard, `/${prefix} wildcard`).toBe(reference!.wildcard)
      expect(info.usableHosts, `/${prefix} usable hosts`).toBe(reference!.usableHosts)
    }
  })

  it("makes mask and wildcard exact complements", () => {
    for (const prefix of ALL_PREFIXES) {
      const info = maskInfo(prefix)
      const pairs = info.netmask.split(".").map((octet, index) => {
        const wildcardOctet = info.wildcard.split(".")[index]
        return Number(octet) + Number(wildcardOctet)
      })
      expect(pairs, `/${prefix}`).toEqual([255, 255, 255, 255])
    }
  })

  it("puts exactly `prefix` one bits at the top of the binary form", () => {
    for (const prefix of ALL_PREFIXES) {
      const bits = maskInfo(prefix).binary.replace(/\./g, "")
      expect(bits.length).toBe(32)
      expect(bits).toBe("1".repeat(prefix) + "0".repeat(32 - prefix))
    }
  })

  it("counts total addresses as 2^(32-prefix)", () => {
    for (const prefix of ALL_PREFIXES) {
      expect(maskInfo(prefix).totalAddresses).toBe(2 ** (32 - prefix))
    }
  })

  it("round-trips every mask back to its prefix through all three notations", () => {
    for (const prefix of ALL_PREFIXES) {
      const info = maskInfo(prefix)
      expect(parseMaskInput(`/${prefix}`), `/${prefix}`).toBe(prefix)
      expect(parseMaskInput(String(prefix)), `${prefix}`).toBe(prefix)
      expect(parseMaskInput(info.netmask), info.netmask).toBe(prefix)
    }
  })
})

describe("RFC 3021 /31 and /32 edge cases", () => {
  it("gives a /31 two usable addresses, not zero", () => {
    // rfc 3021: both addresses of a /31 are usable on a point to point link
    expect(usableHostsFor(31)).toBe(2)
    expect(maskInfo(31).netmask).toBe("255.255.255.254")
    expect(maskInfo(31).wildcard).toBe("0.0.0.1")
  })

  it("gives a /32 one address", () => {
    expect(usableHostsFor(32)).toBe(1)
    expect(maskInfo(32).netmask).toBe("255.255.255.255")
    expect(maskInfo(32).wildcard).toBe("0.0.0.0")
  })

  it("still subtracts network and broadcast for a /30", () => {
    expect(usableHostsFor(30)).toBe(2)
    expect(usableHostsFor(29)).toBe(6)
  })

  it("handles the default route at /0", () => {
    expect(maskInfo(0).netmask).toBe("0.0.0.0")
    expect(maskInfo(0).wildcard).toBe("255.255.255.255")
    expect(usableHostsFor(0)).toBe(4294967294)
  })
})

describe("parsing", () => {
  it("accepts a wildcard mask and returns the matching prefix", () => {
    expect(parseMaskInput("0.0.0.255")).toBe(24)
    expect(parseMaskInput("0.0.0.1")).toBe(31)
    expect(parseMaskInput("0.255.255.255")).toBe(8)
  })

  it("rejects non-contiguous masks", () => {
    for (const bad of ["255.0.255.0", "255.255.0.255", "0.255.0.255", "255.254.255.0"]) {
      expect(parseMaskInput(bad), bad).toBeNull()
    }
  })

  it("rejects out of range prefixes and junk", () => {
    for (const bad of ["/33", "33", "-1", "", "   ", "abc", "255.255.255.256", "1.2.3", "24.5"]) {
      expect(parseMaskInput(bad), bad).toBeNull()
    }
  })

  it("resolves the ambiguous all-zero and all-one inputs as masks", () => {
    expect(parseMaskInput("0.0.0.0")).toBe(0)
    expect(parseMaskInput("255.255.255.255")).toBe(32)
  })
})

describe("no classful language", () => {
  it("describes blocks by prefix, since RFC 1519 and RFC 4632 removed classes", () => {
    for (const prefix of ALL_PREFIXES) {
      const info = maskInfo(prefix)
      expect(JSON.stringify(info), `/${prefix}`).not.toMatch(/Class [ABC]/)
      // every block of this size tiles the space exactly
      expect(info.blocksInIPv4Space * info.totalAddresses).toBe(2 ** 32)
    }
  })
})
