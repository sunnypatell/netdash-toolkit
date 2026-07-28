import { describe, expect, it } from "vitest"
import {
  buildDnsQueryMessage,
  calculateMedian,
  calculatePercentile,
  generateEUI64FromMAC,
  parseDnsMessage,
  PROTOCOL_OVERHEADS,
} from "@/lib/network-testing"

describe("generateEUI64FromMAC", () => {
  it("expands compressed prefixes and builds the modified eui-64 address", () => {
    expect(generateEUI64FromMAC("00:11:22:33:44:55", "2001:db8::")).toBe(
      "2001:db8::211:22ff:fe33:4455"
    )
  })

  it("ignores a prefix length suffix", () => {
    expect(generateEUI64FromMAC("00:11:22:33:44:55", "2001:db8::/64")).toBe(
      "2001:db8::211:22ff:fe33:4455"
    )
  })

  it("flips the universal/local bit and inserts ff:fe", () => {
    // 02 -> 00 after u/l flip
    expect(generateEUI64FromMAC("02:00:00:00:00:01", "fe80::")).toBe("fe80::ff:fe00:1")
  })

  it("rejects malformed macs", () => {
    expect(() => generateEUI64FromMAC("00:11:22", "2001:db8::")).toThrow("Invalid MAC address")
  })
})

describe("calculateMedian", () => {
  it("returns the middle element for odd counts", () => {
    expect(calculateMedian([5, 1, 3])).toBe(3)
  })

  it("averages the two middle elements for even counts", () => {
    expect(calculateMedian([4, 1, 3, 2])).toBe(2.5)
  })

  it("returns 0 for empty input", () => {
    expect(calculateMedian([])).toBe(0)
  })
})

describe("calculatePercentile", () => {
  it("uses nearest-rank for p95 on a full range", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(calculatePercentile(values, 95)).toBe(95)
  })

  it("returns the max for p95 of small samples", () => {
    expect(calculatePercentile([10, 20, 30, 40, 50], 95)).toBe(50)
  })

  it("returns the single element regardless of percentile", () => {
    expect(calculatePercentile([7], 50)).toBe(7)
  })

  it("returns 0 for empty input", () => {
    expect(calculatePercentile([], 95)).toBe(0)
  })
})

describe("PROTOCOL_OVERHEADS", () => {
  it("uses the full 802.1ad double-tag figure for qinq", () => {
    expect(PROTOCOL_OVERHEADS.QinQ).toBe(8)
  })

  it("keeps stable well-known header sizes", () => {
    expect(PROTOCOL_OVERHEADS.IPv4).toBe(20)
    expect(PROTOCOL_OVERHEADS.IPv6).toBe(40)
    expect(PROTOCOL_OVERHEADS.TCP).toBe(20)
    expect(PROTOCOL_OVERHEADS.UDP).toBe(8)
  })
})

describe("buildDnsQueryMessage", () => {
  it("sets arcount to 1 and appends a correct edns0 opt rr trailer", () => {
    const message = buildDnsQueryMessage("example.com", 1)
    const view = new DataView(message.buffer)

    expect(view.getUint16(10)).toBe(1) // ARCOUNT

    const opt = message.length - 11
    expect(message[opt]).toBe(0) // root name
    expect(view.getUint16(opt + 1)).toBe(41) // TYPE OPT
    expect(view.getUint16(opt + 3)).toBe(4096) // requested udp payload size
    expect(view.getUint32(opt + 5)).toBe(0x00008000) // ext rcode 0, version 0, do bit
    expect(view.getUint16(opt + 9)).toBe(0) // rdlen
  })

  it("still encodes the question section before the opt rr", () => {
    const message = buildDnsQueryMessage("example.com", 1)
    const view = new DataView(message.buffer)

    expect(view.getUint16(4)).toBe(1) // QDCOUNT
    expect(message[12]).toBe(7) // "example" label length
    expect(String.fromCharCode(...message.slice(13, 20))).toBe("example")

    // qtype/qclass sit right before the 11-byte opt trailer
    const qtypeOffset = message.length - 11 - 4
    expect(view.getUint16(qtypeOffset)).toBe(1) // A
    expect(view.getUint16(qtypeOffset + 2)).toBe(1) // IN
  })
})

describe("parseDnsMessage", () => {
  const headerWithFlags = (flags: number): Uint8Array => {
    const header = new Uint8Array(12)
    new DataView(header.buffer).setUint16(2, flags)
    return header
  }

  it("surfaces truncated: true when the tc bit is set", () => {
    expect(parseDnsMessage(headerWithFlags(0x8200)).truncated).toBe(true)
  })

  it("reports truncated: false when the tc bit is clear", () => {
    expect(parseDnsMessage(headerWithFlags(0x8000)).truncated).toBe(false)
  })

  it("rejects buffers shorter than the dns header", () => {
    expect(() => parseDnsMessage(new Uint8Array(4))).toThrow("DNS response too short")
  })
})
