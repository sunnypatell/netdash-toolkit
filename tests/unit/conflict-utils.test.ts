import { describe, expect, it } from "vitest"
import { analyzeConflicts, sameSubnet } from "@/lib/conflict-utils"
import type { ParsedARPEntry, ParsedDHCPLease } from "@/lib/parsers"

function arp(ip: string, mac: string): ParsedARPEntry {
  return { ip, mac, source: "arp" }
}

function dhcp(ip: string, mac: string, hostname?: string): ParsedDHCPLease {
  return { ip, mac, hostname, source: "dhcp" }
}

describe("analyzeConflicts", () => {
  it("detects an ip conflict when two macs claim the same ip", () => {
    const result = analyzeConflicts(
      [arp("192.168.1.10", "aa:bb:cc:dd:ee:01"), arp("192.168.1.10", "aa:bb:cc:dd:ee:02")],
      ["arp snapshot"]
    )

    const ipConflicts = result.conflicts.filter((c) => c.type === "ip-duplicate")
    expect(ipConflicts).toHaveLength(1)
    expect(ipConflicts[0]).toMatchObject({ ip: "192.168.1.10", severity: "medium" })
  })

  it("does not flag the same host appearing in two sources", () => {
    // identical ip+mac from arp and a dhcp lease is one host, not a conflict
    const result = analyzeConflicts(
      [arp("192.168.1.10", "aa:bb:cc:dd:ee:01"), dhcp("192.168.1.10", "aa:bb:cc:dd:ee:01")],
      ["arp snapshot", "dhcp leases"]
    )

    expect(result.conflicts).toHaveLength(0)
  })

  it("detects one mac holding two different ips in the same /24", () => {
    const result = analyzeConflicts(
      [arp("192.168.1.10", "aa:bb:cc:dd:ee:01"), arp("192.168.1.20", "aa:bb:cc:dd:ee:01")],
      ["arp snapshot"]
    )

    const macConflicts = result.conflicts.filter((c) => c.type === "mac-duplicate")
    expect(macConflicts).toHaveLength(1)
    expect(macConflicts[0].description).toContain("assuming /24")
  })

  it("threads a non-/24 prefix through mac conflict detection", () => {
    const entries = [arp("10.0.1.5", "aa:bb:cc:dd:ee:01"), arp("10.0.2.5", "aa:bb:cc:dd:ee:01")]

    // different /24s, so the default prefix sees no conflict
    const at24 = analyzeConflicts(entries, ["arp snapshot"])
    expect(at24.conflicts.filter((c) => c.type === "mac-duplicate")).toHaveLength(0)

    // same /16, so a wider prefix does
    const at16 = analyzeConflicts(entries, ["arp snapshot"], 16)
    const macConflicts = at16.conflicts.filter((c) => c.type === "mac-duplicate")
    expect(macConflicts).toHaveLength(1)
    expect(macConflicts[0].description).toContain("assuming /16")
  })

  it("flags a dhcp lease that disagrees with the live arp entry as medium severity", () => {
    const result = analyzeConflicts(
      [
        arp("192.168.1.10", "aa:bb:cc:dd:ee:01"),
        dhcp("192.168.1.10", "aa:bb:cc:dd:ee:02", "old-host"),
      ],
      ["combined"]
    )

    const stale = result.conflicts.filter((c) => c.type === "stale-lease-or-spoof")
    expect(stale).toHaveLength(1)
    expect(stale[0].severity).toBe("medium")
    expect(stale[0].description).toContain("stale lease")
  })

  it("dedupes stale-lease conflicts to one per ip", () => {
    // same live host seen in two snapshots must not double-report the lease mismatch
    const result = analyzeConflicts(
      [
        arp("192.168.1.10", "aa:bb:cc:dd:ee:01"),
        arp("192.168.1.10", "aa:bb:cc:dd:ee:01"),
        dhcp("192.168.1.10", "aa:bb:cc:dd:ee:02"),
      ],
      ["snapshot 1", "snapshot 2", "dhcp leases"]
    )

    const stale = result.conflicts.filter((c) => c.type === "stale-lease-or-spoof")
    expect(stale).toHaveLength(1)
  })
})

describe("sameSubnet", () => {
  it("compares under the given prefix length", () => {
    expect(sameSubnet("10.0.1.5", "10.0.2.5")).toBe(false)
    expect(sameSubnet("10.0.1.5", "10.0.2.5", 16)).toBe(true)
    // /25 splits the .1.0/24 network at .128
    expect(sameSubnet("192.168.1.100", "192.168.1.200", 25)).toBe(false)
    expect(sameSubnet("192.168.1.100", "192.168.1.120", 25)).toBe(true)
  })

  it("rejects invalid input", () => {
    expect(sameSubnet("not-an-ip", "10.0.0.1")).toBe(false)
    expect(sameSubnet("10.0.0.1", "10.0.0.2", 33)).toBe(false)
  })
})
