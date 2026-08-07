import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildPingArgs,
  buildTracerouteArgs,
  normalizeMac,
  parseArpOutput,
  parsePingLoss,
  parsePingOutput,
  parseTracerouteOutput,
} from "@/electron/network/parsers"

// the macos fixtures are real capture; the linux and windows ones are transcribed, never probed
const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures", name), "utf8")

describe("parsePingOutput", () => {
  it("extracts every rtt from real macos ping output", () => {
    expect(parsePingOutput(fixture("ping-macos.txt"), "darwin")).toEqual([10.484, 8.399, 6.726])
  })

  it("extracts every rtt from linux iputils output", () => {
    expect(parsePingOutput(fixture("ping-linux.txt"), "linux")).toEqual([9.11, 8.94, 9.02])
  })

  it("counts a duplicated icmp sequence once", () => {
    // the DUP! reply repeats icmp_seq=1; counting it would report negative loss
    expect(parsePingOutput(fixture("ping-linux-dup.txt"), "linux")).toEqual([0.412, 0.401])
  })

  it("returns only the answered probes on partial loss", () => {
    expect(parsePingOutput(fixture("ping-linux-partial.txt"), "linux")).toEqual([1.21, 1.44])
  })

  it("returns no times when every probe was lost", () => {
    expect(parsePingOutput("Request timeout for icmp_seq 0\n", "darwin")).toEqual([])
  })

  it("reads windows replies without mistaking the summary block for one", () => {
    // "Minimum = 0ms" must not be read as a reply: three replies, not six
    expect(parsePingOutput(fixture("ping-windows.txt"), "win32")).toEqual([12, 1, 11])
  })

  it("reads a german windows ping, whose label is Zeit= rather than time=", () => {
    // matching the literal word "time" returned [] here, which the handler then
    // reported as a live host with 100% packet loss
    expect(parsePingOutput(fixture("ping-windows-de.txt"), "win32")).toEqual([12, 1, 11])
  })

  it("survives crlf line endings", () => {
    const crlf = fixture("ping-windows.txt").replace(/\n/g, "\r\n")
    expect(parsePingOutput(crlf, "win32")).toEqual([12, 1, 11])
  })
})

describe("parsePingLoss", () => {
  it("reads the figure ping printed rather than deriving one", () => {
    expect(parsePingLoss(fixture("ping-macos.txt"))).toBe(0)
    expect(parsePingLoss(fixture("ping-linux-partial.txt"))).toBe(50)
    expect(parsePingLoss(fixture("ping-windows.txt"))).toBe(25)
    expect(parsePingLoss(fixture("ping-windows-de.txt"))).toBe(25)
  })

  it("returns null when no summary was printed", () => {
    // the shape a run killed by our own timeout leaves behind
    expect(parsePingLoss("64 bytes from 192.0.2.1: icmp_seq=1 ttl=57 time=9.11 ms\n")).toBeNull()
  })
})

describe("parseTracerouteOutput", () => {
  it("parses hops and timeouts from real macos traceroute output", () => {
    const hops = parseTracerouteOutput(fixture("traceroute-macos.txt"), "darwin")
    expect(hops).toHaveLength(3)
    expect(hops[0]).toMatchObject({ hop: 1, ip: "192.168.1.254", timeout: false })
    expect(hops[0].rtt).toEqual([7.65])

    for (const hop of hops.filter((h) => h.timeout)) {
      expect(hop.rtt).toEqual([])
    }
  })

  it("parses hostname-bearing hops", () => {
    const hops = parseTracerouteOutput(" 3  router.example.com (10.0.0.1)  5.100 ms\n", "darwin")
    expect(hops[0]).toMatchObject({
      hop: 3,
      ip: "10.0.0.1",
      hostname: "router.example.com",
      timeout: false,
    })
  })

  it("keeps the address of a hop whose first probe was lost", () => {
    // " 2  * 198.51.100.9 (198.51.100.9)  8.104 ms" was reported as ip "*" and
    // timeout true even though the hop answered
    const hops = parseTracerouteOutput(fixture("traceroute-linux.txt"), "linux")
    expect(hops.map((h) => h.hop)).toEqual([1, 2, 3, 4])
    expect(hops[1]).toMatchObject({ hop: 2, ip: "198.51.100.9", timeout: false })
    expect(hops[1].rtt).toEqual([8.104])
    expect(hops[2]).toMatchObject({ hop: 3, ip: "*", timeout: true })
    // the !H annotation must not swallow the hop
    expect(hops[3]).toMatchObject({ hop: 4, ip: "192.0.2.1", timeout: false })
  })

  it("parses windows tracert including sub-millisecond and named hops", () => {
    const hops = parseTracerouteOutput(fixture("tracert-windows.txt"), "win32")
    expect(hops.map((h) => h.hop)).toEqual([1, 2, 3, 4])
    // "<1 ms" is a bound, recorded as 1
    expect(hops[0].rtt).toEqual([1, 1, 1])
    expect(hops[2]).toMatchObject({ hop: 3, ip: "*", timeout: true })
    // "one.one.one.one [192.0.2.1]" used to drop the hop entirely
    expect(hops[3]).toMatchObject({
      hop: 4,
      ip: "192.0.2.1",
      hostname: "one.one.one.one",
      timeout: false,
    })
  })

  it("keeps a german tracert's timed-out hop instead of leaving a hole", () => {
    // matching the literal "Request timed out." dropped hop 2, so the caller saw
    // hops numbered 1 and 3 and no indication that anything was missing
    const hops = parseTracerouteOutput(fixture("tracert-windows-de.txt"), "win32")
    expect(hops.map((h) => h.hop)).toEqual([1, 2, 3])
    expect(hops[1]).toMatchObject({ hop: 2, ip: "*", timeout: true })
    expect(hops[1].rtt).toEqual([])
  })

  it("ignores header and trailer lines", () => {
    const hops = parseTracerouteOutput(
      "traceroute to 192.0.2.1 (192.0.2.1), 30 hops max, 60 byte packets\n",
      "linux"
    )
    expect(hops).toEqual([])
  })
})

describe("parseArpOutput", () => {
  it("keeps entries whose octets are unpadded, and skips incomplete ones", () => {
    const entries = parseArpOutput(fixture("arp-macos.txt"), "darwin")
    // the fixture has 3 resolved entries plus one "(incomplete)" line
    expect(entries).toHaveLength(3)
    for (const e of entries) {
      expect(e.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
      expect(e.mac).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/)
      expect(e.interface).toBe("en0")
    }
    // this exact entry was silently dropped before: 16:82:7:... has 1-char octets
    expect(entries.map((e) => e.mac)).toContain("16:82:07:44:1a:6d")
  })

  it("parses the linux [ether] form and skips <incomplete>", () => {
    expect(parseArpOutput(fixture("arp-linux.txt"), "linux")).toEqual([
      { ip: "192.168.1.1", mac: "00:11:22:33:44:55", interface: "eth0" },
      { ip: "192.168.1.254", mac: "08:00:27:1a:2b:3c", interface: "eth0" },
    ])
  })

  it("attributes windows rows to the interface they were listed under", () => {
    // windows names its interfaces by address; this field was always undefined
    expect(parseArpOutput(fixture("arp-windows.txt"), "win32")).toEqual([
      { ip: "192.168.1.1", mac: "00:11:22:33:44:55", interface: "192.168.1.10" },
      { ip: "192.168.1.41", mac: "84:a3:29:58:8e:89", interface: "192.168.1.10" },
      { ip: "224.0.0.22", mac: "01:00:5e:00:00:16", interface: "192.168.1.10" },
      { ip: "10.0.0.1", mac: "aa:bb:cc:dd:ee:ff", interface: "10.0.0.5" },
    ])
  })

  it("reads a german windows arp table, whose type column says dynamisch", () => {
    // requiring the literal words dynamic|static returned an empty table, which
    // the ui presents as "no neighbours found"
    expect(parseArpOutput(fixture("arp-windows-de.txt"), "win32")).toEqual([
      { ip: "192.168.1.1", mac: "00:11:22:33:44:55", interface: "192.168.1.10" },
      { ip: "192.168.1.41", mac: "84:a3:29:58:8e:89", interface: "192.168.1.10" },
    ])
  })

  it("survives crlf line endings", () => {
    const crlf = fixture("arp-windows.txt").replace(/\n/g, "\r\n")
    expect(parseArpOutput(crlf, "win32")).toHaveLength(4)
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

describe("command argument builders", () => {
  const hosts = ["example.com", "192.0.2.1", "2001:db8::1"]

  it("puts the host in its own argument and never in a flag", () => {
    for (const platform of ["darwin", "linux", "win32"]) {
      for (const host of hosts) {
        const ping = buildPingArgs(platform, host, 4, 5000)
        const trace = buildTracerouteArgs(platform, host, 30, 5000)
        expect(ping[ping.length - 1]).toBe(host)
        expect(trace[trace.length - 1]).toBe(host)
        // an argument array only helps if nothing was concatenated into one
        for (const arg of [...ping, ...trace]) {
          expect(arg).not.toMatch(/\s/)
        }
      }
    }
  })

  it("emits only integers for every numeric flag", () => {
    for (const platform of ["darwin", "linux", "win32"]) {
      const args = [
        ...buildPingArgs(platform, "example.com", 4, 5000),
        ...buildTracerouteArgs(platform, "example.com", 30, 5000),
      ]
      for (const arg of args) {
        if (/^\d/.test(arg)) expect(arg).toMatch(/^\d+$/)
      }
    }
  })
})
