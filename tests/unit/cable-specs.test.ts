import { describe, expect, it } from "vitest"
import {
  COPPER_SPECS,
  FIBER_GRADES,
  FIBER_SPECS,
  MAX_CHANNEL_DELAY_NS,
  MAX_CONNECTOR_PAIR_LOSS_DB,
  MAX_PERMANENT_LINK_DELAY_NS,
  MAX_SPLICE_LOSS_DB,
  SPLICE_LOSS_DB,
  computeCopperLink,
  computeFiberLink,
  toMetres,
  wavelengthsFor,
} from "@/lib/cable-specs"

describe("fiber attenuation matches the published maxima", () => {
  it("caps every multimode grade at the tia-568.3-d table 4 figures", () => {
    // om grade sets modal bandwidth, not attenuation: all om grades are
    // 3.5 dB/km @850 nm and 1.5 dB/km @1300 nm
    for (const grade of ["om1", "om2", "om3", "om4", "om5"] as const) {
      expect(FIBER_SPECS[grade].attenuation[850], grade).toBe(3.5)
      expect(FIBER_SPECS[grade].attenuation[1300], grade).toBe(1.5)
    }
  })

  it("uses the iso/iec 11801 single-mode class figures", () => {
    expect(FIBER_SPECS.os1.attenuation[1310]).toBe(1.0)
    expect(FIBER_SPECS.os1.attenuation[1550]).toBe(1.0)
    expect(FIBER_SPECS.os2.attenuation[1310]).toBe(0.4)
    expect(FIBER_SPECS.os2.attenuation[1550]).toBe(0.4)
  })

  it("offers only wavelengths the grade is specified at", () => {
    expect(wavelengthsFor("om3")).toEqual([850, 1300])
    expect(wavelengthsFor("os2")).toEqual([1310, 1550])
    for (const grade of FIBER_GRADES) {
      const spec = FIBER_SPECS[grade]
      expect(wavelengthsFor(grade).length).toBeGreaterThan(0)
      expect(spec.attenuationSource).toMatch(/TIA|ISO/)
    }
  })

  it("uses the tia-568.3-d connector and splice maxima", () => {
    expect(MAX_CONNECTOR_PAIR_LOSS_DB).toBe(0.75)
    expect(MAX_SPLICE_LOSS_DB).toBe(0.3)
    // a mechanical splice modelled at 0.5 dB was above the standard's own cap
    expect(SPLICE_LOSS_DB.mechanical).toBeLessThanOrEqual(MAX_SPLICE_LOSS_DB)
    expect(SPLICE_LOSS_DB.fusion).toBe(0.1)
  })

  it("records the ieee 802.3 reach for each grade", () => {
    expect(FIBER_SPECS.om1.reach["10GBASE-SR"]).toBe(33)
    expect(FIBER_SPECS.om2.reach["10GBASE-SR"]).toBe(82)
    expect(FIBER_SPECS.om3.reach["10GBASE-SR"]).toBe(300)
    expect(FIBER_SPECS.om4.reach["10GBASE-SR"]).toBe(400)
    expect(FIBER_SPECS.om3.reach["40GBASE-SR4"]).toBe(100)
    expect(FIBER_SPECS.om4.reach["40GBASE-SR4"]).toBe(150)
    expect(FIBER_SPECS.om3.reach["100GBASE-SR4"]).toBe(70)
    expect(FIBER_SPECS.om4.reach["100GBASE-SR4"]).toBe(100)
    expect(FIBER_SPECS.om1.reach["1000BASE-SX"]).toBe(275)
    expect(FIBER_SPECS.om2.reach["1000BASE-SX"]).toBe(550)
    expect(FIBER_SPECS.os2.reach["10GBASE-LR"]).toBe(10000)
    expect(FIBER_SPECS.os2.reach["10GBASE-ER"]).toBe(40000)
  })
})

describe("fiber loss budget", () => {
  const base = {
    grade: "os2",
    wavelengthNm: 1310,
    length: "10",
    lengthUnit: "km",
    connectorPairs: "2",
    spliceCount: "0",
    spliceType: "fusion",
    powerBudget: "10",
  } as const

  it("adds cable, connector and splice loss", () => {
    const { result } = computeFiberLink(base)
    // 10 km * 0.4 = 4 dB cable, 2 * 0.75 = 1.5 dB connectors
    expect(result?.cableLoss).toBe(4)
    expect(result?.connectorLoss).toBe(1.5)
    expect(result?.totalLoss).toBe(5.5)
    expect(result?.margin).toBe(4.5)
    expect(result?.withinBudget).toBe(true)
  })

  it("counts splices at the configured per-splice loss", () => {
    const fusion = computeFiberLink({ ...base, spliceCount: "4" })
    expect(fusion.result?.spliceLoss).toBe(0.4)
    const mechanical = computeFiberLink({ ...base, spliceCount: "4", spliceType: "mechanical" })
    expect(mechanical.result?.spliceLoss).toBeCloseTo(1.2, 9)
  })

  it("converts feet with the international foot", () => {
    expect(toMetres(1, "ft")).toBe(0.3048)
    expect(toMetres(3280.84, "ft")).toBeCloseTo(1000, 2)
    const feet = computeFiberLink({ ...base, length: "3280.84", lengthUnit: "ft" })
    expect(feet.result?.lengthKm).toBeCloseTo(1, 3)
  })

  it("flags a run past the ieee 802.3 reach for the grade", () => {
    const om3 = computeFiberLink({
      ...base,
      grade: "om3",
      wavelengthNm: 850,
      length: "350",
      lengthUnit: "m",
    })
    // 350 m is inside 10GBASE-SR on om3 (300 m is the limit, so it is flagged)
    expect(om3.result?.reachWarnings.join(" ")).toMatch(/10GBASE-SR is specified only to 300 m/)
    expect(om3.result?.reachWarnings.join(" ")).toMatch(/40GBASE-SR4 is specified only to 100 m/)

    const short = computeFiberLink({
      ...base,
      grade: "om4",
      wavelengthNm: 850,
      length: "50",
      lengthUnit: "m",
    })
    expect(short.result?.reachWarnings).toEqual([])
  })

  it("warns when the budget is blown and when the margin is thin", () => {
    const blown = computeFiberLink({ ...base, length: "40", powerBudget: "10" })
    expect(blown.result?.withinBudget).toBe(false)
    expect(blown.result?.warnings.join(" ")).toMatch(/will not come up/)

    const thin = computeFiberLink({ ...base, length: "20", powerBudget: "10" })
    expect(thin.result?.margin).toBeCloseTo(0.5, 9)
    expect(thin.result?.warnings.join(" ")).toMatch(/under 3 dB/)
  })

  it("reports propagation delay from the silica group index", () => {
    // ~4.9 us per km of fibre
    const { result } = computeFiberLink({ ...base, length: "1", lengthUnit: "km" })
    expect(result?.propagationDelayUs).toBeCloseTo(4.898, 2)
  })

  it("rejects nonsense instead of computing with a substituted value", () => {
    expect(computeFiberLink({ ...base, length: "0" }).result).toBeNull()
    expect(computeFiberLink({ ...base, length: "-5" }).result).toBeNull()
    expect(computeFiberLink({ ...base, length: "" }).error).toBe("")
    expect(computeFiberLink({ ...base, powerBudget: "0" }).result).toBeNull()
    expect(computeFiberLink({ ...base, connectorPairs: "1.5" }).result).toBeNull()
    // om grades are not specified at 1310 nm
    expect(computeFiberLink({ ...base, grade: "om3", wavelengthNm: 1310 }).error).toMatch(/1310/)
  })
})

describe("copper category limits", () => {
  it("uses the tia-568.2-d channel and permanent link model", () => {
    for (const category of ["cat5e", "cat6", "cat6a", "cat7"] as const) {
      expect(COPPER_SPECS[category].maxChannelM, category).toBe(100)
      expect(COPPER_SPECS[category].maxPermanentLinkM, category).toBe(90)
    }
    // category 8 is a 30 m, 2-connector channel
    expect(COPPER_SPECS.cat8.maxChannelM).toBe(30)
    expect(COPPER_SPECS.cat8.maxPermanentLinkM).toBe(24)
  })

  it("credits cat5e and cat6 with the ieee 802.3 clause 126 rates", () => {
    // 2.5GBASE-T reaches 100 m on cat5e, so "1 Gbps max" understated it
    expect(COPPER_SPECS.cat5e.fullLengthBaseT).toBe("2.5GBASE-T")
    expect(COPPER_SPECS.cat6.fullLengthBaseT).toBe("5GBASE-T")
    expect(COPPER_SPECS.cat6a.fullLengthBaseT).toBe("10GBASE-T")
    expect(COPPER_SPECS.cat8.fullLengthBaseT).toBe("40GBASE-T")
  })

  it("records 10gbase-t reach per category", () => {
    expect(COPPER_SPECS.cat5e.tenGigMaxM).toBe(0)
    expect(COPPER_SPECS.cat6.tenGigMaxM).toBe(55)
    expect(COPPER_SPECS.cat6a.tenGigMaxM).toBe(100)
    expect(COPPER_SPECS.cat6.notes.join(" ")).toMatch(/37 m/)
  })

  it("attributes cat7 to iso/iec, which is the only standard that defines it", () => {
    expect(COPPER_SPECS.cat7.source).toMatch(/ISO\/IEC 11801/)
    expect(COPPER_SPECS.cat7.notes.join(" ")).toMatch(/TIA-568 has no Category 7/)
  })
})

describe("copper channel calculation", () => {
  const base = { category: "cat6a", permanentLink: "90", patchCord: "10", nvp: "0.65" } as const

  it("sums the permanent link and cords into the channel", () => {
    const { result } = computeCopperLink(base)
    expect(result?.channelM).toBe(100)
    expect(result?.withinSpec).toBe(true)
    expect(result?.supports10G).toBe(true)
    expect(result?.warnings).toEqual([])
  })

  it("flags an over-length channel and permanent link", () => {
    const { result } = computeCopperLink({ ...base, permanentLink: "95", patchCord: "12" })
    expect(result?.withinSpec).toBe(false)
    expect(result?.warnings.join(" ")).toMatch(/Channel exceeds the 100 m maximum/)
    expect(result?.warnings.join(" ")).toMatch(/Permanent link exceeds the 90 m maximum/)
    expect(result?.warnings.join(" ")).toMatch(/cord length in a channel should not exceed 10 m/)
  })

  it("knows cat6 loses 10gbase-t past 55 m", () => {
    const short = computeCopperLink({
      ...base,
      category: "cat6",
      permanentLink: "45",
      patchCord: "5",
    })
    expect(short.result?.supports10G).toBe(true)

    const long = computeCopperLink({ ...base, category: "cat6" })
    expect(long.result?.supports10G).toBe(false)
    expect(long.result?.warnings.join(" ")).toMatch(/10GBASE-T is specified only to 55 m/)
  })

  it("says plainly that cat5e never carries 10gbase-t", () => {
    const { result } = computeCopperLink({ ...base, category: "cat5e", permanentLink: "20" })
    expect(result?.supports10G).toBe(false)
    expect(result?.warnings.join(" ")).toMatch(/does not support 10GBASE-T at any length/)
  })

  it("computes propagation delay and compares it to tia-568.2-d", () => {
    const { result } = computeCopperLink(base)
    // 100 m at 0.65c is about 513 ns, inside the 555 ns channel limit
    expect(result?.channelDelayNs).toBeCloseTo(513, 0)
    expect(result?.channelDelayNs).toBeLessThan(MAX_CHANNEL_DELAY_NS)
    expect(result?.permanentLinkDelayNs).toBeCloseTo(461.6, 0)
    expect(result?.permanentLinkDelayNs).toBeLessThan(MAX_PERMANENT_LINK_DELAY_NS)

    // a slow cable breaches the limit before it breaches the length limit
    const slow = computeCopperLink({ ...base, nvp: "0.55" })
    expect(slow.result?.channelDelayNs).toBeGreaterThan(MAX_CHANNEL_DELAY_NS)
    expect(slow.result?.warnings.join(" ")).toMatch(/exceeds the TIA-568.2-D limit of 555 ns/)
  })

  it("rejects an impossible velocity factor", () => {
    expect(computeCopperLink({ ...base, nvp: "1.5" }).result).toBeNull()
    expect(computeCopperLink({ ...base, nvp: "0" }).result).toBeNull()
    expect(computeCopperLink({ ...base, permanentLink: "0" }).result).toBeNull()
    expect(computeCopperLink({ ...base, permanentLink: "" }).error).toBe("")
  })
})
