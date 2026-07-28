import { describe, it, expect } from "vitest"
import {
  normalizeMac,
  parseWindowsARP,
  parseLinuxARP,
  parseLinuxLegacyARP,
  parseCiscoARP,
  parseCiscoMAC,
  parseArubaMAC,
  parseJuniperARP,
  parseHPARP,
  parseFortiGateARP,
  parseMikrotikARP,
  parseDHCPLeases,
  parseEnhancedDHCPLeases,
  parseNetworkDiscovery,
  autoParseNetworkData,
} from "@/lib/parsers"

describe("normalizeMac", () => {
  it("keeps colon-separated form and lowercases", () => {
    expect(normalizeMac("AA:BB:CC:DD:EE:FF")).toBe("aa:bb:cc:dd:ee:ff")
  })

  it("converts hyphen-separated windows form", () => {
    expect(normalizeMac("00-11-22-33-44-55")).toBe("00:11:22:33:44:55")
  })

  it("converts cisco dotted triplet form", () => {
    expect(normalizeMac("0011.2233.4455")).toBe("00:11:22:33:44:55")
  })

  it("pads unpadded bsd/macos octets", () => {
    expect(normalizeMac("8:0:27:1a:2b:3c")).toBe("08:00:27:1a:2b:3c")
  })

  it("converts hp 6-6 hyphen form", () => {
    expect(normalizeMac("001122-334455")).toBe("00:11:22:33:44:55")
  })

  it("throws on too-short input", () => {
    expect(() => normalizeMac("00:11:22")).toThrow()
  })
})

describe("parseWindowsARP", () => {
  const sample = [
    "Interface: 192.168.1.10 --- 0x4",
    "  Internet Address      Physical Address      Type",
    "  192.168.1.1           00-11-22-33-44-55     dynamic",
    "  192.168.1.255         ff-ff-ff-ff-ff-ff     static",
    "  224.0.0.22            01-00-5e-00-00-16     static",
  ].join("\n")

  it("parses arp -a entries with normalized macs", () => {
    const entries = parseWindowsARP(sample)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({
      ip: "192.168.1.1",
      mac: "00:11:22:33:44:55",
      type: "dynamic",
      source: "arp",
    })
    expect(entries[1].mac).toBe("ff:ff:ff:ff:ff:ff")
    expect(entries[2].type).toBe("static")
  })
})

describe("parseLinuxARP", () => {
  const sample = [
    "192.168.1.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE",
    "192.168.1.20 dev wlan0 lladdr 66:77:88:99:aa:bb STALE",
    "192.168.1.30 dev eth0  FAILED",
  ].join("\n")

  it("parses ip neigh output and skips incomplete entries", () => {
    const entries = parseLinuxARP(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ip: "192.168.1.1",
      mac: "00:11:22:33:44:55",
      interface: "eth0",
      source: "arp",
    })
    expect(entries[1].interface).toBe("wlan0")
  })
})

describe("parseLinuxLegacyARP", () => {
  const sample = [
    "Address                  HWtype  HWaddress           Flags Mask            Iface",
    "192.168.1.1              ether   00:11:22:33:44:55   C                     eth0",
    "192.168.1.99                     (incomplete)                              eth0",
  ].join("\n")

  it("parses arp -n output and skips incomplete entries", () => {
    const entries = parseLinuxLegacyARP(sample)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({
      ip: "192.168.1.1",
      mac: "00:11:22:33:44:55",
      interface: "eth0",
      source: "arp",
    })
  })

  it("does not match fortigate lines that also carry the mac in the third column", () => {
    const fortigate = "192.168.1.10      0          00:0c:29:aa:bb:cc  internal"
    expect(parseLinuxLegacyARP(fortigate)).toHaveLength(0)
  })
})

describe("parseCiscoARP", () => {
  const sample = [
    "Protocol  Address          Age (min)  Hardware Addr   Type   Interface",
    "Internet  192.168.1.1             5   0011.2233.4455  ARPA   GigabitEthernet0/1",
    "Internet  192.168.1.20            -   aabb.ccdd.eeff  ARPA   Vlan10",
    "Internet  192.168.1.99            0   Incomplete      ARPA",
  ].join("\n")

  it("parses show arp with dotted macs and skips incomplete", () => {
    const entries = parseCiscoARP(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ip: "192.168.1.1",
      mac: "00:11:22:33:44:55",
      interface: "GigabitEthernet0/1",
      source: "arp",
    })
    expect(entries[1].mac).toBe("aa:bb:cc:dd:ee:ff")
    expect(entries[1].interface).toBe("Vlan10")
  })
})

describe("parseCiscoMAC", () => {
  const sample = [
    "          Mac Address Table",
    "-------------------------------------------",
    "Vlan    Mac Address       Type        Ports",
    "----    -----------       --------    -----",
    "  10    0011.2233.4455    DYNAMIC     Gi1/0/1",
    "  20    aabb.ccdd.eeff    STATIC      Gi1/0/2",
  ].join("\n")

  it("parses show mac address-table entries", () => {
    const entries = parseCiscoMAC(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      mac: "00:11:22:33:44:55",
      vlan: "10",
      type: "dynamic",
      interface: "Gi1/0/1",
      source: "mac-table",
    })
    expect(entries[1].vlan).toBe("20")
    expect(entries[1].type).toBe("static")
  })

  it("does not match juniper mac-first arp lines", () => {
    const juniper = "00:0c:29:12:34:56 10.10.10.1      gw.example.net  ge-0/0/0.0   none"
    expect(parseCiscoMAC(juniper)).toHaveLength(0)
  })
})

describe("parseArubaMAC", () => {
  const sample = [
    "MAC age-time            : 300 seconds",
    "Number of MAC addresses : 3",
    "",
    "MAC Address          VLAN     Type                      Port",
    "--------------------------------------------------------------",
    "00:50:56:96:9b:04    10       dynamic                   1/1/1",
    "00:50:56:96:aa:bb    20       static                    1/1/2",
    "00:50:56:96:cc:dd    30       port-security             1/1/3",
  ].join("\n")

  it("parses mac-first aruba cx table with vlan and port", () => {
    const entries = parseArubaMAC(sample)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({
      mac: "00:50:56:96:9b:04",
      vlan: "10",
      type: "dynamic",
      interface: "1/1/1",
      source: "mac-table",
    })
    expect(entries[1].type).toBe("static")
    expect(entries[2].type).toBe("port-security")
    expect(entries[2].interface).toBe("1/1/3")
  })
})

describe("parseJuniperARP", () => {
  const sample = [
    "MAC Address       Address         Name                      Interface           Flags",
    "00:0c:29:12:34:56 10.10.10.1      gw.example.net            ge-0/0/0.0          none",
    "00:0c:29:ab:cd:ef 10.10.10.20     10.10.10.20               irb.0               none",
    "Total entries: 2",
  ].join("\n")

  it("parses mac-first show arp output", () => {
    const entries = parseJuniperARP(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ip: "10.10.10.1",
      mac: "00:0c:29:12:34:56",
      interface: "ge-0/0/0.0",
      source: "arp",
    })
    expect(entries[1].ip).toBe("10.10.10.20")
    expect(entries[1].interface).toBe("irb.0")
  })

  it("does not match fortigate ip-first lines", () => {
    const fortigate = "192.168.1.10      0          00:0c:29:aa:bb:cc  internal"
    expect(parseJuniperARP(fortigate)).toHaveLength(0)
  })
})

describe("parseHPARP", () => {
  const sample = [
    "  IP ARP table",
    "",
    "  IP Address      MAC Address       Type    Port",
    "  --------------- ----------------- ------- ----",
    "  10.1.1.1        001122-334455     dynamic 1",
    "  10.1.1.50       aabbcc-ddeeff     dynamic 24",
  ].join("\n")

  it("parses procurve 6-6 macs with type and port columns", () => {
    const entries = parseHPARP(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ip: "10.1.1.1",
      mac: "00:11:22:33:44:55",
      type: "dynamic",
      interface: "1",
      source: "arp",
    })
    expect(entries[1].mac).toBe("aa:bb:cc:dd:ee:ff")
    expect(entries[1].interface).toBe("24")
  })
})

describe("parseFortiGateARP", () => {
  const sample = [
    "get system arp",
    "Address           Age(min)   Hardware Addr      Interface",
    "192.168.1.10      0          00:0c:29:aa:bb:cc  internal",
    "192.168.1.1       3          00:09:0f:11:22:33  wan1",
  ].join("\n")

  it("parses get system arp with mac in third column", () => {
    const entries = parseFortiGateARP(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ip: "192.168.1.10",
      mac: "00:0c:29:aa:bb:cc",
      interface: "internal",
      source: "arp",
    })
    expect(entries[1].interface).toBe("wan1")
  })

  it("does not match juniper mac-first lines", () => {
    const juniper = "00:0c:29:12:34:56 10.10.10.1      gw.example.net  ge-0/0/0.0   none"
    expect(parseFortiGateARP(juniper)).toHaveLength(0)
  })
})

describe("parseMikrotikARP", () => {
  const sample = [
    "Flags: X - disabled, I - invalid, H - DHCP, D - dynamic, P - published, C - complete",
    " #    ADDRESS         MAC-ADDRESS        INTERFACE",
    " 0 DC 10.0.0.1        00:11:22:33:44:55  ether1",
    " 1  C 10.0.0.2        AA:BB:CC:DD:EE:FF  bridge1",
    " 2    10.0.0.3        08:00:27:1A:2B:3C  ether2",
  ].join("\n")

  it("parses ip arp print with optional flag letters and one trailing token", () => {
    const entries = parseMikrotikARP(sample)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({
      ip: "10.0.0.1",
      mac: "00:11:22:33:44:55",
      interface: "ether1",
      source: "arp",
    })
    expect(entries[1].mac).toBe("aa:bb:cc:dd:ee:ff")
    expect(entries[1].interface).toBe("bridge1")
    expect(entries[2].ip).toBe("10.0.0.3")
    expect(entries[2].interface).toBe("ether2")
  })
})

describe("parseDHCPLeases", () => {
  const sample = [
    "Lease Start,Lease End,IP Address,MAC Address,Hostname,VLAN,Scope",
    "2026-07-01 10:00,2026-07-01 22:00,192.168.1.50,00:11:22:33:44:55,host-a,10,office",
    "2026-07-02 10:00,2026-07-02 22:00,192.168.1.51,66-77-88-99-aa-bb",
    "only,three,columns",
  ].join("\n")

  it("parses full rows and short rows without misassignment", () => {
    const entries = parseDHCPLeases(sample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ip: "192.168.1.50",
      mac: "00:11:22:33:44:55",
      hostname: "host-a",
      vlan: "10",
      scope: "office",
      leaseStart: "2026-07-01 10:00",
      leaseEnd: "2026-07-01 22:00",
      source: "dhcp",
    })
    expect(entries[1].mac).toBe("66:77:88:99:aa:bb")
    expect(entries[1].hostname).toBeUndefined()
    expect(entries[1].scope).toBeUndefined()
  })
})

describe("parseEnhancedDHCPLeases", () => {
  const iscSample = [
    "lease 192.168.1.100 {",
    "  starts 4 2026/07/23 10:00:00;",
    "  ends 4 2026/07/23 22:00:00;",
    "  hardware ethernet 00:11:22:33:44:55;",
    '  client-hostname "laptop-01";',
    "}",
    "lease 192.168.1.101 {",
    "  starts 4 2026/07/23 11:00:00;",
    "  ends 4 2026/07/23 23:00:00;",
    "  hardware ethernet 66:77:88:99:aa:bb;",
    "}",
  ].join("\n")

  it("parses isc leases and keeps ones without client-hostname", () => {
    const entries = parseEnhancedDHCPLeases(iscSample)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      ip: "192.168.1.100",
      mac: "00:11:22:33:44:55",
      hostname: "laptop-01",
      source: "dhcp",
    })
    expect(entries[1].ip).toBe("192.168.1.101")
    expect(entries[1].mac).toBe("66:77:88:99:aa:bb")
    expect(entries[1].hostname).toBeUndefined()
  })
})

describe("parseNetworkDiscovery", () => {
  it("never pairs a cdp hostname with the next block's ip", () => {
    const sample = [
      "-------------------------",
      "Device ID: SEP001122334455",
      "Entry address(es):",
      "Platform: Cisco IP Phone 7965,  Capabilities: Host Phone",
      "Interface: GigabitEthernet1/0/10",
      "-------------------------",
      "Device ID: core-sw-01.example.net",
      "Entry address(es):",
      "  IP address: 10.0.0.2",
      "Platform: cisco WS-C3850-48P,  Capabilities: Router Switch IGMP",
    ].join("\n")

    const devices = parseNetworkDiscovery(sample)
    expect(devices).toHaveLength(2)

    const phone = devices.find((d) => d.hostname === "SEP001122334455")
    const core = devices.find((d) => d.hostname === "core-sw-01.example.net")
    // block without an ip must stay ip-less instead of stealing the neighbor's
    expect(phone?.ip).toBeUndefined()
    expect(phone?.role).toBe("Cisco IP Phone 7965")
    expect(core?.ip).toBe("10.0.0.2")
    expect(core?.role).toBe("cisco WS-C3850-48P")
  })

  it("never pairs an lldp system name with the next neighbor's management address", () => {
    const sample = [
      "Chassis id: 00:11:22:33:44:66",
      "System Name: ap-floor2",
      "System Description: Access Point",
      "------------------------------------------------",
      "Chassis id: 00:11:22:33:44:77",
      "System Name: sw-access-01",
      "Management Address: 10.0.0.5",
    ].join("\n")

    const devices = parseNetworkDiscovery(sample)
    expect(devices).toHaveLength(2)

    const ap = devices.find((d) => d.hostname === "ap-floor2")
    const sw = devices.find((d) => d.hostname === "sw-access-01")
    expect(ap?.ip).toBeUndefined()
    expect(sw?.ip).toBe("10.0.0.5")
  })
})

describe("autoParseNetworkData", () => {
  it("produces no duplicate entries for fortigate output", () => {
    const fortigate = [
      "Address           Age(min)   Hardware Addr      Interface",
      "192.168.1.10      0          00:0c:29:aa:bb:cc  internal",
      "192.168.1.1       3          00:09:0f:11:22:33  wan1",
    ].join("\n")

    const results = autoParseNetworkData(fortigate)
    expect(results).toHaveLength(2)
    expect(results.map((r) => ("interface" in r ? r.interface : undefined))).toEqual([
      "internal",
      "wan1",
    ])
  })

  it("produces no duplicate entries for juniper output", () => {
    const juniper = [
      "MAC Address       Address         Name                      Interface           Flags",
      "00:0c:29:12:34:56 10.10.10.1      gw.example.net            ge-0/0/0.0          none",
      "00:0c:29:ab:cd:ef 10.10.10.20     10.10.10.20               irb.0               none",
    ].join("\n")

    const results = autoParseNetworkData(juniper)
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.source === "arp")).toBe(true)
  })
})
