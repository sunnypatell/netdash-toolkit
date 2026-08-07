// every table is derived from a published allocation, so a wrong entry fails an arithmetic test

export type WirelessBand = "2.4" | "5" | "6"
export type WirelessStandard = "802.11n" | "802.11ac" | "802.11ax" | "802.11be"
export type ChannelWidth = 20 | 40 | 80 | 160 | 320
export type WirelessSecurity = "open" | "wep" | "wpa" | "wpa2" | "wpa3" | "wpa2-enterprise"

export interface ChannelInfo {
  channel: number
  frequency: number
  // widest contiguous block this channel can take part in, from the allocation
  maxWidth: ChannelWidth
  // overlap risk inside the standard channel plan, not a live spectrum reading
  interference: "low" | "medium" | "high"
  recommended: boolean
  dfs: boolean
  note?: string
}

export interface WirelessConfig {
  ssid: string
  security: WirelessSecurity
  channel: string
  bandwidth: "20" | "40" | "80" | "160" | "320"
  power: string
  band: WirelessBand
  mode: WirelessStandard
  hidden: boolean
  maxClients: string
  beaconInterval: string
  dtimPeriod: string
}

export const defaultWirelessConfig: WirelessConfig = {
  ssid: "MyNetwork",
  security: "wpa2",
  channel: "auto",
  bandwidth: "80",
  power: "100",
  band: "5",
  mode: "802.11ac",
  hidden: false,
  maxClients: "50",
  beaconInterval: "100",
  dtimPeriod: "2",
}

// 2.4 GHz: centre = 2407 + 5n MHz (IEEE 802.11-2020 Annex E). 25 MHz of separation leaves
// 1/6/11 as the only non-overlapping plan; 12 and 13 are ETSI EN 300 328, not FCC 15.247.
const NON_OVERLAPPING_24 = [1, 6, 11]
const REGION_RESTRICTED_24 = [12, 13]

export const channels24: ChannelInfo[] = Array.from({ length: 13 }, (_, i) => i + 1).map(
  (channel) => {
    const nonOverlapping = NON_OVERLAPPING_24.includes(channel)
    const restricted = REGION_RESTRICTED_24.includes(channel)
    return {
      channel,
      frequency: 2407 + 5 * channel,
      maxWidth: 20 as ChannelWidth,
      interference: nonOverlapping ? "low" : restricted ? "medium" : "high",
      recommended: nonOverlapping,
      dfs: false,
      ...(restricted ? { note: "Not permitted under FCC 47 CFR 15.247; ETSI and Japan only" } : {}),
    }
  }
)

// 5 GHz: centre = 5000 + 5n MHz; blocks are the contiguous 20 MHz runs, so maxWidth is the
// run length (FCC 47 CFR 15.407 U-NII-1/2A/2C/3, IEEE 802.11-2020 Annex E).
const BLOCKS_5: Array<{ channels: number[]; dfs: boolean; maxWidth: ChannelWidth }> = [
  { channels: [36, 40, 44, 48], dfs: false, maxWidth: 160 },
  { channels: [52, 56, 60, 64], dfs: true, maxWidth: 160 },
  { channels: [100, 104, 108, 112, 116, 120, 124, 128], dfs: true, maxWidth: 160 },
  { channels: [132, 136, 140, 144], dfs: true, maxWidth: 80 },
  { channels: [149, 153, 157, 161], dfs: false, maxWidth: 80 },
  // 5825 MHz sits 25 MHz below the 5850 MHz band edge, so 165 is 20 MHz only
  { channels: [165], dfs: false, maxWidth: 20 },
]

// 5600-5650 MHz is the terminal doppler weather radar band; channels 120/124/128
// need updated DFS certification and many APs still refuse them (FCC KDB 905462)
const TDWR_CHANNELS = [120, 124, 128]

export const channels5: ChannelInfo[] = BLOCKS_5.flatMap(({ channels, dfs, maxWidth }) =>
  channels.map((channel) => ({
    channel,
    frequency: 5000 + 5 * channel,
    maxWidth,
    interference: dfs ? ("medium" as const) : ("low" as const),
    recommended: !dfs,
    dfs,
    ...(TDWR_CHANNELS.includes(channel)
      ? { note: "Overlaps TDWR weather radar (5600-5650 MHz); often unavailable" }
      : dfs
        ? { note: "DFS: radar detection can force a channel change" }
        : {}),
  }))
)

// 6 GHz: centre = 5950 + 5n MHz, n = 1, 5, 9 ... 233 gives the 59 channels of U-NII-5 through
// U-NII-8 (FCC 47 CFR 15.407, IEEE 802.11ax-2021); the top of the band is too narrow for 320 MHz.
function maxWidth6(channel: number): ChannelWidth {
  if (channel <= 189) return 320
  if (channel <= 221) return 160
  if (channel <= 229) return 40
  return 20
}

export const channels6: ChannelInfo[] = Array.from({ length: 59 }, (_, i) => 1 + i * 4).map(
  (channel) => ({
    channel,
    frequency: 5950 + 5 * channel,
    maxWidth: maxWidth6(channel),
    interference: "low" as const,
    recommended: true,
    dfs: false,
  })
)

export function channelsForBand(band: WirelessBand): ChannelInfo[] {
  if (band === "2.4") return channels24
  if (band === "5") return channels5
  return channels6
}

// per-stream phy rates at each amendment's top mcs, short GI: 11n MCS7, 11ac MCS9 (20 MHz
// caps at MCS8), 11ax MCS11, 11be MCS13.
const PHY_RATE_PER_STREAM: Record<WirelessStandard, Partial<Record<ChannelWidth, number>>> = {
  "802.11n": { 20: 72.2, 40: 150 },
  "802.11ac": { 20: 86.7, 40: 200, 80: 433.3, 160: 866.7 },
  "802.11ax": { 20: 143.4, 40: 286.8, 80: 600.4, 160: 1201 },
  "802.11be": { 20: 172.1, 40: 344.1, 80: 720.6, 160: 1441.2, 320: 2882.4 },
}

// 802.11ac is 5 GHz only (clause 21); 6 GHz operation is defined for HE and EHT
// only, so 802.11n and 802.11ac cannot be used there at all.
const BANDS_BY_STANDARD: Record<WirelessStandard, WirelessBand[]> = {
  "802.11n": ["2.4", "5"],
  "802.11ac": ["5"],
  "802.11ax": ["2.4", "5", "6"],
  "802.11be": ["2.4", "5", "6"],
}

// 2.4 GHz has no room for anything above 40 MHz; 320 MHz exists only in 6 GHz
const WIDTHS_BY_BAND: Record<WirelessBand, ChannelWidth[]> = {
  "2.4": [20, 40],
  "5": [20, 40, 80, 160],
  "6": [20, 40, 80, 160, 320],
}

export function supportsBand(standard: WirelessStandard, band: WirelessBand): boolean {
  return BANDS_BY_STANDARD[standard].includes(band)
}

export function availableWidths(standard: WirelessStandard, band: WirelessBand): ChannelWidth[] {
  if (!supportsBand(standard, band)) return []
  const rates = PHY_RATE_PER_STREAM[standard]
  return WIDTHS_BY_BAND[band].filter((width) => rates[width] !== undefined)
}

export interface CapacityResult {
  supported: boolean
  reason?: string
  theoretical: number
  realWorld: number
  perClient: number
  maxClients: number
  spatialStreams: number
}

export interface CapacityInput {
  standard: WirelessStandard
  band: WirelessBand
  width: ChannelWidth
  maxClients: number
  spatialStreams?: number
}

// midpoint of the 50-70% of phy rate that 802.11 overhead leaves for payload.
// a rule of thumb, not a figure from the standard.
export const REAL_WORLD_FACTOR = 0.6

const DEFAULT_SPATIAL_STREAMS = 2

export function calculateWiFiCapacity(input: CapacityInput): CapacityResult {
  const streams = Math.max(1, Math.trunc(input.spatialStreams ?? DEFAULT_SPATIAL_STREAMS))
  const maxClients = Math.max(1, Math.trunc(input.maxClients) || 1)
  const empty: CapacityResult = {
    supported: false,
    theoretical: 0,
    realWorld: 0,
    perClient: 0,
    maxClients,
    spatialStreams: streams,
  }

  if (!supportsBand(input.standard, input.band)) {
    return { ...empty, reason: `${input.standard} does not operate in the ${input.band} GHz band` }
  }

  const perStream = PHY_RATE_PER_STREAM[input.standard][input.width]
  if (perStream === undefined || !WIDTHS_BY_BAND[input.band].includes(input.width)) {
    return {
      ...empty,
      reason: `${input.standard} has no ${input.width} MHz mode in the ${input.band} GHz band`,
    }
  }

  const theoretical = Math.round(perStream * streams)
  const realWorld = Math.round(theoretical * REAL_WORLD_FACTOR)
  return {
    supported: true,
    theoretical,
    realWorld,
    // one decimal so a dense deployment does not read as 0 Mbps per client
    perClient: Math.round((realWorld / maxClients) * 10) / 10,
    maxClients,
    spatialStreams: streams,
  }
}

// autonomous Cisco IOS Aironet syntax: no 6 GHz radio and nothing past 802.11ac, so
// unsupported selections emit comments rather than invented commands
const RADIO_INTERFACE: Record<WirelessBand, string | null> = {
  "2.4": "Dot11Radio0",
  "5": "Dot11Radio1",
  "6": null,
}

function securityLines(config: WirelessConfig): {
  ssid: string[]
  radio: string[]
  global: string[]
} {
  switch (config.security) {
    case "wpa2":
      return {
        global: [],
        ssid: [
          "   authentication open",
          "   authentication key-management wpa version 2",
          "   wpa-psk ascii 0 [YOUR-PASSWORD-HERE]",
        ],
        radio: ["   encryption vlan 1 mode ciphers aes-ccm"],
      }
    case "wpa2-enterprise":
      return {
        global: [
          "radius-server host [RADIUS-SERVER-IP] auth-port 1812 acct-port 1813 key [RADIUS-KEY]",
          "aaa group server radius rad_eap",
          "   server [RADIUS-SERVER-IP] auth-port 1812 acct-port 1813",
          "aaa authentication login eap_methods group rad_eap",
        ],
        ssid: [
          "   authentication open eap eap_methods",
          "   authentication network-eap eap_methods",
          "   authentication key-management wpa version 2",
        ],
        radio: ["   encryption vlan 1 mode ciphers aes-ccm"],
      }
    case "wpa":
      return {
        global: [],
        ssid: [
          "   authentication open",
          "   authentication key-management wpa version 1",
          "   wpa-psk ascii 0 [YOUR-PASSWORD-HERE]",
        ],
        radio: ["   encryption vlan 1 mode ciphers tkip"],
      }
    case "wep":
      return {
        global: [],
        ssid: ["   authentication open"],
        radio: [
          "! WEP is broken; RC4 keystream recovery is trivial. Migrate to WPA2 or WPA3.",
          "   encryption vlan 1 mode wep mandatory",
          "   encryption vlan 1 key 1 size 128bit 0 [26-HEX-DIGIT-KEY] transmit-key",
        ],
      }
    case "wpa3":
      return {
        global: [],
        ssid: [
          "   authentication open",
          "! WPA3 (SAE) has no autonomous IOS equivalent; it needs a WLC or IOS-XE 9800",
          "! controller. Left as open here rather than emitting a command that does not exist.",
        ],
        radio: [],
      }
    default:
      return {
        global: [],
        ssid: ["   authentication open", "! Open network: no encryption and no authentication."],
        radio: [],
      }
  }
}

function widthLine(config: WirelessConfig): string[] {
  const width = Number.parseInt(config.bandwidth, 10)
  if (width === 20) return ["   channel width 20"]
  if (width === 40) return ["   channel width 40-above"]
  return [
    `! ${width} MHz channels are not configurable on autonomous IOS APs`,
    "! (channel width accepts 20, 40-above or 40-below only).",
  ]
}

function standardLines(config: WirelessConfig): string[] {
  switch (config.mode) {
    case "802.11n":
      return ["   dot11 extension aironet"]
    case "802.11ac":
      // 802.11ac comes from the radio module on 2700/3700 class APs; there is no
      // command that turns it on
      return ["! 802.11ac is enabled by the installed radio module, not by configuration."]
    default:
      return [
        `! ${config.mode} is not supported on autonomous IOS APs; use a WLC or IOS-XE 9800`,
        "! controller for Wi-Fi 6/6E/7 radios.",
      ]
  }
}

export function generateWirelessConfig(config: WirelessConfig): string {
  const lines: string[] = [
    "! Wireless Configuration - Generated by NetDash Toolkit",
    "! Target platform: Cisco Aironet autonomous IOS access point",
    `! SSID: ${config.ssid}`,
    `! Security: ${config.security.toUpperCase()}`,
    `! Band: ${config.band} GHz`,
    "!",
  ]

  const security = securityLines(config)
  if (security.global.length) {
    lines.push(...security.global, "!")
  }

  lines.push(`dot11 ssid ${config.ssid}`, "   vlan 1")
  // guest-mode puts the SSID in the beacon, so hiding it is "no guest-mode"
  lines.push(config.hidden ? "   no guest-mode" : "   guest-mode")
  lines.push(...security.ssid)

  const clients = Number.parseInt(config.maxClients, 10)
  if (!Number.isNaN(clients) && clients > 0) {
    lines.push(`   max-associations ${clients}`)
  }

  lines.push("!")

  const radio = RADIO_INTERFACE[config.band]
  if (!radio) {
    lines.push(
      "! 6 GHz has no autonomous IOS radio interface (Dot11Radio0 is 2.4 GHz and",
      "! Dot11Radio1 is 5 GHz). Configure 6 GHz on a WLC or IOS-XE 9800 controller.",
      "!"
    )
    return `${lines.join("\n")}\n`
  }

  lines.push(`interface ${radio}`, "   no shutdown", `   ssid ${config.ssid}`)

  if (config.channel !== "auto") {
    lines.push(`   channel ${config.channel}`)
  } else {
    lines.push("   channel least-congested")
  }

  // power local takes mW on the 2.4 GHz radio and dBm on the 5 GHz radio; a
  // percentage is not a value this platform accepts
  const power = Number.parseInt(config.power, 10)
  if (power === 100) {
    lines.push("   power local maximum")
  } else {
    lines.push(
      `! Transmit power target ${config.power}% of maximum: set "power local" in mW (2.4 GHz)`,
      "! or dBm (5 GHz) for this radio."
    )
  }

  lines.push("   station-role root")
  lines.push(...standardLines(config))
  lines.push(...widthLine(config))
  lines.push(...security.radio)

  // beacon period is in time units of 1024 us (IEEE 802.11 beacon interval),
  // not milliseconds
  const beacon = Number.parseInt(config.beaconInterval, 10)
  if (!Number.isNaN(beacon) && beacon > 0) {
    lines.push(`   beacon period ${beacon}`)
  }

  const dtim = Number.parseInt(config.dtimPeriod, 10)
  if (!Number.isNaN(dtim) && dtim > 0) {
    lines.push(`   beacon dtim-period ${dtim}`)
  }

  lines.push("   rts threshold 2347", "   fragment-threshold 2346", "!")
  lines.push(
    "! Apply to bridge group",
    `interface ${radio}.1`,
    "   encapsulation dot1Q 1 native",
    "   bridge-group 1",
    "!",
    "bridge 1 protocol ieee",
    "bridge 1 route ip"
  )

  return `${lines.join("\n")}\n`
}
