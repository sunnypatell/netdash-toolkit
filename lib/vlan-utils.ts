// VLAN management utilities and switch configuration generators

import { cidrToRange, expandIPv6, isValidCIDR, isValidIPv4, isValidIPv6 } from "./network-utils"

export interface VLAN {
  id: number
  name: string
  purpose?: string
  subnets: string[]
  description?: string
}

export interface SwitchPort {
  name: string
  description?: string
  mode: "access" | "trunk"
  accessVlan?: number
  allowedVlans?: string
  nativeVlan?: number
}

export interface VLANValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ConfigTemplate {
  vendor: "cisco-ios" | "aruba-cx"
  type: "access" | "trunk"
  config: string
}

// VLAN ID validation
export function isValidVLANId(id: number): boolean {
  return id >= 1 && id <= 4094
}

// Check for reserved VLAN IDs
export function isReservedVLAN(id: number, reservedList: number[] = [1, 1002, 1003, 1004, 1005]): boolean {
  return reservedList.includes(id)
}

// Validate VLAN configuration
export function validateVLAN(vlan: VLAN, existingVLANs: VLAN[] = []): VLANValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate VLAN ID
  if (!isValidVLANId(vlan.id)) {
    errors.push(`VLAN ID ${vlan.id} is invalid (must be 1-4094)`)
  }

  // Check for reserved VLANs
  if (isReservedVLAN(vlan.id)) {
    warnings.push(`VLAN ${vlan.id} is reserved (default or legacy VLAN)`)
  }

  // Check for duplicate VLAN IDs
  const duplicate = existingVLANs.find((v) => v.id === vlan.id)
  if (duplicate) {
    errors.push(`VLAN ID ${vlan.id} already exists (${duplicate.name})`)
  }

  // Validate VLAN name
  if (!vlan.name || vlan.name.trim().length === 0) {
    errors.push("VLAN name is required")
  } else if (vlan.name.length > 32) {
    warnings.push("VLAN name should be 32 characters or less")
  }

  // Validate subnets
  for (const subnet of vlan.subnets) {
    if (!isValidCIDR(subnet)) {
      errors.push(`Invalid subnet format: ${subnet}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// Check for overlapping subnets across VLANs
const MAX_IPV6 = (1n << 128n) - 1n

const ipv6ToBigInt = (ip: string): bigint => {
  const expanded = expandIPv6(ip)
  return expanded.split(":").reduce<bigint>((acc, part) => {
    const value = BigInt(`0x${part}`)
    return (acc << 16n) + value
  }, 0n)
}

const ipv6CidrRange = (cidr: string): { start: bigint; end: bigint } => {
  const [ip, prefixStr] = cidr.split("/")
  const prefix = Number.parseInt(prefixStr ?? "", 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 128) {
    throw new Error("Invalid IPv6 prefix length")
  }

  const base = ipv6ToBigInt(ip)
  const hostBits = BigInt(128 - prefix)
  const hostMask = hostBits === 0n ? 0n : (1n << hostBits) - 1n
  const network = base & (MAX_IPV6 ^ hostMask)
  const end = network + hostMask

  return { start: network, end }
}

const rangesOverlap = <T extends number | bigint>(aStart: T, aEnd: T, bStart: T, bEnd: T): boolean => {
  return aStart <= bEnd && bStart <= aEnd
}

export function checkSubnetOverlaps(vlans: VLAN[]): Array<{ vlan1: VLAN; vlan2: VLAN; subnet: string }> {
  const overlaps: Array<{ vlan1: VLAN; vlan2: VLAN; subnet: string }> = []

  for (let i = 0; i < vlans.length; i++) {
    for (let j = i + 1; j < vlans.length; j++) {
      const vlan1 = vlans[i]
      const vlan2 = vlans[j]

      for (const subnet1 of vlan1.subnets) {
        for (const subnet2 of vlan2.subnets) {
          if (!subnet1 || !subnet2) continue

          if (subnet1 === subnet2) {
            overlaps.push({ vlan1, vlan2, subnet: subnet1 })
            continue
          }

          if (isValidCIDR(subnet1) && isValidCIDR(subnet2)) {
            const [ip1] = subnet1.split("/")
            const [ip2] = subnet2.split("/")

            try {
              if (isValidIPv4(ip1) && isValidIPv4(ip2)) {
                const range1 = cidrToRange(subnet1)
                const range2 = cidrToRange(subnet2)

                if (rangesOverlap(range1.start, range1.end, range2.start, range2.end)) {
                  overlaps.push({ vlan1, vlan2, subnet: `${subnet1} ↔ ${subnet2}` })
                }
              } else if (isValidIPv6(ip1) && isValidIPv6(ip2)) {
                const range1 = ipv6CidrRange(subnet1)
                const range2 = ipv6CidrRange(subnet2)

                if (rangesOverlap(range1.start, range1.end, range2.start, range2.end)) {
                  overlaps.push({ vlan1, vlan2, subnet: `${subnet1} ↔ ${subnet2}` })
                }
              }
            } catch {
              // Ignore invalid CIDR conversions and fall back to string comparison
            }
          }
        }
      }
    }
  }

  return overlaps
}

// Parse VLAN list string (e.g., "10,20,30-35,100")
export function parseVLANList(vlanString: string): number[] {
  const vlans: number[] = []
  const parts = vlanString.split(",").map((s) => s.trim())

  for (const part of parts) {
    if (part.includes("-")) {
      // Range (e.g., "30-35")
      const [start, end] = part.split("-").map((s) => Number.parseInt(s.trim()))
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          if (isValidVLANId(i)) {
            vlans.push(i)
          }
        }
      }
    } else {
      // Single VLAN
      const vlanId = Number.parseInt(part)
      if (!isNaN(vlanId) && isValidVLANId(vlanId)) {
        vlans.push(vlanId)
      }
    }
  }

  return [...new Set(vlans)].sort((a, b) => a - b)
}

// Generate Cisco IOS access port configuration
export function generateCiscoAccessConfig(port: SwitchPort): string {
  if (port.mode !== "access" || !port.accessVlan) {
    throw new Error("Access port must have access VLAN specified")
  }

  let config = `interface ${port.name}\n`
  if (port.description) {
    config += ` description ${port.description}\n`
  }
  config += ` switchport mode access\n`
  config += ` switchport access vlan ${port.accessVlan}\n`
  config += ` spanning-tree portfast\n`
  config += ` no shutdown\n`

  return config
}

// Generate Cisco IOS trunk port configuration
export function generateCiscoTrunkConfig(port: SwitchPort): string {
  if (port.mode !== "trunk") {
    throw new Error("Port must be configured as trunk")
  }

  let config = `interface ${port.name}\n`
  if (port.description) {
    config += ` description ${port.description}\n`
  }
  config += ` switchport trunk encapsulation dot1q\n`
  config += ` switchport mode trunk\n`

  if (port.nativeVlan) {
    config += ` switchport trunk native vlan ${port.nativeVlan}\n`
  }

  if (port.allowedVlans) {
    config += ` switchport trunk allowed vlan ${port.allowedVlans}\n`
  }

  config += ` no shutdown\n`

  return config
}

// Generate Aruba CX access port configuration
export function generateArubaAccessConfig(port: SwitchPort): string {
  if (port.mode !== "access" || !port.accessVlan) {
    throw new Error("Access port must have access VLAN specified")
  }

  let config = `interface ${port.name}\n`
  if (port.description) {
    config += ` description ${port.description}\n`
  }
  config += ` no shutdown\n`
  config += ` vlan access ${port.accessVlan}\n`

  return config
}

// Generate Aruba CX trunk port configuration
export function generateArubaTrunkConfig(port: SwitchPort): string {
  if (port.mode !== "trunk") {
    throw new Error("Port must be configured as trunk")
  }

  let config = `interface ${port.name}\n`
  if (port.description) {
    config += ` description ${port.description}\n`
  }
  config += ` no shutdown\n`

  if (port.nativeVlan) {
    config += ` vlan trunk native ${port.nativeVlan}\n`
  }

  if (port.allowedVlans) {
    config += ` vlan trunk allowed ${port.allowedVlans}\n`
  }

  return config
}

// Generate switch configuration for multiple ports
export function generateSwitchConfig(
  ports: SwitchPort[],
  vendor: "cisco-ios" | "aruba-cx",
  includeGlobalVlans = true,
  vlans: VLAN[] = [],
): string {
  let config = ""

  // Add global VLAN configuration if requested
  if (includeGlobalVlans && vlans.length > 0) {
    if (vendor === "cisco-ios") {
      config += "! VLAN Configuration\n"
      for (const vlan of vlans) {
        config += `vlan ${vlan.id}\n`
        config += ` name ${vlan.name}\n`
        if (vlan.description) {
          config += ` description ${vlan.description}\n`
        }
        config += "!\n"
      }
      config += "\n"
    } else {
      config += "! VLAN Configuration\n"
      for (const vlan of vlans) {
        config += `vlan ${vlan.id}\n`
        config += ` name ${vlan.name}\n`
        if (vlan.description) {
          config += ` description ${vlan.description}\n`
        }
      }
      config += "\n"
    }
  }

  // Add interface configurations
  config += "! Interface Configuration\n"
  for (const port of ports) {
    try {
      if (vendor === "cisco-ios") {
        if (port.mode === "access") {
          config += generateCiscoAccessConfig(port)
        } else {
          config += generateCiscoTrunkConfig(port)
        }
      } else {
        if (port.mode === "access") {
          config += generateArubaAccessConfig(port)
        } else {
          config += generateArubaTrunkConfig(port)
        }
      }
      config += "!\n"
    } catch (error) {
      config += `! Error configuring ${port.name}: ${error instanceof Error ? error.message : "Unknown error"}\n!\n`
    }
  }

  return config
}

// Validate trunk configuration
export function validateTrunkConfig(port: SwitchPort, vlans: VLAN[]): VLANValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (port.mode !== "trunk") {
    return { isValid: true, errors, warnings }
  }

  // Check native VLAN exists
  if (port.nativeVlan) {
    const nativeVlanExists = vlans.some((v) => v.id === port.nativeVlan)
    if (!nativeVlanExists) {
      errors.push(`Native VLAN ${port.nativeVlan} does not exist`)
    }
  }

  // Parse and validate allowed VLANs
  if (port.allowedVlans) {
    try {
      const allowedVlanIds = parseVLANList(port.allowedVlans)
      for (const vlanId of allowedVlanIds) {
        const vlanExists = vlans.some((v) => v.id === vlanId)
        if (!vlanExists) {
          warnings.push(`Allowed VLAN ${vlanId} does not exist in VLAN database`)
        }
      }
    } catch (error) {
      errors.push(`Invalid allowed VLANs format: ${port.allowedVlans}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// Export VLAN database to CSV
export function exportVLANsToCSV(vlans: VLAN[]): string {
  const headers = ["VLAN ID", "Name", "Purpose", "Subnets", "Description"]
  const rows = vlans.map((vlan) => [
    vlan.id.toString(),
    vlan.name,
    vlan.purpose || "",
    vlan.subnets.join("; "),
    vlan.description || "",
  ])

  return [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")
}
