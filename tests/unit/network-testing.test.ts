import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildDnsQueryMessage,
  calculateMedian,
  calculatePercentile,
  dnsCache,
  generateEUI64FromMAC,
  generateSolicitedNodeMulticast,
  parseDnsMessage,
  PROTOCOL_OVERHEADS,
  queryDNSOverHTTPS,
} from "@/lib/network-testing"
import type { DNSResult } from "@/lib/network-testing"
import { isValidIPv6 } from "@/lib/network-utils"

// hand-assembled wire fixtures: the parser must be checked against raw bytes,
// not against the same codec that produced them
const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff]
const u32 = (n: number): number[] => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
]
const ascii = (value: string): number[] => Array.from(value, (c) => c.charCodeAt(0))
const characterString = (value: string): number[] => [value.length, ...ascii(value)]
const hex = (value: string): number[] =>
  (value.match(/../g) ?? []).map((byte) => Number.parseInt(byte, 16))
const wireName = (name: string): number[] => [
  ...name.split(".").flatMap((label) => characterString(label)),
  0,
]

interface WireAnswer {
  name?: string
  type: number
  ttl?: number
  rdata: number[]
}

function buildDnsResponse(answers: WireAnswer[], flags = 0x8180): Uint8Array {
  const bytes = [
    ...u16(0x1234),
    ...u16(flags),
    ...u16(1),
    ...u16(answers.length),
    ...u16(0),
    ...u16(0),
    ...wireName("example.com"),
    ...u16(answers[0]?.type ?? 1),
    ...u16(1),
  ]

  for (const answer of answers) {
    bytes.push(
      ...wireName(answer.name ?? "example.com"),
      ...u16(answer.type),
      ...u16(1),
      ...u32(answer.ttl ?? 300),
      ...u16(answer.rdata.length),
      ...answer.rdata
    )
  }

  return new Uint8Array(bytes)
}

const EMPTY_NOERROR = new Uint8Array([
  ...u16(0x1234),
  ...u16(0x8180),
  ...u16(0),
  ...u16(0),
  ...u16(0),
  ...u16(0),
])

const jsonDnsResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/dns-json" },
  })

const wireDnsResponse = (bytes: Uint8Array): Response =>
  new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: { "Content-Type": "application/dns-message" },
  })

const decodeBase64Url = (value: string): number[] => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  return ascii(atob(padded))
}

// qtype sits right before the 11-byte edns0 opt trailer
const questionTypeOf = (query: number[]): number => {
  const offset = query.length - 11 - 4
  return (query[offset] << 8) | query[offset + 1]
}

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

  it("surfaces the rcode as Status", () => {
    expect(parseDnsMessage(headerWithFlags(0x8183)).Status).toBe(3) // NXDOMAIN
    expect(parseDnsMessage(headerWithFlags(0x8180)).Status).toBe(0)
  })

  it("reads the ad bit", () => {
    expect(parseDnsMessage(headerWithFlags(0x81a0)).AD).toBe(true)
    expect(parseDnsMessage(headerWithFlags(0x8180)).AD).toBe(false)
  })
})

describe("parseDnsMessage AAAA rendering", () => {
  // the deleted third ipv6 compressor appended a colon that :{3,} had already
  // collapsed, so every trailing zero run rendered an extra ":"
  it("emits a single :: for trailing zero runs", () => {
    const cases: Array<[string, string]> = [
      ["20010db8000000000000000000000000", "2001:db8::"],
      ["00000000000000000000000000000000", "::"],
      ["fe800000000000010000000000000000", "fe80:0:0:1::"],
      ["20010db8000000000000000000000001", "2001:db8::1"],
      ["20010db8000000000001000000000001", "2001:db8::1:0:0:1"],
      ["20010db8000100020003000400050006", "2001:db8:1:2:3:4:5:6"],
    ]

    for (const [bytes, expected] of cases) {
      const parsed = parseDnsMessage(buildDnsResponse([{ type: 28, rdata: hex(bytes) }]))
      expect(parsed.Answer[0].data).toBe(expected)
      expect(isValidIPv6(parsed.Answer[0].data)).toBe(true)
    }
  })

  it("compresses the leftmost longest run, not the first one", () => {
    // the underlying ip codec picks the first run; compressIPv6 is rfc 5952
    const parsed = parseDnsMessage(
      buildDnsResponse([{ type: 28, rdata: hex("20010000000000010000000000000001") }])
    )
    expect(parsed.Answer[0].data).toBe("2001:0:0:1::1")
  })
})

describe("parseDnsMessage rdata formatting", () => {
  it("parses soa rdata instead of dumping a hex blob", () => {
    const rdata = [
      ...wireName("ns1.example.com"),
      ...wireName("hostmaster.example.com"),
      ...u32(2024010101),
      ...u32(7200),
      ...u32(3600),
      ...u32(1209600),
      ...u32(300),
    ]

    const parsed = parseDnsMessage(buildDnsResponse([{ type: 6, rdata }]))
    expect(parsed.Answer[0].type).toBe(6)
    expect(parsed.Answer[0].data).toBe(
      "ns1.example.com hostmaster.example.com 2024010101 7200 3600 1209600 300"
    )
  })

  it("keeps every txt character-string as its own quoted token", () => {
    const parsed = parseDnsMessage(
      buildDnsResponse([
        {
          type: 16,
          rdata: [
            ...characterString("v=spf1 include:_spf.example.com"),
            ...characterString("~all"),
          ],
        },
      ])
    )
    expect(parsed.Answer[0].data).toBe('"v=spf1 include:_spf.example.com" "~all"')
  })

  it("formats caa, ds and opaque types", () => {
    const caa = parseDnsMessage(
      buildDnsResponse([
        { type: 257, rdata: [0, 5, ...ascii("issue"), ...ascii("letsencrypt.org")] },
      ])
    )
    expect(caa.Answer[0].type).toBe(257)
    expect(caa.Answer[0].data).toBe('0 issue "letsencrypt.org"')

    const ds = parseDnsMessage(
      buildDnsResponse([{ type: 43, rdata: [...u16(12345), 13, 2, 0xde, 0xad, 0xbe, 0xef] }])
    )
    expect(ds.Answer[0].data).toBe("12345 13 2 deadbeef")

    const tlsa = parseDnsMessage(buildDnsResponse([{ type: 52, rdata: [3, 1, 1, 0xab, 0xcd] }]))
    expect(tlsa.Answer[0].type).toBe(52)
    expect(tlsa.Answer[0].data).toBe("030101abcd")
  })

  it("still resolves mx, srv and name-compression pointers", () => {
    const mx = parseDnsMessage(
      buildDnsResponse([{ type: 15, rdata: [...u16(10), ...wireName("mail.example.com")] }])
    )
    expect(mx.Answer[0].data).toBe("10 mail.example.com")

    const srv = parseDnsMessage(
      buildDnsResponse([
        {
          type: 33,
          rdata: [...u16(10), ...u16(5), ...u16(5060), ...wireName("sip.example.com")],
        },
      ])
    )
    expect(srv.Answer[0].data).toBe("10 5 5060 sip.example.com")

    // 0xc00c points back at the question name at offset 12
    const cname = parseDnsMessage(buildDnsResponse([{ type: 5, rdata: [0xc0, 0x0c] }]))
    expect(cname.Answer[0].data).toBe("example.com")
  })
})

describe("generateSolicitedNodeMulticast", () => {
  it("delegates to the shared network-utils implementation", () => {
    expect(generateSolicitedNodeMulticast("2001:db8::1:ff:fe00:1234")).toBe("ff02::1:ff00:1234")
    // the old local copy sliced raw text and returned "ff02::1:ff:f1" here
    expect(generateSolicitedNodeMulticast("fe80:0:0:0:0:0:f:1")).toBe("ff02::1:ff0f:0001")
  })
})

describe("queryDNSOverHTTPS domain validation", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    dnsCache.clear()
  })

  it("builds queries for leading-underscore labels (dmarc, dkim, srv, tlsa)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonDnsResponse({
        Status: 0,
        AD: false,
        Answer: [{ name: "_dmarc.example.com", type: 16, TTL: 300, data: '"v=DMARC1; p=reject"' }],
      })
    )

    const domains = [
      "_dmarc.example.com",
      "_sip._tcp.example.com",
      "selector1._domainkey.example.com",
      "_443._tcp.example.com",
    ]

    for (const domain of domains) {
      const result = await queryDNSOverHTTPS(domain, "TXT", "cloudflare", { skipCache: true })
      expect({ domain, success: result.success, error: result.error }).toEqual({
        domain,
        success: true,
        error: undefined,
      })
    }

    expect(fetchMock).toHaveBeenCalledTimes(domains.length)
    expect(String(fetchMock.mock.calls[0][0])).toContain("name=_dmarc.example.com")
    expect(String(fetchMock.mock.calls[1][0])).toContain("name=_sip._tcp.example.com")
  })

  it("still rejects malformed names before any request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")

    for (const domain of ["exa mple.com", "a..b", "_", "-bad.example.com", "bad-.example.com"]) {
      const result = await queryDNSOverHTTPS(domain, "A", "cloudflare", { skipCache: true })
      expect({ domain, error: result.error }).toEqual({
        domain,
        error: "Invalid domain name format",
      })
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("queryDNSOverHTTPS record type coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    dnsCache.clear()
  })

  it("encodes caa, ds, dnskey, tlsa and https on wire-format providers", async () => {
    const sent: number[][] = []
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      sent.push(decodeBase64Url(new URL(String(input)).searchParams.get("dns") ?? ""))
      return wireDnsResponse(EMPTY_NOERROR)
    })

    const expectations: Array<[string, number]> = [
      ["A", 1],
      ["AAAA", 28],
      ["SOA", 6],
      ["CAA", 257],
      ["DS", 43],
      ["DNSKEY", 48],
      ["TLSA", 52],
      ["HTTPS", 65],
    ]

    for (const [type, code] of expectations) {
      const result = await queryDNSOverHTTPS("example.com", type, "quad9", { skipCache: true })
      expect({ type, success: result.success, error: result.error }).toEqual({
        type,
        success: true,
        error: undefined,
      })
      expect({ type, code: questionTypeOf(sent[sent.length - 1]) }).toEqual({ type, code })
    }
  })

  it("fails per-provider rather than globally for types with no wire code", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => jsonDnsResponse({ Status: 0, Answer: [] }))

    // json providers pass the type name through, so the resolver decides
    const json = await queryDNSOverHTTPS("example.com", "NOTAREALTYPE", "cloudflare", {
      skipCache: true,
    })
    expect(json.success).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain("type=NOTAREALTYPE")

    const wire = await queryDNSOverHTTPS("example.com", "NOTAREALTYPE", "quad9", {
      skipCache: true,
    })
    expect(wire.success).toBe(false)
    expect(wire.error).toContain("quad9")
    expect(wire.error).toContain("NOTAREALTYPE")
  })
})

describe("queryDNSOverHTTPS json record formatting", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    dnsCache.clear()
  })

  it("preserves multi-string txt instead of stripping the quotes", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonDnsResponse({
        Status: 0,
        Answer: [
          {
            name: "example.com",
            type: 16,
            TTL: 300,
            data: '"v=spf1 include:_spf.example.com" "~all"',
          },
        ],
      })
    )

    const result = await queryDNSOverHTTPS("example.com", "TXT", "cloudflare", { skipCache: true })
    expect(result.records[0].data).toBe('"v=spf1 include:_spf.example.com" "~all"')
  })

  it("quotes an unquoted single-string txt payload", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonDnsResponse({
        Status: 0,
        Answer: [{ name: "example.com", type: 16, TTL: 300, data: "v=spf1 -all" }],
      })
    )

    const result = await queryDNSOverHTTPS("example.com", "TXT", "cloudflare", { skipCache: true })
    expect(result.records[0].data).toBe('"v=spf1 -all"')
  })
})

describe("queryDNSOverHTTPS timer hygiene", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    dnsCache.clear()
  })

  it("clears the abort timer on the error path too", async () => {
    const realSetTimeout = globalThis.setTimeout
    const realClearTimeout = globalThis.clearTimeout
    const abortTimers: unknown[] = []
    const cleared: unknown[] = []

    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: TimerHandler,
      ms?: number,
      ...rest: unknown[]
    ) => {
      const id = (realSetTimeout as any)(handler, ms, ...rest)
      if (ms === 15000) abortTimers.push(id)
      return id
    }) as typeof globalThis.setTimeout)

    vi.spyOn(globalThis, "clearTimeout").mockImplementation(((id: unknown) => {
      cleared.push(id)
      return (realClearTimeout as any)(id)
    }) as typeof globalThis.clearTimeout)

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("socket reset"))

    const result = await queryDNSOverHTTPS("example.com", "A", "cloudflare", { skipCache: true })

    expect(result.success).toBe(false)
    expect(abortTimers).toHaveLength(1)
    expect(cleared).toContain(abortTimers[0])
  })
})

describe("dnsCache eviction", () => {
  const cachedResult = (domain: string): DNSResult => ({
    domain,
    recordType: "A",
    records: [{ name: domain, type: "A", ttl: 300, data: "203.0.113.1" }],
    provider: "cloudflare",
    dnssec: false,
    responseTime: 5,
    success: true,
    timestamp: Date.now(),
  })

  afterEach(() => {
    dnsCache.clear()
  })

  it("evicts the least recently used entry, not the oldest inserted", () => {
    dnsCache.clear()

    for (let i = 0; i < 100; i++) {
      const domain = `host${i}.example.com`
      dnsCache.set(domain, "A", "cloudflare", cachedResult(domain))
    }
    expect(dnsCache.getStats().size).toBe(100)

    // read host0 so it is no longer the eviction candidate
    expect(dnsCache.get("host0.example.com", "A", "cloudflare")).not.toBeNull()

    dnsCache.set("host100.example.com", "A", "cloudflare", cachedResult("host100.example.com"))

    expect(dnsCache.getRemainingTTL("host0.example.com", "A", "cloudflare")).not.toBeNull()
    expect(dnsCache.getRemainingTTL("host1.example.com", "A", "cloudflare")).toBeNull()
    expect(dnsCache.getRemainingTTL("host100.example.com", "A", "cloudflare")).not.toBeNull()
    expect(dnsCache.getStats().size).toBe(100)
  })

  it("re-setting a key refreshes its recency", () => {
    dnsCache.clear()

    for (let i = 0; i < 100; i++) {
      const domain = `node${i}.example.com`
      dnsCache.set(domain, "A", "cloudflare", cachedResult(domain))
    }

    dnsCache.set("node0.example.com", "A", "cloudflare", cachedResult("node0.example.com"))
    dnsCache.set("node100.example.com", "A", "cloudflare", cachedResult("node100.example.com"))

    expect(dnsCache.getRemainingTTL("node0.example.com", "A", "cloudflare")).not.toBeNull()
    expect(dnsCache.getRemainingTTL("node1.example.com", "A", "cloudflare")).toBeNull()
  })
})
