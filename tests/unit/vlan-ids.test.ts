import { describe, expect, it } from "vitest"
import {
  isStandardReservedVLAN,
  isValidVLANId,
  parseVLANList,
  STANDARD_RESERVED_VLAN_IDS,
  validateVLAN,
  VLAN_ID_MAX,
  VLAN_ID_MIN,
  VLAN_TAG_BYTES,
} from "@/lib/vlan-utils"
import type { VLAN } from "@/lib/vlan-utils"

function vlan(id: number, name = "Test"): VLAN {
  return { id, name, subnets: [] }
}

describe("VLAN id range (IEEE 802.1Q)", () => {
  it("accepts 1 through 4094 and nothing outside it", () => {
    expect(VLAN_ID_MIN).toBe(1)
    expect(VLAN_ID_MAX).toBe(4094)
    expect(isValidVLANId(1)).toBe(true)
    expect(isValidVLANId(4094)).toBe(true)
    expect(isValidVLANId(0)).toBe(false)
    expect(isValidVLANId(4095)).toBe(false)
    expect(isValidVLANId(4096)).toBe(false)
    expect(isValidVLANId(-1)).toBe(false)
  })

  it("rejects a non-integer id rather than rounding it", () => {
    expect(isValidVLANId(10.5)).toBe(false)
    expect(isValidVLANId(Number.NaN)).toBe(false)
  })

  it("names 0 and 4095 as reserved by the standard", () => {
    expect([...STANDARD_RESERVED_VLAN_IDS].sort((a, b) => a - b)).toEqual([0, 4095])
    expect(isStandardReservedVLAN(0)).toBe(true)
    expect(isStandardReservedVLAN(4095)).toBe(true)
    expect(isStandardReservedVLAN(1)).toBe(false)
    expect(isStandardReservedVLAN(4094)).toBe(false)
  })

  it("explains that 0 and 4095 are reserved, not merely out of range", () => {
    for (const id of [0, 4095]) {
      const result = validateVLAN(vlan(id))
      expect(result.isValid, `${id}`).toBe(false)
      expect(result.errors.join(" "), `${id}`).toMatch(/reserved by IEEE 802\.1Q/)
    }

    const outOfRange = validateVLAN(vlan(5000))
    expect(outOfRange.isValid).toBe(false)
    expect(outOfRange.errors.join(" ")).toMatch(/must be 1-4094/)
    expect(outOfRange.errors.join(" ")).not.toMatch(/reserved/)
  })

  it("warns rather than errors on VLAN 1 and the legacy Cisco range", () => {
    for (const id of [1, 1002, 1003, 1004, 1005]) {
      const result = validateVLAN(vlan(id))
      expect(result.isValid, `${id}`).toBe(true)
      expect(result.warnings.join(" "), `${id}`).toMatch(/reserved/)
    }
  })
})

describe("VLAN list parsing", () => {
  it("expands ranges and drops ids outside 1-4094", () => {
    expect(parseVLANList("10,20,30-33")).toEqual([10, 20, 30, 31, 32, 33])
    expect(parseVLANList("0,1,4094,4095,4096")).toEqual([1, 4094])
  })

  it("de-duplicates and sorts", () => {
    expect(parseVLANList("30,10,20,10,20-22")).toEqual([10, 20, 21, 22, 30])
  })

  it("returns nothing for junk", () => {
    expect(parseVLANList("abc,,--")).toEqual([])
  })
})

describe("tag sizes", () => {
  it("uses 4 bytes for an 802.1Q tag and 8 for an 802.1ad stack", () => {
    // 802.1Q c-tag is a 2-byte tpid plus a 2-byte tci; 802.1ad adds an s-tag
    expect(VLAN_TAG_BYTES["802.1Q"]).toBe(4)
    expect(VLAN_TAG_BYTES["802.1ad"]).toBe(8)
    expect(VLAN_TAG_BYTES["802.1ad"]).toBe(VLAN_TAG_BYTES["802.1Q"] * 2)
  })
})
