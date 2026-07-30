export const FIBER_GRADES = ["om1", "om2", "om3", "om4", "om5", "os1", "os2"] as const
export type FiberGrade = (typeof FIBER_GRADES)[number]

export interface FiberGradeSpec {
  name: string
  core: string
  multimode: boolean
  // wavelength in nm -> maximum cable attenuation in dB/km
  attenuation: Record<number, number>
  attenuationSource: string
  // ieee 802.3 supported reach in metres, per port type
  reach: Record<string, number>
}

// tia-568.3-d table 4 caps multimode cable at 3.5 dB/km @850 nm and 1.5 dB/km
// @1300 nm for every om grade; om grade sets modal bandwidth, not attenuation.
const MULTIMODE_ATTENUATION = { 850: 3.5, 1300: 1.5 }
const MULTIMODE_SOURCE = "TIA-568.3-D Table 4 (IEC 60793-2-10)"

export const FIBER_SPECS: Record<FiberGrade, FiberGradeSpec> = {
  om1: {
    name: "OM1 multimode",
    core: "62.5/125 um, 200 MHz-km @850 nm",
    multimode: true,
    attenuation: MULTIMODE_ATTENUATION,
    attenuationSource: MULTIMODE_SOURCE,
    reach: { "1000BASE-SX": 275, "10GBASE-SR": 33 },
  },
  om2: {
    name: "OM2 multimode",
    core: "50/125 um, 500 MHz-km @850 nm",
    multimode: true,
    attenuation: MULTIMODE_ATTENUATION,
    attenuationSource: MULTIMODE_SOURCE,
    reach: { "1000BASE-SX": 550, "10GBASE-SR": 82 },
  },
  om3: {
    name: "OM3 multimode",
    core: "50/125 um, 2000 MHz-km @850 nm",
    multimode: true,
    attenuation: MULTIMODE_ATTENUATION,
    attenuationSource: MULTIMODE_SOURCE,
    reach: {
      "1000BASE-SX": 550,
      "10GBASE-SR": 300,
      "40GBASE-SR4": 100,
      "100GBASE-SR4": 70,
    },
  },
  om4: {
    name: "OM4 multimode",
    core: "50/125 um, 4700 MHz-km @850 nm",
    multimode: true,
    attenuation: MULTIMODE_ATTENUATION,
    attenuationSource: MULTIMODE_SOURCE,
    reach: {
      "1000BASE-SX": 550,
      "10GBASE-SR": 400,
      "40GBASE-SR4": 150,
      "100GBASE-SR4": 100,
    },
  },
  om5: {
    name: "OM5 wideband multimode",
    core: "50/125 um, 4700 MHz-km @850 nm, SWDM to 953 nm",
    multimode: true,
    attenuation: MULTIMODE_ATTENUATION,
    attenuationSource: MULTIMODE_SOURCE,
    reach: {
      "1000BASE-SX": 550,
      "10GBASE-SR": 400,
      "40GBASE-SR4": 150,
      "100GBASE-SR4": 100,
    },
  },
  os1: {
    name: "OS1 single-mode",
    core: "9/125 um, tight-buffered indoor",
    multimode: false,
    attenuation: { 1310: 1.0, 1550: 1.0 },
    attenuationSource: "ISO/IEC 11801-1 Class OS1 (TIA-568.3-D inside plant: 1.0 dB/km)",
    reach: { "1000BASE-LX": 5000, "10GBASE-LR": 10000, "10GBASE-ER": 40000 },
  },
  os2: {
    name: "OS2 single-mode",
    core: "9/125 um, loose-tube low water peak",
    multimode: false,
    attenuation: { 1310: 0.4, 1550: 0.4 },
    attenuationSource: "ISO/IEC 11801-1 Class OS2 (TIA-568.3-D outside plant: 0.5 dB/km)",
    reach: { "1000BASE-LX": 5000, "10GBASE-LR": 10000, "10GBASE-ER": 40000 },
  },
}

export function wavelengthsFor(grade: FiberGrade): number[] {
  return Object.keys(FIBER_SPECS[grade].attenuation)
    .map(Number)
    .sort((a, b) => a - b)
}

// tia-568.3-d maximum insertion loss for a mated connector pair, and for a splice
export const MAX_CONNECTOR_PAIR_LOSS_DB = 0.75
export const MAX_SPLICE_LOSS_DB = 0.3

export const SPLICE_TYPES = ["fusion", "mechanical"] as const
export type SpliceType = (typeof SPLICE_TYPES)[number]

// typical field values; tia-568.3-d caps either method at 0.3 dB
export const SPLICE_LOSS_DB: Record<SpliceType, number> = { fusion: 0.1, mechanical: 0.3 }

// group index of a g.652 silica core, so light travels ~204 m/us in fibre
const FIBER_GROUP_INDEX = 1.4682
export const SPEED_OF_LIGHT_M_PER_S = 299792458

export interface FiberLinkResult {
  lengthKm: number
  lossPerKm: number
  cableLoss: number
  connectorLoss: number
  spliceLoss: number
  totalLoss: number
  powerBudget: number
  margin: number
  withinBudget: boolean
  propagationDelayUs: number
  reachWarnings: string[]
  warnings: string[]
}

export const LENGTH_UNITS = ["m", "ft", "km"] as const
export type LengthUnit = (typeof LENGTH_UNITS)[number]

// international foot, exactly 0.3048 m
const LENGTH_TO_METRES: Record<LengthUnit, number> = { m: 1, ft: 0.3048, km: 1000 }

export function toMetres(length: number, unit: LengthUnit): number {
  return length * LENGTH_TO_METRES[unit]
}

export function computeFiberLink(input: {
  grade: FiberGrade
  wavelengthNm: number
  length: string
  lengthUnit: LengthUnit
  connectorPairs: string
  spliceCount: string
  spliceType: SpliceType
  powerBudget: string
}): { result: FiberLinkResult | null; error: string } {
  const spec = FIBER_SPECS[input.grade]
  const lossPerKm = spec.attenuation[input.wavelengthNm]
  if (lossPerKm === undefined) {
    return { result: null, error: `${spec.name} is not specified at ${input.wavelengthNm} nm` }
  }

  const rawLength = Number(input.length)
  if (!input.length.trim()) return { result: null, error: "" }
  if (!Number.isFinite(rawLength) || rawLength <= 0) {
    return { result: null, error: "Cable length must be greater than 0" }
  }

  const connectorPairs = Number(input.connectorPairs || "0")
  const spliceCount = Number(input.spliceCount || "0")
  const powerBudget = Number(input.powerBudget)

  if (!Number.isInteger(connectorPairs) || connectorPairs < 0) {
    return { result: null, error: "Connector pairs must be a whole number of 0 or more" }
  }
  if (!Number.isInteger(spliceCount) || spliceCount < 0) {
    return { result: null, error: "Splice count must be a whole number of 0 or more" }
  }
  if (!Number.isFinite(powerBudget) || powerBudget <= 0) {
    return { result: null, error: "Power budget must be greater than 0 dB" }
  }

  const metres = toMetres(rawLength, input.lengthUnit)
  const lengthKm = metres / 1000

  const cableLoss = lengthKm * lossPerKm
  const connectorLoss = connectorPairs * MAX_CONNECTOR_PAIR_LOSS_DB
  const spliceLoss = spliceCount * SPLICE_LOSS_DB[input.spliceType]
  const totalLoss = cableLoss + connectorLoss + spliceLoss
  const margin = powerBudget - totalLoss

  const reachWarnings = Object.entries(spec.reach)
    .filter(([, limit]) => metres > limit)
    .map(([port, limit]) => `${port} is specified only to ${limit} m on ${spec.name} (IEEE 802.3)`)

  const warnings: string[] = []
  if (margin < 0) {
    warnings.push("Total loss exceeds the power budget, so the link will not come up")
  } else if (margin < 3) {
    warnings.push("Link margin under 3 dB leaves no room for ageing, repairs or dirty connectors")
  }
  if (input.spliceType === "mechanical" && spliceCount > 0) {
    warnings.push(
      `TIA-568.3-D caps any splice at ${MAX_SPLICE_LOSS_DB} dB; measure mechanical splices to confirm`
    )
  }
  if (connectorPairs === 0) {
    warnings.push("A real channel has at least 2 mated connector pairs, one at each end")
  }

  const round = (value: number) => Math.round(value * 1000) / 1000

  return {
    result: {
      lengthKm: round(lengthKm),
      lossPerKm,
      cableLoss: round(cableLoss),
      connectorLoss: round(connectorLoss),
      spliceLoss: round(spliceLoss),
      totalLoss: round(totalLoss),
      powerBudget,
      margin: round(margin),
      withinBudget: margin >= 0,
      propagationDelayUs: round((metres * FIBER_GROUP_INDEX) / SPEED_OF_LIGHT_M_PER_S / 1e-6),
      reachWarnings,
      warnings,
    },
    error: "",
  }
}

export const COPPER_CATEGORIES = ["cat5e", "cat6", "cat6a", "cat7", "cat8"] as const
export type CopperCategory = (typeof COPPER_CATEGORIES)[number]

export interface CopperCategorySpec {
  name: string
  class: string
  bandwidthMhz: number
  maxChannelM: number
  maxPermanentLinkM: number
  // highest ieee 802.3 baset rate reachable over a full-length channel
  fullLengthBaseT: string
  // 10gbase-t reach in metres; 0 when the category does not support it
  tenGigMaxM: number
  source: string
  notes: string[]
}

export const COPPER_SPECS: Record<CopperCategory, CopperCategorySpec> = {
  cat5e: {
    name: "Cat5e",
    class: "Class D",
    bandwidthMhz: 100,
    maxChannelM: 100,
    maxPermanentLinkM: 90,
    fullLengthBaseT: "2.5GBASE-T",
    tenGigMaxM: 0,
    source: "TIA-568.2-D; IEEE 802.3 Clause 126",
    notes: ["2.5GBASE-T reaches 100 m on Cat5e per IEEE 802.3 Clause 126 (802.3bz)"],
  },
  cat6: {
    name: "Cat6",
    class: "Class E",
    bandwidthMhz: 250,
    maxChannelM: 100,
    maxPermanentLinkM: 90,
    fullLengthBaseT: "5GBASE-T",
    tenGigMaxM: 55,
    source: "TIA-568.2-D; IEEE 802.3 Clause 55 and 126; TIA TSB-155-A",
    notes: [
      "5GBASE-T reaches 100 m on Cat6 per IEEE 802.3 Clause 126",
      "10GBASE-T is limited to 55 m, and to 37 m where alien crosstalk is not mitigated (TSB-155-A)",
    ],
  },
  cat6a: {
    name: "Cat6A",
    class: "Class EA",
    bandwidthMhz: 500,
    maxChannelM: 100,
    maxPermanentLinkM: 90,
    fullLengthBaseT: "10GBASE-T",
    tenGigMaxM: 100,
    source: "TIA-568.2-D; IEEE 802.3 Clause 55",
    notes: ["10GBASE-T reaches the full 100 m channel on Cat6A"],
  },
  cat7: {
    name: "Cat7 / Class F",
    class: "Class F",
    bandwidthMhz: 600,
    maxChannelM: 100,
    maxPermanentLinkM: 90,
    fullLengthBaseT: "10GBASE-T",
    tenGigMaxM: 100,
    source: "ISO/IEC 11801-1 Class F (not recognised by TIA-568)",
    notes: [
      "Class F is an ISO/IEC cabling class; TIA-568 has no Category 7",
      "Needs GG45 or TERA connectors to reach the full 600 MHz",
    ],
  },
  cat8: {
    name: "Cat8",
    class: "Class I / II",
    bandwidthMhz: 2000,
    maxChannelM: 30,
    maxPermanentLinkM: 24,
    fullLengthBaseT: "40GBASE-T",
    tenGigMaxM: 30,
    source: "TIA-568.2-D Category 8; IEEE 802.3 Clause 113",
    notes: ["25GBASE-T and 40GBASE-T reach 30 m over a 2-connector channel"],
  },
}

// tia-568.2-d propagation delay limits at 10 MHz
export const MAX_CHANNEL_DELAY_NS = 555
export const MAX_PERMANENT_LINK_DELAY_NS = 498
export const MAX_PATCH_CORD_TOTAL_M = 10

export interface CopperLinkResult {
  permanentLinkM: number
  patchCordM: number
  channelM: number
  withinSpec: boolean
  supports10G: boolean
  nvp: number
  channelDelayNs: number
  permanentLinkDelayNs: number
  warnings: string[]
}

export function computeCopperLink(input: {
  category: CopperCategory
  permanentLink: string
  patchCord: string
  nvp: string
}): { result: CopperLinkResult | null; error: string } {
  const spec = COPPER_SPECS[input.category]

  if (!input.permanentLink.trim()) return { result: null, error: "" }

  const permanentLinkM = Number(input.permanentLink)
  const patchCordM = input.patchCord.trim() === "" ? 0 : Number(input.patchCord)
  const nvp = input.nvp.trim() === "" ? 0.65 : Number(input.nvp)

  if (!Number.isFinite(permanentLinkM) || permanentLinkM <= 0) {
    return { result: null, error: "Permanent link length must be greater than 0" }
  }
  if (!Number.isFinite(patchCordM) || patchCordM < 0) {
    return { result: null, error: "Patch cord length cannot be negative" }
  }
  if (!Number.isFinite(nvp) || nvp <= 0 || nvp > 1) {
    return { result: null, error: "Nominal velocity of propagation must be between 0 and 1" }
  }

  const channelM = permanentLinkM + patchCordM
  const velocity = nvp * SPEED_OF_LIGHT_M_PER_S
  const delay = (metres: number) => Math.round((metres / velocity / 1e-9) * 10) / 10

  const warnings: string[] = []
  if (channelM > spec.maxChannelM) {
    warnings.push(`Channel exceeds the ${spec.maxChannelM} m maximum for ${spec.name}`)
  }
  if (permanentLinkM > spec.maxPermanentLinkM) {
    warnings.push(`Permanent link exceeds the ${spec.maxPermanentLinkM} m maximum`)
  }
  if (patchCordM > MAX_PATCH_CORD_TOTAL_M) {
    warnings.push(`Total cord length in a channel should not exceed ${MAX_PATCH_CORD_TOTAL_M} m`)
  }
  if (spec.tenGigMaxM > 0 && channelM > spec.tenGigMaxM) {
    warnings.push(`10GBASE-T is specified only to ${spec.tenGigMaxM} m on ${spec.name}`)
  }
  if (spec.tenGigMaxM === 0) {
    warnings.push(`${spec.name} does not support 10GBASE-T at any length`)
  }

  const channelDelayNs = delay(channelM)
  const permanentLinkDelayNs = delay(permanentLinkM)
  if (channelDelayNs > MAX_CHANNEL_DELAY_NS) {
    warnings.push(
      `Channel propagation delay exceeds the TIA-568.2-D limit of ${MAX_CHANNEL_DELAY_NS} ns`
    )
  }
  if (permanentLinkDelayNs > MAX_PERMANENT_LINK_DELAY_NS) {
    warnings.push(
      `Permanent link delay exceeds the TIA-568.2-D limit of ${MAX_PERMANENT_LINK_DELAY_NS} ns`
    )
  }

  return {
    result: {
      permanentLinkM,
      patchCordM,
      channelM: Math.round(channelM * 100) / 100,
      withinSpec: channelM <= spec.maxChannelM && permanentLinkM <= spec.maxPermanentLinkM,
      supports10G: spec.tenGigMaxM > 0 && channelM <= spec.tenGigMaxM,
      nvp,
      channelDelayNs,
      permanentLinkDelayNs,
      warnings,
    },
    error: "",
  }
}
