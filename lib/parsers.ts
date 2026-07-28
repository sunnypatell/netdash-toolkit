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
  const trimmed = mac.trim().toLowerCase()

  let cleaned: string
  const groups = trimmed.split(/[:-]/)
  if (groups.length === 6 && groups.every((g) => /^[0-9a-f]{1,2}$/.test(g))) {
    // bsd/macos style can drop leading zeros (8:0:27:1a:2b:3c), so pad per octet
    cleaned = groups.map((g) => g.padStart(2, "0")).join("")
  } else {
    // covers plain, cisco dotted (0011.2233.4455) and hp 6-6 (001122-334455) forms
    cleaned = trimmed.replace(/[^0-9a-f]/g, "")
  }

  if (cleaned.length !== 12) {
    throw new Error("Invalid MAC address length")
  }

  // Insert colons every 2 characters
  return cleaned.replace(/(.{2})/g, "$1:").slice(0, -1)
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

// Legacy Linux arp -n format parser
export function parseLinuxLegacyARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  for (const line of lines) {
    if (!line || /address/i.test(line) || /hwtype/i.test(line)) {
      continue
    }

    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) {
      continue
    }

    // arp -n hwtype is alphabetic (ether); rejects fortigate's numeric age in the same slot
    if (!/^[a-z]/i.test(parts[1])) {
      continue
    }

    const ip = parts[0]
    const hwAddress = parts[2]
    const iface = parts[parts.length - 1]
    const macCandidate = hwAddress.toLowerCase()

    if (macCandidate === "(incomplete)" || macCandidate.includes("incomplete")) {
      continue
    }

    try {
      entries.push({
        ip,
        mac: normalizeMac(hwAddress),
        interface: iface,
        source: "arp",
      })
    } catch (error) {
      continue
    }
  }

  return entries
}

// Cisco ARP table parser
export function parseCiscoARP(text: string): ParsedARPEntry[] {
  const entries: ParsedARPEntry[] = []
  const lines = text.split("\n")

  // Regex for Cisco ARP format
  const arpRegex = /^Internet\s+(\d+\.\d+\.\d+\.\d+)\s+\S+\s+([0-9a-f.:-]{11,})\s+ARPA\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      const macCandidate = match[2].toLowerCase()
      if (macCandidate.includes("incomplete")) {
        continue
      }
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

  // type column is constrained to real cisco values so mac-first arp lines (juniper) can't match
  const macRegex =
    /^\s*(?:(\d+)\s+)?([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}|[0-9a-f:]{17}|[0-9a-f-]{17})\s+(dynamic|static|secure|sticky|system)\s+(.+)$/i

  for (const line of lines) {
    const match = line.match(macRegex)
    if (!match) {
      continue
    }

    const vlan = match[1]
    const macAddress = match[2]
    const type = match[3]
    const interfaceSegment = match[4].trim()

    if (!macAddress) {
      continue
    }

    const port = interfaceSegment.split(/\s|,|;/)[0]

    try {
      entries.push({
        mac: normalizeMac(macAddress),
        vlan: vlan,
        type: type.toLowerCase(),
        interface: port,
        source: "mac-table",
      })
    } catch (error) {
      continue
    }
  }

  return entries
}

// Aruba CX MAC table parser
export function parseArubaMAC(text: string): ParsedMACEntry[] {
  const entries: ParsedMACEntry[] = []
  const lines = text.split("\n")

  // aruba cx lists mac first: MAC Address | VLAN | Type | Port
  const macRegex = /^\s*([0-9a-f:]{17})\s+(\d+)\s+(dynamic|static|port-security)\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(macRegex)
    if (match) {
      try {
        entries.push({
          mac: normalizeMac(match[1]),
          vlan: match[2],
          type: match[3].toLowerCase(),
          interface: match[4],
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

  // juniper show arp lists mac first: MAC Address | Address | Name | Interface | Flags
  const arpRegex = /^([0-9a-f:]{17})\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[2],
          mac: normalizeMac(match[1]),
          interface: match[4],
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

  // procurve macs are 6-6 hyphen form; columns: IP Address | MAC Address | Type | Port
  const arpRegex = /^\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{6}-[0-9a-f]{6})\s+(\S+)(?:\s+(\S+))?/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[2]),
          type: match[3].toLowerCase(),
          interface: match[4],
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

  // fortigate: Address | Age(min) | Hardware Addr | Interface; numeric age keeps juniper lines out
  const arpRegex = /^(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+([0-9a-f:]{17})\s+(\S+)/i

  for (const line of lines) {
    const match = line.match(arpRegex)
    if (match) {
      try {
        entries.push({
          ip: match[1],
          mac: normalizeMac(match[3]),
          interface: match[4],
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

  // index, optional flag letters (D, C, ...), then ip mac and a single interface token
  const arpRegex = /^\s*\d+\s+(?:[A-Z]{1,4}\s+)?(\d+\.\d+\.\d+\.\d+)\s+([0-9A-F:]{17})\s+(\S+)\s*$/i

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
      // ip and mac live in columns 2 and 3; anything past that is optional
      if (row.length >= 4) {
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
      if (parts.length >= 4 && parts[2] && parts[3]) {
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
  // client-hostname is optional, so parse each lease block and probe fields separately
  const iscLeaseRegex = /lease\s+(\d+\.\d+\.\d+\.\d+)\s*{([^}]*)}/gi
  while ((match = iscLeaseRegex.exec(text)) !== null) {
    const body = match[2]
    const hardware = body.match(/hardware\s+ethernet\s+([0-9a-f:]{17})/i)
    if (!hardware) {
      continue
    }
    const hostname = body.match(/client-hostname\s+"([^"]+)"/i)
    try {
      entries.push({
        ip: match[1],
        mac: normalizeMac(hardware[1]),
        hostname: hostname ? hostname[1] : undefined,
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

  // split per neighbor so a block missing a field can never borrow one from the next block
  const blocks = text.split(/^-{4,}\s*$/m)

  for (const block of blocks) {
    // CDP neighbor parsing
    for (const neighbor of block.split(/(?=Device ID:)/i)) {
      const hostname = neighbor.match(/Device ID:\s*(\S+)/i)
      if (!hostname) {
        continue
      }
      const ip = neighbor.match(/IP address:\s*(\d+\.\d+\.\d+\.\d+)/i)
      const platform = neighbor.match(/Platform:\s*([^,\n]+)/i)
      devices.push({
        hostname: hostname[1],
        ip: ip ? ip[1] : undefined,
        role: platform ? platform[1].trim() : undefined,
      })
    }

    // LLDP neighbor parsing
    for (const neighbor of block.split(/(?=System Name:)/i)) {
      const hostname = neighbor.match(/System Name:\s*(\S+)/i)
      if (!hostname) {
        continue
      }
      const ip = neighbor.match(/Management Address:\s*(\d+\.\d+\.\d+\.\d+)/i)
      devices.push({
        hostname: hostname[1],
        ip: ip ? ip[1] : undefined,
      })
    }
  }

  return devices
}

// Auto-detect format and parse
export function autoParseNetworkData(
  text: string
): (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[] {
  const results: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[] = []

  // Try all ARP parsers
  const arpParsers = [
    parseWindowsARP,
    parseLinuxARP,
    parseLinuxLegacyARP,
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
export function parseFlexibleFormat(
  text: string
): (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[] {
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
