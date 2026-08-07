import { describe, expect, it } from "vitest"
import {
  availableWidths,
  calculateWiFiCapacity,
  channels24,
  channels5,
  channels6,
  channelsForBand,
  defaultWirelessConfig,
  generateWirelessConfig,
  supportsBand,
  type WirelessConfig,
} from "@/lib/wireless"

// from IEEE 802.11-2020 Annex E, FCC 47 CFR 15.247 and 15.407, not from the tool's own behaviour

describe("2.4 GHz channel plan", () => {
  it("numbers 13 channels at 2407 + 5n MHz", () => {
    expect(channels24).toHaveLength(13)
    expect(channels24[0]).toMatchObject({ channel: 1, frequency: 2412 })
    expect(channels24.at(-1)).toMatchObject({ channel: 13, frequency: 2472 })
    for (const ch of channels24) {
      expect(ch.frequency).toBe(2407 + 5 * ch.channel)
    }
  })

  it("recommends exactly 1, 6 and 11", () => {
    // the regression this replaces: 1/6/11 were tagged medium interference, so the
    // recommended list filtered down to nothing at all
    expect(channels24.filter((ch) => ch.recommended).map((ch) => ch.channel)).toEqual([1, 6, 11])
    expect(channelsForBand("2.4").filter((ch) => ch.interference === "low")).toHaveLength(3)
  })

  it("keeps 25 MHz between every recommended pair, which is what non-overlapping means", () => {
    const centres = channels24.filter((ch) => ch.recommended).map((ch) => ch.frequency)
    for (let i = 1; i < centres.length; i++) {
      expect(centres[i] - centres[i - 1]).toBeGreaterThanOrEqual(25)
    }
  })

  it("flags 12 and 13 as region restricted rather than as clean channels", () => {
    for (const channel of [12, 13]) {
      const entry = channels24.find((ch) => ch.channel === channel)
      expect(entry?.recommended).toBe(false)
      expect(entry?.note).toMatch(/15\.247/)
    }
  })

  it("never claims more than 20 MHz, because 2.4 GHz has no room for a wider plan", () => {
    expect(channels24.every((ch) => ch.maxWidth === 20)).toBe(true)
  })
})

describe("5 GHz channel plan", () => {
  it("lists U-NII-1, 2A, 2C and 3 in full at 5000 + 5n MHz", () => {
    expect(channels5.map((ch) => ch.channel)).toEqual([
      36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144,
      149, 153, 157, 161, 165,
    ])
    for (const ch of channels5) {
      expect(ch.frequency).toBe(5000 + 5 * ch.channel)
    }
  })

  it("marks exactly 52 through 144 as DFS", () => {
    expect(channels5.filter((ch) => ch.dfs).map((ch) => ch.channel)).toEqual([
      52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144,
    ])
  })

  it("caps channel 165 at 20 MHz", () => {
    // 5825 MHz sits 25 MHz below the 5850 MHz edge, so it cannot anchor an 80 MHz
    // block. the old table claimed 80 MHz for it.
    expect(channels5.find((ch) => ch.channel === 165)?.maxWidth).toBe(20)
    expect(channels5.find((ch) => ch.channel === 149)?.maxWidth).toBe(80)
    expect(channels5.find((ch) => ch.channel === 36)?.maxWidth).toBe(160)
  })

  it("notes the TDWR overlap on 120, 124 and 128", () => {
    for (const channel of [120, 124, 128]) {
      expect(channels5.find((ch) => ch.channel === channel)?.note).toMatch(/TDWR/)
    }
  })

  it("recommends the non-DFS channels only", () => {
    expect(channels5.filter((ch) => ch.recommended).map((ch) => ch.channel)).toEqual([
      36, 40, 44, 48, 149, 153, 157, 161, 165,
    ])
  })
})

describe("6 GHz channel plan", () => {
  it("gives the 59 non-overlapping channels at 5950 + 5n MHz", () => {
    expect(channels6).toHaveLength(59)
    expect(channels6[0]).toMatchObject({ channel: 1, frequency: 5955 })
    expect(channels6.at(-1)).toMatchObject({ channel: 233, frequency: 7115 })
    for (const ch of channels6) {
      expect(ch.frequency).toBe(5950 + 5 * ch.channel)
    }
  })

  it("spaces them 20 MHz apart with no DFS anywhere in the band", () => {
    for (let i = 1; i < channels6.length; i++) {
      expect(channels6[i].frequency - channels6[i - 1].frequency).toBe(20)
    }
    expect(channels6.some((ch) => ch.dfs)).toBe(false)
  })

  it("only offers 320 MHz where a 320 MHz block actually fits", () => {
    expect(channels6.find((ch) => ch.channel === 1)?.maxWidth).toBe(320)
    expect(channels6.find((ch) => ch.channel === 189)?.maxWidth).toBe(320)
    expect(channels6.find((ch) => ch.channel === 193)?.maxWidth).toBe(160)
    expect(channels6.find((ch) => ch.channel === 233)?.maxWidth).toBe(20)
  })

  it("pins every step of the width ladder on both sides of its boundary", () => {
    // the 40 MHz pair at 225-229 sat between two tested channels, so the whole
    // tier could be deleted without failing anything
    const widthAt = (channel: number) => channels6.find((ch) => ch.channel === channel)?.maxWidth
    expect(widthAt(189)).toBe(320)
    expect(widthAt(193)).toBe(160)
    expect(widthAt(221)).toBe(160)
    expect(widthAt(225)).toBe(40)
    expect(widthAt(229)).toBe(40)
    expect(widthAt(233)).toBe(20)
  })
})

describe("capacity maths", () => {
  const capacity = (
    standard: Parameters<typeof calculateWiFiCapacity>[0]["standard"],
    band: Parameters<typeof calculateWiFiCapacity>[0]["band"],
    width: Parameters<typeof calculateWiFiCapacity>[0]["width"],
    streams = 2
  ) => calculateWiFiCapacity({ standard, band, width, maxClients: 50, spatialStreams: streams })

  it("matches the published 2-stream rates for 802.11ac", () => {
    expect(capacity("802.11ac", "5", 20).theoretical).toBe(173)
    expect(capacity("802.11ac", "5", 40).theoretical).toBe(400)
    expect(capacity("802.11ac", "5", 80).theoretical).toBe(867)
    expect(capacity("802.11ac", "5", 160).theoretical).toBe(1733)
  })

  it("matches the published 2-stream rates for 802.11ax and 802.11be", () => {
    expect(capacity("802.11ax", "5", 80).theoretical).toBe(1201)
    expect(capacity("802.11ax", "5", 160).theoretical).toBe(2402)
    expect(capacity("802.11be", "6", 160).theoretical).toBe(2882)
    expect(capacity("802.11be", "6", 320).theoretical).toBe(5765)
  })

  it("does not change the rate just because the band changed", () => {
    // the regression this replaces: 20 and 40 MHz silently dropped to one spatial
    // stream on 2.4 GHz, so the same radio reported half the rate
    expect(capacity("802.11ax", "2.4", 20).theoretical).toBe(
      capacity("802.11ax", "5", 20).theoretical
    )
    expect(capacity("802.11ax", "2.4", 40).theoretical).toBe(
      capacity("802.11ax", "5", 40).theoretical
    )
    expect(capacity("802.11n", "2.4", 20).theoretical).toBe(
      capacity("802.11n", "5", 20).theoretical
    )
  })

  it("scales with spatial streams, rounding once at the end", () => {
    // HE80 is 600.4 Mbps per stream, so 4 streams is 2401.6 rounded to 2402
    expect(capacity("802.11ax", "5", 80, 1).theoretical).toBe(600)
    expect(capacity("802.11ax", "5", 80, 4).theoretical).toBe(2402)
    expect(capacity("802.11ax", "5", 80, 1).spatialStreams).toBe(1)
  })

  it("says which band/standard pairs do not exist instead of reporting 0 Mbps", () => {
    // 802.11ac is 5 GHz only; 6 GHz is defined for HE and EHT only
    for (const [standard, band] of [
      ["802.11ac", "2.4"],
      ["802.11ac", "6"],
      ["802.11n", "6"],
    ] as const) {
      const result = capacity(standard, band, 20)
      expect(result.supported).toBe(false)
      // named, not just truthy: the two reasons this function can give are
      // different diagnoses, and toBeTruthy() let either template become "x"
      expect(result.reason).toBe(`${standard} does not operate in the ${band} GHz band`)
      expect(result.theoretical).toBe(0)
    }
  })

  it("rejects a width the band cannot carry", () => {
    expect(capacity("802.11be", "5", 320).supported).toBe(false)
    expect(capacity("802.11ax", "2.4", 80).supported).toBe(false)
    expect(capacity("802.11n", "5", 80).supported).toBe(false)
    // the other of the two reasons, so neither template can be swapped for the
    // other without failing
    expect(capacity("802.11be", "5", 320).reason).toBe(
      "802.11be has no 320 MHz mode in the 5 GHz band"
    )
  })

  it("applies the 60% real world factor and keeps per-client above zero", () => {
    const result = calculateWiFiCapacity({
      standard: "802.11ax",
      band: "5",
      width: 80,
      maxClients: 200,
    })
    expect(result.realWorld).toBe(Math.round(result.theoretical * 0.6))
    // pinned, not just positive: `realWorld * maxClients` is also above zero
    expect(result.perClient).toBe(Math.round((result.realWorld / 200) * 10) / 10)
    expect(result.perClient).toBeLessThan(result.realWorld)
  })

  it("keeps one decimal so a dense deployment does not read as 0 Mbps per client", () => {
    const dense = calculateWiFiCapacity({
      standard: "802.11ax",
      band: "5",
      width: 80,
      maxClients: 2000,
    })
    expect(dense.perClient).toBeGreaterThan(0)
    expect(dense.perClient * 10).toBe(Math.round(dense.perClient * 10))
  })

  it("treats junk client counts as one client rather than a divide by zero", () => {
    const result = calculateWiFiCapacity({
      standard: "802.11ax",
      band: "5",
      width: 80,
      maxClients: Number.NaN,
    })
    expect(result.maxClients).toBe(1)
    expect(result.perClient).toBe(result.realWorld)
  })

  it("offers only widths the standard and band both define", () => {
    expect(availableWidths("802.11n", "2.4")).toEqual([20, 40])
    expect(availableWidths("802.11ac", "5")).toEqual([20, 40, 80, 160])
    expect(availableWidths("802.11be", "6")).toEqual([20, 40, 80, 160, 320])
    expect(availableWidths("802.11ac", "6")).toEqual([])
    expect(supportsBand("802.11ac", "2.4")).toBe(false)
  })
})

describe("autonomous IOS access point config", () => {
  const build = (overrides: Partial<WirelessConfig> = {}) =>
    generateWirelessConfig({ ...defaultWirelessConfig, ...overrides })

  it("broadcasts the SSID with guest-mode and hides it with no guest-mode", () => {
    // guest-mode puts the SSID in the beacon, so the old code hid networks by
    // asking for them to be advertised
    expect(build({ hidden: false })).toContain("   guest-mode")
    expect(build({ hidden: true })).toContain("   no guest-mode")
    expect(build({ hidden: true })).not.toMatch(/^ {3}guest-mode$/m)
  })

  it("pairs WPA2 key management with the cipher that makes it work", () => {
    const config = build({ security: "wpa2" })
    expect(config).toContain("authentication key-management wpa version 2")
    expect(config).toContain("encryption vlan 1 mode ciphers aes-ccm")
  })

  it("no longer silently generates an open network for WPA and WEP", () => {
    const wpa = build({ security: "wpa" })
    expect(wpa).toContain("authentication key-management wpa version 1")
    expect(wpa).toContain("encryption vlan 1 mode ciphers tkip")

    const wep = build({ security: "wep" })
    expect(wep).toContain("encryption vlan 1 mode wep mandatory")
    expect(wep).toMatch(/WEP is broken/)
  })

  it("does not invent a WPA3 command this platform has never had", () => {
    const config = build({ security: "wpa3" })
    expect(config).not.toContain("wpa version 3")
    expect(config).toMatch(/no autonomous IOS equivalent/)
  })

  it("puts the radius server at global scope, not inside dot11 ssid", () => {
    const config = build({ security: "wpa2-enterprise" })
    const radius = config.indexOf("radius-server host")
    const ssid = config.indexOf("dot11 ssid")
    expect(radius).toBeGreaterThan(-1)
    expect(radius).toBeLessThan(ssid)
    expect(config).toContain("authentication network-eap eap_methods")
  })

  it("uses the real command names for the radio tunables", () => {
    const config = build({ band: "5", mode: "802.11ac" })
    expect(config).toContain("   beacon dtim-period 2")
    expect(config).toContain("   fragment-threshold 2346")
    expect(config).not.toContain("fragmentation-threshold")
    expect(config).not.toMatch(/^ {3}dtim-period/m)
  })

  it("declines 6 GHz instead of configuring a radio interface that does not exist", () => {
    const config = build({ band: "6", mode: "802.11be" })
    expect(config).not.toContain("Dot11Radio2")
    expect(config).toMatch(/6 GHz has no autonomous IOS radio interface/)
  })

  it("emits no invented enable command for 802.11ac, ax or be", () => {
    for (const mode of ["802.11ac", "802.11ax", "802.11be"] as const) {
      const config = build({ band: "5", mode })
      expect(config).not.toMatch(/dot11 (ac|ax|be) enable/)
    }
  })

  it("only writes a channel width the platform accepts", () => {
    expect(build({ bandwidth: "40" })).toContain("channel width 40-above")
    expect(build({ bandwidth: "20" })).toContain("channel width 20")
    const wide = build({ bandwidth: "80" })
    expect(wide).not.toMatch(/^ {3}channel width 80$/m)
    expect(wide).toMatch(/not configurable on autonomous IOS APs/)
  })

  it("does not pass a percentage to power local", () => {
    expect(build({ power: "100" })).toContain("power local maximum")
    const half = build({ power: "50" })
    expect(half).not.toMatch(/^ {3}power local 50$/m)
    expect(half).toMatch(/Transmit power target 50%/)
  })

  it("configures max-associations under the SSID it applies to", () => {
    const config = build({ maxClients: "80" })
    const associations = config.indexOf("max-associations 80")
    expect(associations).toBeGreaterThan(config.indexOf("dot11 ssid"))
    expect(associations).toBeLessThan(config.indexOf("interface Dot11Radio"))
  })
})
