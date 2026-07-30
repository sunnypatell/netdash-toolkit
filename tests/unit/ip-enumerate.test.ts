import { describe, expect, it } from "vitest"
import { enumerateAddresses, selectableCount, summarizeRange } from "@/lib/ip-enumerate"

describe("range summary boundaries", () => {
  it("treats a /31 as a point-to-point link per rfc 3021", () => {
    const summary = summarizeRange("192.0.2.10/31")
    expect(summary.networkAddress).toBe("192.0.2.10")
    // a /31 reserves nothing, so there is no broadcast address to report
    expect(summary.broadcastAddress).toBeNull()
    expect(summary.hasNetworkAndBroadcast).toBe(false)
    expect(summary.firstUsable).toBe("192.0.2.10")
    expect(summary.lastUsable).toBe("192.0.2.11")
    expect(summary.totalAddresses).toBe(2)
    expect(summary.usableHosts).toBe(2)
  })

  it("treats a /32 as a host route", () => {
    const summary = summarizeRange("203.0.113.7/32")
    expect(summary.broadcastAddress).toBeNull()
    expect(summary.firstUsable).toBe("203.0.113.7")
    expect(summary.lastUsable).toBe("203.0.113.7")
    expect(summary.totalAddresses).toBe(1)
    expect(summary.usableHosts).toBe(1)
  })

  it("keeps network and broadcast for /30 and shorter", () => {
    const summary = summarizeRange("10.1.2.4/30")
    expect(summary.networkAddress).toBe("10.1.2.4")
    expect(summary.broadcastAddress).toBe("10.1.2.7")
    expect(summary.firstUsable).toBe("10.1.2.5")
    expect(summary.lastUsable).toBe("10.1.2.6")
    expect(summary.usableHosts).toBe(2)
  })

  it("normalises a host address onto its network", () => {
    expect(summarizeRange("192.168.1.200/24").cidr).toBe("192.168.1.0/24")
    expect(summarizeRange("192.168.1.200/24").networkAddress).toBe("192.168.1.0")
  })

  it("survives the top of the address space", () => {
    const summary = summarizeRange("255.255.255.255/32")
    expect(summary.networkAddress).toBe("255.255.255.255")
    expect(summary.lastUsable).toBe("255.255.255.255")

    const slash31 = summarizeRange("255.255.255.254/31")
    expect(slash31.lastUsable).toBe("255.255.255.255")
    expect(enumerateAddresses(slash31, { limit: 10 })).toEqual([
      "255.255.255.254",
      "255.255.255.255",
    ])

    const slash30 = summarizeRange("255.255.255.252/30")
    expect(slash30.broadcastAddress).toBe("255.255.255.255")
    expect(enumerateAddresses(slash30, { limit: 10, includeBroadcast: true })).toEqual([
      "255.255.255.253",
      "255.255.255.254",
      "255.255.255.255",
    ])
  })

  it("handles a default route without overflowing", () => {
    const summary = summarizeRange("0.0.0.0/0")
    expect(summary.totalAddresses).toBe(4294967296)
    expect(summary.usableHosts).toBe(4294967294)
    expect(summary.firstUsable).toBe("0.0.0.1")
    expect(summary.lastUsable).toBe("255.255.255.254")
    expect(enumerateAddresses(summary, { limit: 3 })).toEqual(["0.0.0.1", "0.0.0.2", "0.0.0.3"])
    expect(enumerateAddresses(summary, { limit: 2, order: "desc" })).toEqual([
      "255.255.255.254",
      "255.255.255.253",
    ])
  })
})

describe("enumeration never duplicates an address", () => {
  const cidrs = [
    "192.168.1.0/24",
    "192.168.1.0/28",
    "10.0.0.0/30",
    "10.0.0.0/31",
    "10.0.0.1/32",
    "255.255.255.255/32",
  ]

  for (const includeNetwork of [false, true]) {
    for (const includeBroadcast of [false, true]) {
      it.each(cidrs)(
        `${includeNetwork ? "with" : "without"} network, ${
          includeBroadcast ? "with" : "without"
        } broadcast: %s is duplicate free`,
        (cidr) => {
          const summary = summarizeRange(cidr)
          const options = { includeNetwork, includeBroadcast, limit: 300 }
          const list = enumerateAddresses(summary, options)
          expect(new Set(list).size).toBe(list.length)
          expect(list.length).toBe(Math.min(selectableCount(summary, options), 300))
        }
      )
    }
  }

  it("excludes network and broadcast by default on a /28", () => {
    const summary = summarizeRange("192.168.1.0/28")
    const list = enumerateAddresses(summary, { limit: 100 })
    expect(list[0]).toBe("192.168.1.1")
    expect(list.at(-1)).toBe("192.168.1.14")
    expect(list).toHaveLength(14)
    expect(list).not.toContain("192.168.1.0")
    expect(list).not.toContain("192.168.1.15")
  })

  it("includes both ends when asked", () => {
    const list = enumerateAddresses(summarizeRange("192.168.1.0/29"), {
      includeNetwork: true,
      includeBroadcast: true,
      limit: 100,
    })
    expect(list).toEqual([
      "192.168.1.0",
      "192.168.1.1",
      "192.168.1.2",
      "192.168.1.3",
      "192.168.1.4",
      "192.168.1.5",
      "192.168.1.6",
      "192.168.1.7",
    ])
  })

  it("cannot exclude a /31 endpoint, because neither end is reserved", () => {
    const summary = summarizeRange("10.0.0.0/31")
    expect(enumerateAddresses(summary, { limit: 10 })).toEqual(["10.0.0.0", "10.0.0.1"])
    expect(enumerateAddresses(summary, { limit: 10, includeNetwork: true })).toEqual([
      "10.0.0.0",
      "10.0.0.1",
    ])
  })

  it("descending returns the top of the range, not a reversed page", () => {
    const summary = summarizeRange("192.168.1.0/24")
    expect(enumerateAddresses(summary, { limit: 3, order: "desc" })).toEqual([
      "192.168.1.254",
      "192.168.1.253",
      "192.168.1.252",
    ])
  })

  it("rejects malformed input", () => {
    expect(() => summarizeRange("192.168.1.0/33")).toThrow()
    expect(() => summarizeRange("192.168.1.0")).toThrow()
    expect(() => summarizeRange("not-an-ip/24")).toThrow()
    expect(() => summarizeRange("192.168.1.256/24")).toThrow()
  })
})
