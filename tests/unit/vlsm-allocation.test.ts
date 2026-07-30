import { describe, expect, it } from "vitest"
import { calculateVLSM } from "@/lib/vlsm-utils"
import type { VLSMRequirement } from "@/lib/vlsm-utils"
import { ipv4ToInt } from "@/lib/network-utils"

// an allocator that silently produces an invalid plan is worse than one that
// fails, so these assert the three properties a plan must have: no two blocks
// share an address, every block starts on its own boundary, and an impossible
// requirement set comes back as a failure rather than a plausible-looking plan.

function req(name: string, hostsRequired: number): VLSMRequirement {
  return { id: name, name, hostsRequired }
}

function blocks(network: string, prefix: number, requirements: VLSMRequirement[]) {
  const plan = calculateVLSM(network, prefix, requirements)
  return {
    plan,
    ranges: plan.allocations.map((allocation) => {
      const start = ipv4ToInt(allocation.network)
      const size = 2 ** (32 - allocation.prefix)
      return {
        name: allocation.name,
        start,
        end: start + size - 1,
        size,
        prefix: allocation.prefix,
      }
    }),
  }
}

describe("allocation is disjoint and aligned", () => {
  const cases: Array<{ network: string; prefix: number; hosts: number[] }> = [
    { network: "10.0.0.0", prefix: 20, hosts: [500, 120, 50, 10, 5] },
    { network: "192.168.0.0", prefix: 16, hosts: [1000, 1000, 500, 250, 120, 60, 30, 14, 6, 2, 1] },
    { network: "172.16.8.0", prefix: 21, hosts: [300, 300, 300, 100] },
    { network: "10.10.10.0", prefix: 24, hosts: [1, 1, 1, 2, 2, 6, 14] },
  ]

  for (const testCase of cases) {
    it(`${testCase.network}/${testCase.prefix} with ${testCase.hosts.length} subnets`, () => {
      const { plan, ranges } = blocks(
        testCase.network,
        testCase.prefix,
        testCase.hosts.map((hosts, index) => req(`net${index}`, hosts))
      )
      expect(plan.success, plan.errorMessage).toBe(true)

      const sorted = [...ranges].sort((a, b) => a.start - b.start)
      for (let index = 1; index < sorted.length; index++) {
        expect(
          sorted[index].start,
          `${sorted[index].name} overlaps ${sorted[index - 1].name}`
        ).toBeGreaterThan(sorted[index - 1].end)
      }

      for (const range of ranges) {
        // an aligned block has its low (32 - prefix) bits clear
        expect(range.start % range.size, `${range.name} is not aligned to /${range.prefix}`).toBe(0)
      }

      const baseStart = ipv4ToInt(plan.baseNetwork)
      const baseEnd = baseStart + 2 ** (32 - testCase.prefix) - 1
      for (const range of ranges) {
        expect(range.start, `${range.name} starts before the base block`).toBeGreaterThanOrEqual(
          baseStart
        )
        expect(range.end, `${range.name} ends past the base block`).toBeLessThanOrEqual(baseEnd)
      }
    })
  }

  it("allocates largest first so the alignment never wastes a gap", () => {
    const { ranges } = blocks("10.0.0.0", 22, [req("small", 10), req("big", 500), req("mid", 100)])
    expect(ranges.map((range) => range.name)).toEqual(["big", "mid", "small"])
    expect(ranges.map((range) => range.prefix)).toEqual([23, 25, 28])
  })
})

describe("prefix selection", () => {
  it("picks the smallest block that fits, honouring the /31 and /32 cases", () => {
    const { plan } = blocks("10.0.0.0", 24, [
      req("host", 1),
      req("p2p", 2),
      req("six", 6),
      req("seven", 7),
    ])
    const prefixOf = (name: string) =>
      plan.allocations.find((allocation) => allocation.name === name)!.prefix
    expect(prefixOf("host")).toBe(32) // one address
    expect(prefixOf("p2p")).toBe(31) // rfc 3021
    expect(prefixOf("six")).toBe(29) // 8 - 2
    expect(prefixOf("seven")).toBe(28) // 16 - 2, because a /29 only gives 6
  })

  it("reports 2 usable hosts for a /31 and 1 for a /32", () => {
    const { plan } = blocks("10.0.0.0", 24, [req("p2p", 2), req("host", 1)])
    const allocated = (name: string) =>
      plan.allocations.find((allocation) => allocation.name === name)!.hostsAllocated
    expect(allocated("p2p")).toBe(2)
    expect(allocated("host")).toBe(1)
  })
})

describe("clean failure instead of an invalid plan", () => {
  it("fails when the requirements exceed the parent block", () => {
    const plan = calculateVLSM("10.0.0.0", 24, [req("big", 500)])
    expect(plan.success).toBe(false)
    expect(plan.errorMessage).toMatch(/big/)
    expect(plan.allocations).toEqual([])
  })

  it("fails when the requirements only just exceed the parent block", () => {
    // a /24 holds two /25s; three of them cannot fit
    const plan = calculateVLSM("10.0.0.0", 24, [req("a", 120), req("b", 120), req("c", 120)])
    expect(plan.success).toBe(false)
    expect(plan.allocations).toEqual([])
  })

  it("succeeds on the exact-fit case just below that", () => {
    const plan = calculateVLSM("10.0.0.0", 24, [req("a", 120), req("b", 120)])
    expect(plan.success, plan.errorMessage).toBe(true)
    expect(plan.allocations.map((allocation) => allocation.cidr)).toEqual([
      "10.0.0.0/25",
      "10.0.0.128/25",
    ])
  })

  it("rejects a zero, negative or fractional host requirement", () => {
    for (const hosts of [0, -1, 1.5, Number.NaN]) {
      const plan = calculateVLSM("10.0.0.0", 24, [req("bad", hosts)])
      expect(plan.success, `${hosts}`).toBe(false)
      expect(plan.allocations).toEqual([])
    }
  })

  it("rejects an invalid base network rather than throwing", () => {
    const plan = calculateVLSM("not-an-ip", 24, [req("a", 10)])
    expect(plan.success).toBe(false)
    expect(plan.errorMessage).toBeTruthy()
  })

  it("normalises a base address that is not the network address", () => {
    const plan = calculateVLSM("10.0.0.37", 24, [req("a", 10)])
    expect(plan.success).toBe(true)
    expect(plan.baseNetwork).toBe("10.0.0.0")
    expect(plan.allocations[0].network).toBe("10.0.0.0")
  })
})

describe("utilisation reporting", () => {
  it("measures address space consumed, not usable hosts", () => {
    // two /25s exactly fill a /24
    const plan = calculateVLSM("10.0.0.0", 24, [req("a", 120), req("b", 120)])
    expect(plan.utilizationPercent).toBeCloseTo(100, 5)
  })

  it("never claims more than the base block", () => {
    const plan = calculateVLSM("10.0.0.0", 20, [req("a", 500), req("b", 120), req("c", 10)])
    expect(plan.utilizationPercent).toBeLessThanOrEqual(100)
    expect(plan.utilizationPercent).toBeGreaterThan(0)
  })
})
