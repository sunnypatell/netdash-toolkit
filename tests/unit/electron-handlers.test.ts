import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  normalizeMac,
  parseArpOutput,
  parsePingOutput,
  parseTracerouteOutput,
} from "@/electron/network/handlers"

// fixtures are real output captured from a macos host, not hand-written
const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures", name), "utf8")

describe("parsePingOutput", () => {
  it("extracts every rtt from real macos ping output", () => {
    const times = parsePingOutput(fixture("ping-macos.txt"), "darwin")
    expect(times).toHaveLength(3)
    for (const t of times) {
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThan(1000)
    }
  })

  it("returns no times when every probe was lost", () => {
    expect(parsePingOutput("Request timeout for icmp_seq 0\n", "darwin")).toEqual([])
  })
})

describe("parseTracerouteOutput", () => {
  it("parses hops and timeouts from real macos traceroute output", () => {
    const hops = parseTracerouteOutput(fixture("traceroute-macos.txt"), "darwin")
    expect(hops.length).toBeGreaterThanOrEqual(3)

    const first = hops[0]
    expect(first.hop).toBe(1)
    expect(first.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
    expect(first.timeout).toBe(false)
    expect(first.rtt[0]).toBeGreaterThan(0)

    // unanswered hops must be marked, not dropped or invented
    const timedOut = hops.filter((h) => h.timeout)
    expect(timedOut.length).toBeGreaterThan(0)
    for (const h of timedOut) {
      expect(h.rtt).toEqual([])
    }
  })

  it("parses hostname-bearing hops", () => {
    const out = " 3  router.example.com (10.0.0.1)  5.100 ms\n"
    const hops = parseTracerouteOutput(out, "darwin")
    expect(hops[0].hop).toBe(3)
    expect(hops[0].timeout).toBe(false)
  })
})

describe("parseArpOutput", () => {
  it("keeps entries whose octets are unpadded, and skips incomplete ones", () => {
    const entries = parseArpOutput(fixture("arp-macos.txt"), "darwin")
    // the fixture has 3 resolved entries plus one "(incomplete)" line
    expect(entries).toHaveLength(3)
    for (const e of entries) {
      expect(e.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
      // every mac normalized to padded lowercase colon form
      expect(e.mac).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/)
      expect(e.interface).toBe("en0")
    }
    // this exact entry was silently dropped before: 16:82:7:... has 1-char octets
    expect(entries.map((e) => e.mac)).toContain("16:82:07:44:1a:6d")
  })

  it("parses the linux [ether] form including the interface", () => {
    const out = "? (10.0.0.5) at 00:11:22:33:44:55 [ether] on eth0\n"
    expect(parseArpOutput(out, "linux")).toEqual([
      { ip: "10.0.0.5", mac: "00:11:22:33:44:55", interface: "eth0" },
    ])
  })

  it("parses the windows hyphenated form", () => {
    const out = "  192.168.1.1           00-11-22-33-44-55     dynamic\n"
    expect(parseArpOutput(out, "win32")).toEqual([
      { ip: "192.168.1.1", mac: "00:11:22:33:44:55", interface: undefined },
    ])
  })
})

describe("normalizeMac", () => {
  it("pads and lowercases every vendor form", () => {
    expect(normalizeMac("8:0:27:1a:2b:3c")).toBe("08:00:27:1a:2b:3c")
    expect(normalizeMac("84:A3:29:58:8E:89")).toBe("84:a3:29:58:8e:89")
    expect(normalizeMac("00-11-22-33-44-55")).toBe("00:11:22:33:44:55")
    expect(normalizeMac("0011.2233.4455")).toBe("00:11:22:33:44:55")
    expect(normalizeMac("001122-334455")).toBe("00:11:22:33:44:55")
  })
})
