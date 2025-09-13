// Network data parsing utilities for various formats

export interface ParsedARPEntry {
  ip: string
  mac: string
  interface?: string
  type?: string
  source: "arp"
}

export interface ParsedDHCPLease {
  ip: string
  mac: string
  hostname?: string
  leaseStart?: string
  leaseEnd?: string
  vlan?: string
  scope?: string
  source: "dhcp"
}

export interface ParsedMACEntry {
  mac: string
  vlan?: string
  interface?: string
  type?: string
  source: "mac-table"
}

export interface ParsedDevice {
  hostname?: string
  ip?: string
  mac?: string
  interface?: string
  vlan?: string
  role?: string
}

// Normalize MAC address to xx:xx:xx:xx:xx:xx format
export function normalizeMac(mac: string): string {
  // Remove all non-hex characters
  const cleaned = mac.replace(/[^0-9a-fA-F]/g, "")

  if (cleaned.length !== 12) {
    throw new Error("Invalid MAC address length")
  }

  // Insert colons every 2 characters
  return cleaned
    .toLowerCase()
    .replace(/(.{2})/g, "$1:")
    .slice(0, -1)
}

// Windows ARP table parser
export function parseWindowsARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for Windows arp -a format
  const arpRegex = /^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]{17})\s+(\w+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[2]),
          type: match[3],
          source: "arp",
        })
      } catch (e) {
        // Skip invalid MAC addresses
        continue
      }
    }
  }

  return entries
}

// Linux ARP table parser
export function parseLinuxARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for Linux ip neigh format
  const neighRegex = /^(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\S+)\s+lladdr\s+([0-9a-f:]{17})/i

  for (const line of lines) {
    const match = line.match(neighRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[3]),
          interface: match[2],
          source: "arp",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// Cisco ARP table parser
export function parseCiscoARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for Cisco ARP format
  const arpRegex = /^Internet\s+(\d+\.\d+\.\d+\.\d+)\s+\d+\s+([0-9a-f.]{14})\s+ARPA\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[2]),
          interface: match[3],
          source: "arp",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// Cisco MAC table parser
export function parseCiscoMAC(text: string): ParsedMACEntry[] {
  const entries: ParsedMACEntry[] = []
  const lines = text.split("\n")

  const macRegex1 = /^([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\S+)\s+(\S+)/i
  const macRegex2 = /^([0-9a-f:]{17})\s+(\S+)\s+(\S+)/i
  const macRegex3 = /^\s*(\d+)\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+(\S+)\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(macRegex1) || line.match(macRegex2) || line.match(macRegex3)

    if (match) {
      try {
        let macAddress = match[1]
        let vlan = undefined
        let type = match[2]
        let interfaceName = match[3]

        // Handle format with VLAN as first column
        if (match.length === 5) {
          vlan = match[1]
          macAddress = match[2]
          type = match[3]
          interfaceName = match[4]
        }

        entries.push({
          mac: normalizeMac(macAddress),
          vlan: vlan,
          type: type,
          interface: interfaceName,
          source: "mac-table",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// Aruba CX MAC table parser
export function parseArubaMAC(text: string): ParsedMACEntry[] {
  const entries: ParsedMACEntry[] = []
  const lines = text.split("\n")

  // Regex for Aruba CX MAC table format
  const macRegex = /^(\d+)\s+([0-9a-f:]{17})\s+dynamic\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(macRegex)
    if (match) {
      try {
        entries.push({
          vlan: match[1],
          mac: normalizeMac(match[2]),
          interface: match[3],
          type: "dynamic",
          source: "mac-table",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// Juniper ARP table parser
export function parseJuniperARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for Juniper ARP format: show arp
  const arpRegex = /^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:]{17})\s+(\S+)\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[2]),
          interface: match[4],
          type: match[3],
          source: "arp",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// HP/HPE ProCurve ARP parser
export function parseHPARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for HP ARP format
  const arpRegex = /^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]{17})\s+(\S+)\s+(\d+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[2]),
          interface: match[3],
          source: "arp",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// Fortinet FortiGate ARP parser
export function parseFortiGateARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for FortiGate ARP format
  const arpRegex = /^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f:]{17})\s+(\S+)\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[2]),
          interface: match[3],
          source: "arp",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// Mikrotik ARP parser
export function parseMikrotikARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for Mikrotik ARP format
  const arpRegex = /^\s*\d+\s+(\d+\.\d+\.\d+\.\d+)\s+([0-9A-F:]{17})\s+(\S+)\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[2]),
          interface: match[3],
          source: "arp",
        })
      } catch (e) {
        continue
      }
    }
  }

  return entries
}

// CSV parser for DHCP leases and inventories
export function parseCSV(text: string, hasHeader = true): string[][] {
  const lines = text.trim().split("\n")
  const result: string[][] = []

  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields: string[] = []
    let current = ""
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        fields.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    fields.push(current.trim())
    result.push(fields)
  }

  return result
}

// DHCP lease parser from CSV
export function parseDHCPLeases(text: string): ParsedDHCPLease[] {
  const entries: ParsedDHCPLease[] = []

  try {
    const rows = parseCSV(text, true)

    for (const row of rows) {
      if (row.length >= 3) {
        const lease: ParsedDHCPLease = {
          ip: row[2] || "",
          mac: row[3] ? normalizeMac(row[3]) : "",
          hostname: row[4] || undefined,
          vlan: row[5] || undefined,
          scope: row[6] || undefined,
          leaseStart: row[0] || undefined,
          leaseEnd: row[1] || undefined,
          source: "dhcp",
        }

        if (lease.ip && lease.mac) {
          entries.push(lease)
        }
      }
    }
  } catch (e) {
    // If CSV parsing fails, try simple comma-separated parsing
    const lines = text.split("\n")
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim())
      if (parts.length >= 3 && parts[2] && parts[3]) {
        try {
          entries.push({
            ip: parts[2],
            mac: normalizeMac(parts[3]),
            hostname: parts[4] || undefined,
            source: "dhcp",
          })
        } catch (e) {
          continue
        }
      }
    }
  }

  return entries
}

// Enhanced DHCP lease parser with multiple formats
export function parseEnhancedDHCPLeases(text: string): ParsedDHCPLease[] {
  const entries: ParsedDHCPLease[] = []

  // Try Windows DHCP server format first
  const windowsDHCPRegex = /(\d+\.\d+\.\d+\.\d+),([0-9a-f-]{17}),([^,]*),([^,]*),([^,]*)/gi
  let match
  while ((match = windowsDHCPRegex.exec(text)) !== null) {
    try {
      entries.push({
        ip: match[1],
        mac: normalizeMac(match[2]),
        hostname: match[3] || undefined,
        leaseStart: match[4] || undefined,
        leaseEnd: match[5] || undefined,
        source: "dhcp",
      })
    } catch (e) {
      continue
    }
  }

  // Try ISC DHCP format
  const iscDHCPRegex =
    /lease\s+(\d+\.\d+\.\d+\.\d+)\s*{[^}]*hardware\s+ethernet\s+([0-9a-f:]{17});[^}]*client-hostname\s+"([^"]+)"/gi
  while ((match = iscDHCPRegex.exec(text)) !== null) {
    try {
      entries.push({
        ip: match[1],
        mac: normalizeMac(match[2]),
        hostname: match[3],
        source: "dhcp",
      })
    } catch (e) {
      continue
    }
  }

  // Fallback to original CSV parsing
  if (entries.length === 0) {
    entries.push(...parseDHCPLeases(text))
  }

  return entries
}

// Network device discovery parser (LLDP, CDP)
export function parseNetworkDiscovery(text: string): ParsedDevice[] {
  const devices: ParsedDevice[] = []
  const lines = text.split("\n")

  // CDP neighbor parsing
  const cdpRegex = /Device ID:\s*(\S+).*?IP address:\s*(\d+\.\d+\.\d+\.\d+).*?Platform:\s*([^,]+)/gis
  let match
  while ((match = cdpRegex.exec(text)) !== null) {
    devices.push({
      hostname: match[1],
      ip: match[2],
      role: match[3],
    })
  }

  // LLDP neighbor parsing
  const lldpRegex = /System Name:\s*(\S+).*?Management Address:\s*(\d+\.\d+\.\d+\.\d+)/gis
  while ((match = lldpRegex.exec(text)) !== null) {
    devices.push({
      hostname: match[1],
      ip: match[2],
    })
  }

  return devices
}

// Auto-detect format and parse
export function autoParseNetworkData(text: string): (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[] {
  const results: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[] = []

  // Try all ARP parsers
  const arpParsers = [
    parseWindowsARP,
    parseLinuxARP,
    parseCiscoARP,
    parseJuniperARP,
    parseHPARP,
    parseFortiGateARP,
    parseMikrotikARP,
  ]

  for (const parser of arpParsers) {
    try {
      const parsed = parser(text)
      if (parsed.length > 0) {
        results.push(...parsed)
      }
    } catch (e) {
      // Continue to next parser
    }
  }

  // Try MAC table parsers
  try {
    results.push(...parseCiscoMAC(text))
  } catch (e) {}

  try {
    results.push(...parseArubaMAC(text))
  } catch (e) {}

  // Try enhanced DHCP parsing
  try {
    results.push(...parseEnhancedDHCPLeases(text))
  } catch (e) {}

  // If no results, try more flexible parsing
  if (results.length === 0) {
    results.push(...parseFlexibleFormat(text))
  }

  return results
}

// Flexible parser for unknown formats
export function parseFlexibleFormat(text: string): (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[] {
  const results: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[] = []
  const lines = text.split("\n")

  // Look for any line containing both IP and MAC
  const flexibleRegex =
    /(\d+\.\d+\.\d+\.\d+).*?([0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F][-:.]?[0-9a-fA-F])/

  for (const line of lines) {
    const match = line.match(flexibleRegex)
    if (match) {
      try {
        const normalizedMac = normalizeMac(match[2])
        if (normalizedMac.length === 17) {
          results.push({
            ip: match[1],
            mac: normalizedMac,
            source: "arp",
          })
        }
      } catch (e) {
        continue
      }
    }
  }

  return results
}
