// a MAC is a device fingerprint, so the local map wins and the network is touched only on explicit
// opt-in. common prefixes only, not the full IEEE registry; the public APIs cap at ~1 req/s.

import { normalizeMac } from "@/lib/parsers"

export const OUI_VENDORS: Record<string, string> = {
  // VMware
  "005056": "VMware",
  "000C29": "VMware",
  "001C14": "VMware",
  // Microsoft
  "00155D": "Microsoft Corporation",
  "0017FA": "Microsoft Corporation",
  "0003FF": "Microsoft Corporation",
  // Intel
  "001B21": "Intel Corporation",
  ACDE48: "Intel Corporation",
  "001302": "Intel Corporation",
  "001517": "Intel Corporation",
  "001676": "Intel Corporation",
  "0019D1": "Intel Corporation",
  "001E67": "Intel Corporation",
  "00216A": "Intel Corporation",
  "0024D7": "Intel Corporation",
  // VirtualBox/QEMU
  "080027": "Oracle VirtualBox",
  "525400": "QEMU/KVM",
  "001C42": "Parallels",
  "00163E": "Xensource (Citrix)",
  // Apple
  F01898: "Apple Inc",
  B42E99: "Apple Inc",
  "000393": "Apple Inc",
  "000502": "Apple Inc",
  "000A27": "Apple Inc",
  "000A95": "Apple Inc",
  "000D93": "Apple Inc",
  "001124": "Apple Inc",
  "001451": "Apple Inc",
  "0016CB": "Apple Inc",
  "0017F2": "Apple Inc",
  "0019E3": "Apple Inc",
  "001B63": "Apple Inc",
  "001EC2": "Apple Inc",
  "0021E9": "Apple Inc",
  "002312": "Apple Inc",
  "0023DF": "Apple Inc",
  "002500": "Apple Inc",
  "00254B": "Apple Inc",
  "0025BC": "Apple Inc",
  "002608": "Apple Inc",
  "00264A": "Apple Inc",
  "0026B0": "Apple Inc",
  "0026BB": "Apple Inc",
  // Cisco
  "00000C": "Cisco Systems",
  "000142": "Cisco Systems",
  "000143": "Cisco Systems",
  "000196": "Cisco Systems",
  "000197": "Cisco Systems",
  "000216": "Cisco Systems",
  "000217": "Cisco Systems",
  "00023D": "Cisco Systems",
  "00024A": "Cisco Systems",
  "00024B": "Cisco Systems",
  // Dell
  "001422": "Dell Inc",
  "001AA0": "Dell Inc",
  "00219B": "Dell Inc",
  "0023AE": "Dell Inc",
  "0024E8": "Dell Inc",
  "002564": "Dell Inc",
  "0026B9": "Dell Inc",
  B083FE: "Dell Inc",
  D067E5: "Dell Inc",
  F01FAF: "Dell Inc",
  // HP/HPE
  "001083": "Hewlett Packard Enterprise",
  "00110A": "Hewlett Packard Enterprise",
  "001321": "Hewlett Packard Enterprise",
  "001560": "Hewlett Packard Enterprise",
  "001635": "Hewlett Packard Enterprise",
  "001708": "Hewlett Packard Enterprise",
  "001871": "Hewlett Packard Enterprise",
  "0019BB": "Hewlett Packard Enterprise",
  "001A4B": "Hewlett Packard Enterprise",
  "001B78": "Hewlett Packard Enterprise",
  "001CC4": "Hewlett Packard Enterprise",
  "001E0B": "Hewlett Packard Enterprise",
  "001F29": "Hewlett Packard Enterprise",
  "00215A": "Hewlett Packard Enterprise",
  "002264": "Hewlett Packard Enterprise",
  "00237D": "Hewlett Packard Enterprise",
  "002481": "Hewlett Packard Enterprise",
  "0025B3": "Hewlett Packard Enterprise",
  "002655": "Hewlett Packard Enterprise",
  // Juniper
  "000585": "Juniper Networks",
  "00121E": "Juniper Networks",
  "0017CB": "Juniper Networks",
  "0019E2": "Juniper Networks",
  "001BC0": "Juniper Networks",
  "001DB5": "Juniper Networks",
  "002159": "Juniper Networks",
  "002283": "Juniper Networks",
  "00239C": "Juniper Networks",
  "0024DC": "Juniper Networks",
  "002688": "Juniper Networks",
  "2C6BF5": "Juniper Networks",
  "3C6104": "Juniper Networks",
  "5C5EAB": "Juniper Networks",
  "841888": "Juniper Networks",
  "84B59C": "Juniper Networks",
  "9CCC83": "Juniper Networks",
  // Arista
  "001C73": "Arista Networks",
  "28993A": "Arista Networks",
  "444CA8": "Arista Networks",
  "500800": "Arista Networks",
  // Fortinet
  "00090F": "Fortinet",
  "906CAC": "Fortinet",
  // Palo Alto
  "001B17": "Palo Alto Networks",
  "8CEA1B": "Palo Alto Networks",
  // Ubiquiti
  "00156D": "Ubiquiti Networks",
  "0418D6": "Ubiquiti Networks",
  "24A43C": "Ubiquiti Networks",
  "687251": "Ubiquiti Networks",
  "788A20": "Ubiquiti Networks",
  "802AA8": "Ubiquiti Networks",
  B4FBE4: "Ubiquiti Networks",
  DC9FDB: "Ubiquiti Networks",
  E8DE27: "Ubiquiti Networks",
  F09FC2: "Ubiquiti Networks",
  FCECDA: "Ubiquiti Networks",
  // Raspberry Pi
  DCA632: "Raspberry Pi Foundation",
  B827EB: "Raspberry Pi Foundation",
  E45F01: "Raspberry Pi Foundation",
  // Network Equipment
  "000496": "Extreme Networks",
  "00E02B": "Extreme Networks",
  "000130": "Foundry Networks",
  "00E052": "Foundry Networks",
  "00A0C9": "Intel Corporation",
  "00E081": "Tyan Computer",
  "0020AF": "3Com Corporation",
  "005004": "3Com Corporation",
  "006008": "3Com Corporation",
  "006097": "3Com Corporation",
  "00A024": "3Com Corporation",
  // Consumer Electronics
  "00E04C": "Realtek Semiconductor",
  "001217": "Cisco-Linksys",
  "00E018": "Asustek Computer",
  "001731": "Asustek Computer",
  "002354": "Asustek Computer",
  "485B39": "Asustek Computer",
  "00E09D": "Shandong Intelligent Optical",
  "001E58": "D-Link Corporation",
  "0019E0": "TP-Link Technologies",
  "5C899A": "TP-Link Technologies",
  E894F6: "TP-Link Technologies",
  "001438": "Hewlett Packard",
  "0015C5": "Dell",
  B8AC6F: "Dell",
  "0050F2": "Microsoft",
  "001DD8": "Microsoft",
  "7C1E52": "Microsoft",
  // Samsung
  "002119": "Samsung Electronics",
  "0021D1": "Samsung Electronics",
  "002339": "Samsung Electronics",
  "0024E9": "Samsung Electronics",
  "0025C3": "Samsung Electronics",
  "0026E2": "Samsung Electronics",
  "00265D": "Samsung Electronics",
  "5CCACF": "Samsung Electronics",
  "942E63": "Samsung Electronics",
  A82BB9: "Samsung Electronics",
  // Google
  "001A11": "Google",
  "3C5AB4": "Google",
  "54608B": "Google",
  "94EB2C": "Google",
  F4F5D8: "Google",
  // Amazon
  "0C47C9": "Amazon Technologies",
  "18742E": "Amazon Technologies",
  "34D270": "Amazon Technologies",
  "44650D": "Amazon Technologies",
  "68372B": "Amazon Technologies",
  "84D6D0": "Amazon Technologies",
  A002DC: "Amazon Technologies",
  FC65DE: "Amazon Technologies",
}

export const OUI_PREFIX_COUNT = Object.keys(OUI_VENDORS).length
export const OUI_VENDOR_COUNT = new Set(Object.values(OUI_VENDORS)).size

export interface ParsedMacInput {
  /** aa:bb:cc:dd:ee:ff, or null when only an OUI was supplied */
  mac: string | null
  /** 6 uppercase hex digits, no separators */
  oui: string
  /** aa:bb:cc */
  ouiFormatted: string
  isFullMac: boolean
}

function formatOui(oui: string): string {
  return `${oui.slice(0, 2)}:${oui.slice(2, 4)}:${oui.slice(4, 6)}`
}

// normalize before slicing: substring(0, 8) on raw input turned "001122334455" into "00112233"
export function parseMacInput(input: string): ParsedMacInput | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const mac = normalizeMac(trimmed)
    const oui = mac.split(":").slice(0, 3).join("").toUpperCase()
    return { mac, oui, ouiFormatted: formatOui(oui), isFullMac: true }
  } catch {
    // oui-only forms: 001122, 00:11:22, 00-11-22, 0:1:2
    const groups = trimmed.toLowerCase().split(/[:.-]/)
    const hex =
      groups.length === 3 && groups.every((g) => /^[0-9a-f]{1,2}$/.test(g))
        ? groups.map((g) => g.padStart(2, "0")).join("")
        : trimmed.toLowerCase().replace(/[^0-9a-f]/g, "")
    if (hex.length !== 6) return null
    const oui = hex.toUpperCase()
    return { mac: null, oui, ouiFormatted: formatOui(oui), isFullMac: false }
  }
}

export type OuiSource = "offline" | "remote" | "cache"

export interface OuiResult {
  input: string
  mac: string | null
  oui: string
  ouiFormatted: string
  vendor: string | null
  found: boolean
  source: OuiSource | null
  /** set when a remote call was attempted and failed */
  error?: string
  /** true when the locally-administered bit is set - such a MAC is randomized */
  locallyAdministered: boolean
  multicast: boolean
}

export function lookupLocal(oui: string): string | null {
  return OUI_VENDORS[oui.toUpperCase()] ?? null
}

/** first octet bit 1 = locally administered (randomized), bit 0 = multicast */
export function macFlags(oui: string): { locallyAdministered: boolean; multicast: boolean } {
  const first = parseInt(oui.slice(0, 2), 16)
  if (Number.isNaN(first)) return { locallyAdministered: false, multicast: false }
  return { locallyAdministered: (first & 0x02) !== 0, multicast: (first & 0x01) !== 0 }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

// one provider (maclookup.app, CORS, no key); the old allorigins proxy saw the address for nothing
export async function lookupRemote(
  oui: string,
  fetchImpl: FetchLike = fetch
): Promise<{ vendor: string | null; error?: string }> {
  try {
    const response = await fetchImpl(`https://api.maclookup.app/v2/macs/${oui}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return { vendor: null, error: `maclookup.app returned ${response.status}` }
    const data = (await response.json()) as { found?: boolean; company?: string }
    if (data.found && data.company) return { vendor: data.company }
    return { vendor: null }
  } catch (e) {
    return { vendor: null, error: e instanceof Error ? e.message : "network request failed" }
  }
}

export interface LookupSettings {
  /** when true nothing ever leaves the device */
  offlineOnly: boolean
  fetchImpl?: FetchLike
  /** prefix -> vendor (or null for a confirmed remote miss); mutated in place */
  cache?: Map<string, string | null>
}

// a remote found:false used to fall straight through to "Unknown vendor" without reading the map
export async function lookupOui(input: string, settings: LookupSettings): Promise<OuiResult> {
  const parsed = parseMacInput(input)
  if (!parsed) {
    return {
      input,
      mac: null,
      oui: "",
      ouiFormatted: "",
      vendor: null,
      found: false,
      source: null,
      error: "Not a MAC address or OUI prefix",
      locallyAdministered: false,
      multicast: false,
    }
  }

  const base = {
    input,
    mac: parsed.mac,
    oui: parsed.oui,
    ouiFormatted: parsed.ouiFormatted,
    ...macFlags(parsed.oui),
  }

  const local = lookupLocal(parsed.oui)
  if (local) return { ...base, vendor: local, found: true, source: "offline" }

  const cache = settings.cache
  if (cache?.has(parsed.oui)) {
    const cached = cache.get(parsed.oui) ?? null
    return { ...base, vendor: cached, found: cached !== null, source: "cache" }
  }

  if (settings.offlineOnly) {
    return {
      ...base,
      vendor: null,
      found: false,
      source: "offline",
      error: "Not in the bundled database (offline-only mode - no lookup was sent)",
    }
  }

  const remote = await lookupRemote(parsed.oui, settings.fetchImpl)
  cache?.set(parsed.oui, remote.vendor)
  return {
    ...base,
    vendor: remote.vendor,
    found: remote.vendor !== null,
    source: "remote",
    error:
      remote.error ?? (remote.vendor === null ? "No vendor registered for this prefix" : undefined),
  }
}

/** unique OUI prefixes across the input lines, preserving first-seen order */
export function dedupeByOui(lines: string[]): { oui: string; inputs: string[] }[] {
  const groups = new Map<string, string[]>()
  const unparseable: { oui: string; inputs: string[] }[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const parsed = parseMacInput(line)
    if (!parsed) {
      unparseable.push({ oui: "", inputs: [line] })
      continue
    }
    const existing = groups.get(parsed.oui)
    if (existing) existing.push(line)
    else groups.set(parsed.oui, [line])
  }

  return [...[...groups].map(([oui, inputs]) => ({ oui, inputs })), ...unparseable]
}
