import { describe, expect, it } from "vitest"
import {
  calculateMTU,
  DEFAULT_MSS_IPV4,
  DEFAULT_MSS_IPV6,
  encapsulationById,
  ENCAPSULATIONS,
  IPV4_HEADER,
  IPV4_MIN_MTU,
  IPV4_MIN_REASSEMBLY,
  IPV6_HEADER,
  IPV6_MIN_LINK_MTU,
  TCP_HEADER,
  UDP_HEADER,
} from "@/lib/mtu"

// the rfc floors are link mtu; the old calculator compared them against the post-transport payload

describe("header sizes", () => {
  it("matches the fixed header sizes the rfcs define", () => {
    expect(IPV4_HEADER).toBe(20) // rfc 791 s3.1, ihl min 5 words
    expect(IPV6_HEADER).toBe(40) // rfc 8200 s3
    expect(TCP_HEADER).toBe(20) // rfc 9293 s3.1, data offset min 5 words
    expect(UDP_HEADER).toBe(8) // rfc 768
  })

  it("matches the rfc minimums", () => {
    expect(IPV6_MIN_LINK_MTU).toBe(1280) // rfc 8200 s5
    expect(IPV4_MIN_MTU).toBe(68) // rfc 791 s3.2, 60 header + 8 fragment
    expect(IPV4_MIN_REASSEMBLY).toBe(576) // rfc 791 s3.2, rfc 1122 s3.3.2
    expect(DEFAULT_MSS_IPV4).toBe(536) // 576 - 40, rfc 9293 s3.7.1
    expect(DEFAULT_MSS_IPV6).toBe(1220) // 1280 - 60, rfc 9293 s3.7.1
  })
})

describe("encapsulation overheads", () => {
  const byId = (id: string) => encapsulationById(id)?.bytes

  it("uses the documented byte counts", () => {
    expect(byId("dot1q")).toBe(4) // ieee 802.1q c-tag: 2 tpid + 2 tci
    expect(byId("qinq")).toBe(8) // s-tag + c-tag
    expect(byId("pppoe")).toBe(8) // rfc 2516 s7: 6 pppoe + 2 ppp protocol id
    expect(byId("gre")).toBe(24) // rfc 2784 s2.1: 20 delivery ipv4 + 4 gre
    expect(byId("vxlan")).toBe(50) // rfc 7348 s5: 20 + 8 + 8 + 14 inner ethernet
    expect(byId("nat-t")).toBe(8) // rfc 3948
    expect(byId("mpls")).toBe(4) // rfc 3032 s2.1
  })

  it("quotes the worst case for an IPsec ESP tunnel, padding included", () => {
    // a floor check let esp-cbc drop 15 bytes of padding; aes-gcm = 20 ipv4 + 8 esp + 8 iv + 2 + 16 + 3
    expect(byId("esp-gcm")).toBe(57)
    // aes-cbc + hmac-sha1-96: 20 + 8 + 16 iv + 2 + 12 icv + 15 pad to the block
    expect(byId("esp-cbc")).toBe(73)
    // the floors those worst cases sit above (rfc 4106 s3, s6; rfc 4303 s2.3)
    expect(byId("esp-gcm")!).toBeGreaterThanOrEqual(54)
    expect(byId("esp-cbc")!).toBeGreaterThanOrEqual(58)
  })

  it("gives every option a unique id and a cited detail", () => {
    const ids = ENCAPSULATIONS.map((option) => option.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const option of ENCAPSULATIONS) {
      expect(option.bytes, option.id).toBeGreaterThan(0)
      expect(option.detail.length, option.id).toBeGreaterThan(20)
    }
  })
})

describe("MSS arithmetic", () => {
  it("derives 1460 for plain IPv4 Ethernet and 1440 for IPv6", () => {
    expect(calculateMTU(1500, "ipv4", "tcp", []).tcpMSS).toBe(1460)
    expect(calculateMTU(1500, "ipv6", "tcp", []).tcpMSS).toBe(1440)
  })

  it("reports the classic tunnel MSS values", () => {
    // pppoe: 1500 - 8 = 1492 mtu, 1452 mss
    const pppoe = calculateMTU(1500, "ipv4", "tcp", ["pppoe"])
    expect(pppoe.effectiveMTU).toBe(1492)
    expect(pppoe.tcpMSS).toBe(1452)

    // gre over ipv4: 1500 - 24 = 1476 mtu, 1436 mss
    const gre = calculateMTU(1500, "ipv4", "tcp", ["gre"])
    expect(gre.effectiveMTU).toBe(1476)
    expect(gre.tcpMSS).toBe(1436)

    // vxlan: the inner mtu operators configure is 1450
    expect(calculateMTU(1500, "ipv4", "tcp", ["vxlan"]).effectiveMTU).toBe(1450)
  })

  it("still reports a TCP MSS when the selected transport is UDP", () => {
    const udp = calculateMTU(1500, "ipv4", "udp", [])
    expect(udp.payloadBytes).toBe(1472)
    expect(udp.tcpMSS).toBe(1460)
  })

  it("sums multiple encapsulations", () => {
    const stacked = calculateMTU(1500, "ipv4", "tcp", ["dot1q", "pppoe"])
    expect(stacked.encapsulationOverhead).toBe(12)
    expect(stacked.effectiveMTU).toBe(1488)
  })

  it("ignores unknown encapsulation ids from a hand-edited link", () => {
    expect(calculateMTU(1500, "ipv4", "tcp", ["not-a-thing"]).encapsulationOverhead).toBe(0)
  })
})

describe("RFC 8200 section 5 IPv6 minimum link MTU", () => {
  it("errors only once the effective MTU itself drops below 1280", () => {
    expect(calculateMTU(1280, "ipv6", "tcp", []).errors).toEqual([])
    expect(calculateMTU(1279, "ipv6", "tcp", []).errors.length).toBe(1)
    expect(calculateMTU(1279, "ipv6", "tcp", []).errors[0]).toMatch(/1280/)
  })

  it("does not fire on a link that is legal but leaves a payload under 1280", () => {
    // the payload is 1240, under 1280, yet the link is fine; comparing the two was the old bug
    const result = calculateMTU(1300, "ipv6", "tcp", [])
    expect(result.payloadBytes).toBe(1240)
    expect(result.errors).toEqual([])
  })

  it("fires when encapsulation eats into the 1280 floor", () => {
    // 1300 - 24 gre = 1276
    expect(calculateMTU(1300, "ipv6", "tcp", ["gre"]).errors.length).toBe(1)
  })
})

describe("IPv4 minimums", () => {
  it("errors below the 68-byte forwardable minimum", () => {
    expect(calculateMTU(68, "ipv4", "none", []).errors).toEqual([])
    expect(calculateMTU(67, "ipv4", "none", []).errors[0]).toMatch(/68/)
  })

  it("warns, not errors, between 68 and 576", () => {
    const result = calculateMTU(500, "ipv4", "tcp", [])
    expect(result.errors).toEqual([])
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]).toMatch(/576/)
  })

  it("stays silent at exactly 576 even though the payload is smaller", () => {
    const result = calculateMTU(576, "ipv4", "tcp", [])
    expect(result.payloadBytes).toBe(536)
    expect(result.warnings).toEqual([])
    expect(result.errors).toEqual([])
  })
})

describe("breakdown", () => {
  it("lists every subtracted layer and adds up to the link MTU minus the payload", () => {
    const result = calculateMTU(1500, "ipv4", "tcp", ["gre", "dot1q"])
    const total = result.breakdown.reduce((sum, row) => sum + row.bytes, 0)
    expect(total).toBe(result.linkMTU - result.payloadBytes)
    expect(result.breakdown.map((row) => row.label)).toContain("IPv4 header")
    expect(result.breakdown.map((row) => row.label)).toContain("TCP header")
  })

  it("omits the transport row when there is no transport", () => {
    const result = calculateMTU(1500, "ipv6", "none", [])
    expect(result.transportHeader).toBe(0)
    expect(result.breakdown).toEqual([{ label: "IPv6 header", bytes: 40 }])
  })

  it("errors when nothing is left for payload", () => {
    expect(calculateMTU(40, "ipv6", "tcp", []).errors.some((e) => /no room/.test(e))).toBe(true)
  })
})
