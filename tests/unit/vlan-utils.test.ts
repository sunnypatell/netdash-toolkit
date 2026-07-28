import { describe, expect, it } from "vitest"
import {
  checkSubnetOverlaps,
  generateArubaAccessConfig,
  generateArubaTrunkConfig,
  generateCiscoTrunkConfig,
  generateSwitchConfig,
  validateTrunkConfig,
  validateVLAN,
} from "@/lib/vlan-utils"
import type { SwitchPort, VLAN } from "@/lib/vlan-utils"

const vlan = (id: number, name: string, extra: Partial<VLAN> = {}): VLAN => ({
  id,
  name,
  subnets: [],
  ...extra,
})

describe("cisco ios vlan block", () => {
  it("emits name and turns description into an ios comment", () => {
    const config = generateSwitchConfig([], "cisco-ios", true, [
      vlan(10, "Mgmt", { description: "management network" }),
    ])

    expect(config).toContain("vlan 10")
    expect(config).toContain(" name Mgmt")
    expect(config).toContain("! management network")
    // "description" is not a valid ios vlan sub-command
    expect(config).not.toContain("description")
  })
})

describe("cisco ios trunk config", () => {
  const port: SwitchPort = {
    name: "GigabitEthernet1/0/1",
    mode: "trunk",
    nativeVlan: 99,
    allowedVlans: "10,20,30-35",
  }

  it("does not emit the encapsulation line", () => {
    expect(generateCiscoTrunkConfig(port)).not.toContain("encapsulation")
  })

  it("emits a validated allowed vlan list", () => {
    expect(generateCiscoTrunkConfig(port)).toContain(" switchport trunk allowed vlan 10,20,30-35")
  })

  it("sanitizes or rejects raw allowed vlan input", () => {
    // trailing junk is stripped down to the parseable vlan ids
    const config = generateCiscoTrunkConfig({ ...port, allowedVlans: "10; reload" })
    expect(config).toContain(" switchport trunk allowed vlan 10\n")
    expect(config).not.toContain("reload")
    // fully unparseable input never reaches the config
    expect(() => generateCiscoTrunkConfig({ ...port, allowedVlans: "garbage" })).toThrow()
  })
})

describe("aruba aos-cx configs", () => {
  it("access stanza includes no routing before vlan access", () => {
    const config = generateArubaAccessConfig({ name: "1/1/1", mode: "access", accessVlan: 10 })
    expect(config).toContain(" no routing\n")
    expect(config.indexOf("no routing")).toBeLessThan(config.indexOf("vlan access 10"))
  })

  it("trunk stanza includes no routing", () => {
    const config = generateArubaTrunkConfig({
      name: "1/1/2",
      mode: "trunk",
      nativeVlan: 99,
      allowedVlans: "10,20,99",
    })
    expect(config).toContain(" no routing\n")
    expect(config).toContain(" vlan trunk allowed 10,20,99")
  })
})

describe("validateVLAN", () => {
  it("rejects names containing spaces", () => {
    const result = validateVLAN(vlan(20, "Guest WiFi"))
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("spaces"))).toBe(true)
  })

  it("accepts a single-token name", () => {
    expect(validateVLAN(vlan(20, "Guest-WiFi")).isValid).toBe(true)
  })
})

describe("validateTrunkConfig", () => {
  const vlans = [vlan(1, "default"), vlan(10, "users"), vlan(99, "native")]

  it("errors when native vlan is not in the allowed list", () => {
    const result = validateTrunkConfig(
      { name: "Gi1/0/1", mode: "trunk", nativeVlan: 99, allowedVlans: "10,20" },
      vlans
    )
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes("not in the allowed"))).toBe(true)
  })

  it("warns on native vlan 1", () => {
    const result = validateTrunkConfig(
      { name: "Gi1/0/1", mode: "trunk", nativeVlan: 1, allowedVlans: "1,10" },
      vlans
    )
    expect(result.isValid).toBe(true)
    expect(result.warnings.some((w) => w.includes("VLAN-hopping"))).toBe(true)
  })

  it("passes when native vlan is allowed and not 1", () => {
    const result = validateTrunkConfig(
      { name: "Gi1/0/1", mode: "trunk", nativeVlan: 99, allowedVlans: "10,99" },
      vlans
    )
    expect(result.isValid).toBe(true)
    expect(result.warnings.some((w) => w.includes("VLAN-hopping"))).toBe(false)
  })
})

describe("checkSubnetOverlaps", () => {
  it("detects nested ipv4 subnets", () => {
    const overlaps = checkSubnetOverlaps([
      vlan(10, "a", { subnets: ["10.0.0.0/24"] }),
      vlan(20, "b", { subnets: ["10.0.0.128/25"] }),
    ])
    expect(overlaps).toHaveLength(1)
  })

  it("ignores disjoint ipv4 subnets", () => {
    const overlaps = checkSubnetOverlaps([
      vlan(10, "a", { subnets: ["10.0.0.0/24"] }),
      vlan(20, "b", { subnets: ["10.0.1.0/24"] }),
    ])
    expect(overlaps).toHaveLength(0)
  })
})
