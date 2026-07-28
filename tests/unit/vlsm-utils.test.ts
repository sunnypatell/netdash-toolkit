import { describe, expect, it } from "vitest"
import { calculateVLSM } from "@/lib/vlsm-utils"

const reqs = (...hosts: number[]) =>
  hosts.map((h, i) => ({ id: String(i), name: `net${i}`, hostsRequired: h }))

describe("calculateVLSM", () => {
  it("allocates descending with correct prefixes", () => {
    const plan = calculateVLSM("192.168.0.0", 24, reqs(100, 50, 10, 2))
    expect(plan.success).toBe(true)
    expect(plan.allocations.map((a) => `${a.network}/${a.prefix}`)).toEqual([
      "192.168.0.0/25", // 100 hosts -> 126 usable
      "192.168.0.128/26", // 50 -> 62
      "192.168.0.192/28", // 10 -> 14
      "192.168.0.208/31", // 2 -> rfc 3021 point-to-point
    ])
  })

  it("aligns blocks to their natural boundary", () => {
    const plan = calculateVLSM("10.0.0.0", 20, reqs(500, 120, 50, 10, 5))
    expect(plan.success).toBe(true)
    expect(plan.allocations.map((a) => a.cidr)).toEqual([
      "10.0.0.0/23",
      "10.0.2.0/25",
      "10.0.2.128/26",
      "10.0.2.192/28",
      "10.0.2.208/29",
    ])
  })

  it("fails clearly when a requirement cannot fit", () => {
    const plan = calculateVLSM("192.168.0.0", 25, reqs(200))
    expect(plan.success).toBe(false)
    expect(plan.errorMessage).toMatch(/cannot fit/i)
  })

  it("rejects zero and negative host counts instead of allocating a /32", () => {
    expect(calculateVLSM("10.0.0.0", 24, reqs(0)).success).toBe(false)
    expect(calculateVLSM("10.0.0.0", 24, reqs(-5)).success).toBe(false)
  })

  it("rejects requirements larger than the ipv4 address space", () => {
    const plan = calculateVLSM("0.0.0.0", 0, reqs(2 ** 31))
    expect(plan.success).toBe(false)
    expect(plan.errorMessage).toMatch(/exceeds/i)
  })

  it("measures utilization in address space, not usable hosts", () => {
    // one /25 out of a /24: exactly half the space is consumed
    const plan = calculateVLSM("10.0.0.0", 24, reqs(100))
    expect(plan.success).toBe(true)
    expect(plan.utilizationPercent).toBe(50)
  })
})
