// IP and MAC conflict detection utilities

import type { ParsedARPEntry, ParsedDHCPLease, ParsedMACEntry } from "./parsers"
import { ipv4ToInt, isValidIPv4 } from "@/lib/network-utils"

export interface ConflictEntry {
  ip?: string
  mac?: string
  hostname?: string
  vlan?: string
  interface?: string
  source: string
  sourceData: string
}

export interface IPConflict {
  type: "ip-duplicate"
  ip: string
  entries: ConflictEntry[]
  severity: "high" | "medium" | "low"
  description: string
  remediation: string[]
}

export interface MACConflict {
  type: "mac-duplicate"
  mac: string
  entries: ConflictEntry[]
  severity: "high" | "medium" | "low"
  description: string
  remediation: string[]
}

export interface SubnetConflict {
  type: "subnet-overlap"
  description: string
  entries: ConflictEntry[]
  severity: "high" | "medium" | "low"
  remediation: string[]
}

// arp entries are learned, not assigned, so a lease/arp mac mismatch is a stale lease or spoofing
export interface StaleLeaseConflict {
  type: "stale-lease-or-spoof"
  ip: string
  // field names kept for ui compat: staticEntry is the live arp observation
  staticEntry: ConflictEntry
  dhcpEntry: ConflictEntry
  severity: "high" | "medium" | "low"
  description: string
  remediation: string[]
}

// deprecated alias for the old misnamed type
export type DHCPConflict = StaleLeaseConflict

export type Conflict = IPConflict | MACConflict | SubnetConflict | StaleLeaseConflict

export interface ConflictAnalysisResult {
  conflicts: Conflict[]
  totalEntries: number
  uniqueIPs: number
  uniqueMACs: number
  sources: string[]
  summary: {
    high: number
    medium: number
    low: number
  }
}

function toConflictEntry(
  entry: ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry,
  sourceData: string
): ConflictEntry {
  return {
    ip: "ip" in entry ? entry.ip : undefined,
    mac: entry.mac,
    hostname: "hostname" in entry ? entry.hostname : undefined,
    vlan: "vlan" in entry ? entry.vlan : undefined,
    interface: "interface" in entry ? entry.interface : undefined,
    source: entry.source,
    sourceData,
  }
}

export function sameSubnet(ip1: string, ip2: string, prefixLength = 24): boolean {
  if (!isValidIPv4(ip1) || !isValidIPv4(ip2)) return false
  if (prefixLength < 0 || prefixLength > 32) return false
  if (prefixLength === 0) return true

  const mask = (0xffffffff << (32 - prefixLength)) >>> 0
  return (ipv4ToInt(ip1) & mask) === (ipv4ToInt(ip2) & mask)
}

function collectUniqueValues(entries: ConflictEntry[], key: keyof ConflictEntry): string[] {
  const values = entries
    .map((entry) => entry[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())

  return Array.from(new Set(values))
}

// same ip, different mac
function detectIPConflicts(entries: ConflictEntry[]): IPConflict[] {
  const conflicts: IPConflict[] = []
  const ipMap = new Map<string, ConflictEntry[]>()

  for (const entry of entries) {
    if (entry.ip) {
      if (!ipMap.has(entry.ip)) {
        ipMap.set(entry.ip, [])
      }
      ipMap.get(entry.ip)!.push(entry)
    }
  }

  for (const [ip, ipEntries] of ipMap) {
    if (ipEntries.length > 1) {
      const uniqueMACs = new Set(ipEntries.map((e) => e.mac).filter(Boolean))

      if (uniqueMACs.size > 1) {
        const severity = ipEntries.some((e) => e.source === "dhcp") ? "high" : "medium"
        const remediation = new Set<string>([
          "Verify which device should have this IP address",
          "Check for IP address conflicts on the network",
          "Update DHCP reservations if necessary",
          "Investigate potential ARP spoofing or duplicate IP assignment",
        ])

        const interfaces = collectUniqueValues(ipEntries, "interface")
        if (interfaces.length > 0) {
          remediation.add(
            `Inspect connected switch/router interfaces (${interfaces.join(", ")}) for duplicate hosts.`
          )
        }

        const vlans = collectUniqueValues(ipEntries, "vlan")
        if (vlans.length > 0) {
          remediation.add(
            `Verify VLAN configuration for ${vlans.join(", ")} and ensure static assignments are documented.`
          )
        }

        const hostnames = collectUniqueValues(ipEntries, "hostname")
        if (hostnames.length > 0) {
          remediation.add(
            `Confirm the intended hostnames (${hostnames.join(", ")}) and shut down any unexpected node.`
          )
        }

        if (ipEntries.some((entry) => entry.source === "mac-table")) {
          remediation.add(
            "Clear stale CAM table entries on the relevant switches after removing the duplicate device."
          )
        }

        if (ipEntries.some((entry) => entry.source === "arp")) {
          remediation.add(
            "Flush ARP caches on affected routers or switches after resolving the conflict."
          )
        }

        conflicts.push({
          type: "ip-duplicate",
          ip,
          entries: ipEntries,
          severity,
          description: `IP address ${ip} is associated with ${uniqueMACs.size} different MAC addresses`,
          remediation: Array.from(remediation),
        })
      }
    }
  }

  return conflicts
}

// same mac, different ips in one subnet
function detectMACConflicts(entries: ConflictEntry[], prefixLength = 24): MACConflict[] {
  const conflicts: MACConflict[] = []
  const macMap = new Map<string, ConflictEntry[]>()

  for (const entry of entries) {
    if (entry.mac) {
      if (!macMap.has(entry.mac)) {
        macMap.set(entry.mac, [])
      }
      macMap.get(entry.mac)!.push(entry)
    }
  }

  for (const [mac, macEntries] of macMap) {
    if (macEntries.length > 1) {
      // dedupe so the same host seen in multiple sources is not a conflict
      const uniqueIPs = Array.from(
        new Set(macEntries.map((e) => e.ip).filter((ip): ip is string => !!ip))
      )

      if (uniqueIPs.length > 1) {
        let hasConflict = false
        for (let i = 0; i < uniqueIPs.length; i++) {
          for (let j = i + 1; j < uniqueIPs.length; j++) {
            if (sameSubnet(uniqueIPs[i], uniqueIPs[j], prefixLength)) {
              hasConflict = true
              break
            }
          }
          if (hasConflict) break
        }

        if (hasConflict) {
          const remediation = new Set<string>([
            "Verify device network configuration",
            "Check for MAC address cloning or spoofing",
            "Investigate DHCP lease conflicts",
            "Ensure device is not multi-homed incorrectly",
          ])

          const interfaces = collectUniqueValues(macEntries, "interface")
          if (interfaces.length > 0) {
            remediation.add(
              `Audit switch ports ${interfaces.join(", ")} for unmanaged switches, bridges, or loops.`
            )
          }

          const vlans = collectUniqueValues(macEntries, "vlan")
          if (vlans.length > 1) {
            remediation.add(
              `Confirm the MAC address is not trunked across VLANs (${vlans.join(", ")}) unexpectedly.`
            )
          }

          if (macEntries.some((entry) => entry.source === "mac-table")) {
            remediation.add(
              "Consider enabling port security or sticky MAC on the affected interfaces to prevent duplicates."
            )
          }

          conflicts.push({
            type: "mac-duplicate",
            mac,
            entries: macEntries,
            severity: "medium",
            description: `MAC address ${mac} is associated with multiple IP addresses in the same subnet (assuming /${prefixLength})`,
            remediation: Array.from(remediation),
          })
        }
      }
    }
  }

  return conflicts
}

// a mismatch usually means the lease is stale, rarely spoofing
function detectStaleLeaseConflicts(entries: ConflictEntry[]): StaleLeaseConflict[] {
  const conflicts: StaleLeaseConflict[] = []
  const liveEntries = entries.filter((e) => e.source === "arp" || e.source === "mac-table")
  const dhcpEntries = entries.filter((e) => e.source === "dhcp")

  // one conflict per ip, not one per matching entry
  const reportedIPs = new Set<string>()

  for (const liveEntry of liveEntries) {
    if (!liveEntry.ip || reportedIPs.has(liveEntry.ip)) continue

    const conflictingDHCP = dhcpEntries.find(
      (dhcp) => dhcp.ip === liveEntry.ip && dhcp.mac !== liveEntry.mac
    )

    if (conflictingDHCP) {
      reportedIPs.add(liveEntry.ip)

      const remediation = new Set<string>([
        "Check the DHCP server for an expired or superseded lease on this IP",
        "Release and renew the lease, or shorten lease times if this recurs",
        "Verify which MAC address currently owns the IP on the network",
        "If the ARP entry is unexpected, investigate possible ARP/IP spoofing",
      ])

      const interfaces = collectUniqueValues([liveEntry], "interface")
      if (interfaces.length > 0) {
        remediation.add(
          `Check the connected interface (${interfaces.join(", ")}) to identify the device currently using the IP.`
        )
      }

      const scopeNames = collectUniqueValues([liveEntry, conflictingDHCP], "vlan")
      if (scopeNames.length > 0) {
        remediation.add(
          `Validate DHCP scopes or VLANs (${scopeNames.join(", ")}) to ensure lease records are current.`
        )
      }

      const hostnames = collectUniqueValues([conflictingDHCP], "hostname")
      if (hostnames.length > 0) {
        remediation.add(`Confirm the lease record for ${hostnames.join(", ")} is still valid.`)
      }

      conflicts.push({
        type: "stale-lease-or-spoof",
        ip: liveEntry.ip,
        staticEntry: liveEntry,
        dhcpEntry: conflictingDHCP,
        severity: "medium",
        description: `DHCP lease for ${liveEntry.ip} does not match the live ARP entry (stale lease or possible spoofing)`,
        remediation: Array.from(remediation),
      })
    }
  }

  return conflicts
}

export function analyzeConflicts(
  parsedData: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[],
  sourceTexts: string[],
  subnetPrefixLength = 24
): ConflictAnalysisResult {
  // entry-to-source-text attribution is only honest with a single source;
  // entry.source already carries the real origin type (arp/dhcp/mac-table)
  const sourceData = sourceTexts.length === 1 ? sourceTexts[0] : ""
  const entries: ConflictEntry[] = parsedData.map((entry) => toConflictEntry(entry, sourceData))

  const ipConflicts = detectIPConflicts(entries)
  const macConflicts = detectMACConflicts(entries, subnetPrefixLength)
  const staleLeaseConflicts = detectStaleLeaseConflicts(entries)

  const allConflicts: Conflict[] = [...ipConflicts, ...macConflicts, ...staleLeaseConflicts]

  const uniqueIPs = new Set(entries.map((e) => e.ip).filter(Boolean)).size
  const uniqueMACs = new Set(entries.map((e) => e.mac).filter(Boolean)).size
  const sources = [...new Set(entries.map((e) => e.source))]

  const summary = allConflicts.reduce(
    (acc, conflict) => {
      acc[conflict.severity]++
      return acc
    },
    { high: 0, medium: 0, low: 0 }
  )

  return {
    conflicts: allConflicts,
    totalEntries: entries.length,
    uniqueIPs,
    uniqueMACs,
    sources,
    summary,
  }
}

export function exportConflictsToCSV(conflicts: Conflict[]): string {
  const headers = ["Type", "Severity", "Description", "IP", "MAC", "Sources", "Remediation"]

  const rows = conflicts.map((conflict) => {
    const ip = "ip" in conflict ? conflict.ip : ""
    const mac = "mac" in conflict ? conflict.mac : ""
    const sources =
      "entries" in conflict
        ? conflict.entries.map((e: ConflictEntry) => e.source).join("; ")
        : [conflict.staticEntry.source, conflict.dhcpEntry.source].join("; ")
    const remediation = conflict.remediation.join("; ")

    return [conflict.type, conflict.severity, conflict.description, ip, mac, sources, remediation]
  })

  return [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join(
    "\n"
  )
}

export function generateRemediationReport(conflicts: Conflict[]): string {
  let report = "Network Conflict Remediation Report\n"
  report += "=====================================\n\n"

  const highPriority = conflicts.filter((c) => c.severity === "high")
  const mediumPriority = conflicts.filter((c) => c.severity === "medium")
  const lowPriority = conflicts.filter((c) => c.severity === "low")

  if (highPriority.length > 0) {
    report += "HIGH PRIORITY CONFLICTS (Immediate Action Required)\n"
    report += "================================================\n\n"

    for (const conflict of highPriority) {
      report += `${conflict.type.toUpperCase()}: ${conflict.description}\n`
      report += "Remediation Steps:\n"
      for (const step of conflict.remediation) {
        report += `  • ${step}\n`
      }
      report += "\n"
    }
  }

  if (mediumPriority.length > 0) {
    report += "MEDIUM PRIORITY CONFLICTS (Plan for Resolution)\n"
    report += "==============================================\n\n"

    for (const conflict of mediumPriority) {
      report += `${conflict.type.toUpperCase()}: ${conflict.description}\n`
      report += "Remediation Steps:\n"
      for (const step of conflict.remediation) {
        report += `  • ${step}\n`
      }
      report += "\n"
    }
  }

  if (lowPriority.length > 0) {
    report += "LOW PRIORITY CONFLICTS (Monitor)\n"
    report += "===============================\n\n"

    for (const conflict of lowPriority) {
      report += `${conflict.type.toUpperCase()}: ${conflict.description}\n`
      report += "Remediation Steps:\n"
      for (const step of conflict.remediation) {
        report += `  • ${step}\n`
      }
      report += "\n"
    }
  }

  if (conflicts.length === 0) {
    report += "No conflicts detected in the provided network data.\n"
    report += "Continue monitoring network for potential issues.\n"
  }

  return report
}
