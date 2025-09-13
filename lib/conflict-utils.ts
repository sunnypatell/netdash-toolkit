// IP and MAC conflict detection utilities

import type { ParsedARPEntry, ParsedDHCPLease, ParsedMACEntry } from "./parsers"
import { isValidIPv4 } from "./network-utils"

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

export interface DHCPConflict {
  type: "dhcp-static-overlap"
  ip: string
  staticEntry: ConflictEntry
  dhcpEntry: ConflictEntry
  severity: "high" | "medium" | "low"
  description: string
  remediation: string[]
}

export type Conflict = IPConflict | MACConflict | SubnetConflict | DHCPConflict

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

// Convert parsed entries to conflict entries
function toConflictEntry(entry: ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry, sourceData: string): ConflictEntry {
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

// Check if two IPs are in the same subnet
function sameSubnet(ip1: string, ip2: string, prefixLength = 24): boolean {
  if (!isValidIPv4(ip1) || !isValidIPv4(ip2)) return false

  const mask = (0xffffffff << (32 - prefixLength)) >>> 0
  const ip1Int = ip1.split(".").reduce((acc, octet) => (acc << 8) + Number.parseInt(octet), 0)
  const ip2Int = ip2.split(".").reduce((acc, octet) => (acc << 8) + Number.parseInt(octet), 0)

  return (ip1Int & mask) === (ip2Int & mask)
}

// Detect IP address conflicts (same IP, different MAC)
function detectIPConflicts(entries: ConflictEntry[]): IPConflict[] {
  const conflicts: IPConflict[] = []
  const ipMap = new Map<string, ConflictEntry[]>()

  // Group entries by IP address
  for (const entry of entries) {
    if (entry.ip) {
      if (!ipMap.has(entry.ip)) {
        ipMap.set(entry.ip, [])
      }
      ipMap.get(entry.ip)!.push(entry)
    }
  }

  // Check for conflicts
  for (const [ip, ipEntries] of ipMap) {
    if (ipEntries.length > 1) {
      const uniqueMACs = new Set(ipEntries.map((e) => e.mac).filter(Boolean))

      if (uniqueMACs.size > 1) {
        // Same IP with different MACs
        const severity = ipEntries.some((e) => e.source === "dhcp") ? "high" : "medium"

        conflicts.push({
          type: "ip-duplicate",
          ip,
          entries: ipEntries,
          severity,
          description: `IP address ${ip} is associated with ${uniqueMACs.size} different MAC addresses`,
          remediation: [
            "Verify which device should have this IP address",
            "Check for IP address conflicts on the network",
            "Update DHCP reservations if necessary",
            "Investigate potential ARP spoofing or duplicate IP assignment",
          ],
        })
      }
    }
  }

  return conflicts
}

// Detect MAC address conflicts (same MAC, different IPs in same subnet)
function detectMACConflicts(entries: ConflictEntry[]): MACConflict[] {
  const conflicts: MACConflict[] = []
  const macMap = new Map<string, ConflictEntry[]>()

  // Group entries by MAC address
  for (const entry of entries) {
    if (entry.mac) {
      if (!macMap.has(entry.mac)) {
        macMap.set(entry.mac, [])
      }
      macMap.get(entry.mac)!.push(entry)
    }
  }

  // Check for conflicts
  for (const [mac, macEntries] of macMap) {
    if (macEntries.length > 1) {
      const uniqueIPs = macEntries.map((e) => e.ip).filter(Boolean)

      if (uniqueIPs.length > 1) {
        // Check if IPs are in the same subnet (potential conflict)
        let hasConflict = false
        for (let i = 0; i < uniqueIPs.length; i++) {
          for (let j = i + 1; j < uniqueIPs.length; j++) {
            if (sameSubnet(uniqueIPs[i], uniqueIPs[j])) {
              hasConflict = true
              break
            }
          }
          if (hasConflict) break
        }

        if (hasConflict) {
          conflicts.push({
            type: "mac-duplicate",
            mac,
            entries: macEntries,
            severity: "medium",
            description: `MAC address ${mac} is associated with multiple IP addresses in the same subnet`,
            remediation: [
              "Verify device network configuration",
              "Check for MAC address cloning or spoofing",
              "Investigate DHCP lease conflicts",
              "Ensure device is not multi-homed incorrectly",
            ],
          })
        }
      }
    }
  }

  return conflicts
}

// Detect DHCP scope conflicts with static assignments
function detectDHCPConflicts(entries: ConflictEntry[]): DHCPConflict[] {
  const conflicts: DHCPConflict[] = []
  const staticEntries = entries.filter((e) => e.source === "arp" || e.source === "mac-table")
  const dhcpEntries = entries.filter((e) => e.source === "dhcp")

  for (const staticEntry of staticEntries) {
    if (!staticEntry.ip) continue

    const conflictingDHCP = dhcpEntries.find((dhcp) => dhcp.ip === staticEntry.ip && dhcp.mac !== staticEntry.mac)

    if (conflictingDHCP) {
      conflicts.push({
        type: "dhcp-static-overlap",
        ip: staticEntry.ip,
        staticEntry,
        dhcpEntry: conflictingDHCP,
        severity: "high",
        description: `Static IP ${staticEntry.ip} conflicts with DHCP lease for different MAC address`,
        remediation: [
          "Move static IP outside DHCP scope range",
          "Create DHCP reservation for static device",
          "Update DHCP scope to exclude static IP range",
          "Verify device MAC address is correct",
        ],
      })
    }
  }

  return conflicts
}

// Main conflict analysis function
export function analyzeConflicts(
  parsedData: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[],
  sourceTexts: string[],
): ConflictAnalysisResult {
  // Convert to conflict entries
  const entries: ConflictEntry[] = parsedData.map((entry, index) => {
    const sourceIndex = Math.min(index, sourceTexts.length - 1)
    return toConflictEntry(entry, sourceTexts[sourceIndex] || "")
  })

  // Detect different types of conflicts
  const ipConflicts = detectIPConflicts(entries)
  const macConflicts = detectMACConflicts(entries)
  const dhcpConflicts = detectDHCPConflicts(entries)

  const allConflicts: Conflict[] = [...ipConflicts, ...macConflicts, ...dhcpConflicts]

  // Calculate statistics
  const uniqueIPs = new Set(entries.map((e) => e.ip).filter(Boolean)).size
  const uniqueMACs = new Set(entries.map((e) => e.mac).filter(Boolean)).size
  const sources = [...new Set(entries.map((e) => e.source))]

  const summary = allConflicts.reduce(
    (acc, conflict) => {
      acc[conflict.severity]++
      return acc
    },
    { high: 0, medium: 0, low: 0 },
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

// Export conflicts to CSV
export function exportConflictsToCSV(conflicts: Conflict[]): string {
  const headers = ["Type", "Severity", "Description", "IP", "MAC", "Sources", "Remediation"]

  const rows = conflicts.map((conflict) => {
    const ip = "ip" in conflict ? conflict.ip : ""
    const mac = "mac" in conflict ? conflict.mac : ""
    const sources = conflict.entries.map((e) => e.source).join("; ")
    const remediation = conflict.remediation.join("; ")

    return [conflict.type, conflict.severity, conflict.description, ip, mac, sources, remediation]
  })

  return [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")
}

// Generate remediation report
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
