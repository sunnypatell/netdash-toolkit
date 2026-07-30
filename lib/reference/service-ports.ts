// a categorised view over the one port table in ./ports. no row data lives
// here: port-reference needs a category filter and the range definitions, which
// the shared table has no use for, so only those are added on top.

import { COMMON_PORTS } from "./ports"
import type { PortEntry, PortProtocol } from "./types"

export type PortCategory =
  "web" | "email" | "file" | "remote" | "dns" | "database" | "infra" | "vpn" | "messaging" | "dev"

export interface CategorizedPortEntry extends PortEntry {
  category: PortCategory
}

export interface PortRangeEntry {
  start: number
  end: number
  name: string
  alias: string
  assignment: string
}

// rfc 6335 s6: system/user/dynamic are the primary names, the well-known /
// registered / private trio are the legacy aliases
export const PORT_RANGES: readonly PortRangeEntry[] = [
  {
    start: 0,
    end: 1023,
    name: "System Ports",
    alias: "Well Known Ports",
    assignment: "Assigned by IANA via IETF Review or IESG Approval. Binding needs root/admin.",
  },
  {
    start: 1024,
    end: 49151,
    name: "User Ports",
    alias: "Registered Ports",
    assignment: "Assigned by IANA via IETF Review or Expert Review. Any process may bind.",
  },
  {
    start: 49152,
    end: 65535,
    name: "Dynamic Ports",
    alias: "Private or Ephemeral Ports",
    assignment: "Never assigned by IANA. Used for the client side of connections.",
  },
]

export const PORT_CATEGORY_LABELS: Readonly<Record<PortCategory, string>> = {
  web: "Web",
  email: "Email",
  file: "File Transfer",
  remote: "Remote Access",
  dns: "DNS",
  database: "Database",
  infra: "Infrastructure",
  vpn: "VPN",
  messaging: "Messaging",
  dev: "Dev and Containers",
}

const CATEGORY_BY_PORT: Readonly<Record<number, PortCategory>> = {
  80: "web",
  443: "web",
  8080: "web",
  8443: "web",
  25: "email",
  110: "email",
  143: "email",
  465: "email",
  587: "email",
  993: "email",
  995: "email",
  20: "file",
  21: "file",
  22: "file",
  69: "file",
  139: "file",
  445: "file",
  873: "file",
  23: "remote",
  3389: "remote",
  5900: "remote",
  53: "dns",
  853: "dns",
  1433: "database",
  1521: "database",
  3306: "database",
  5432: "database",
  6379: "database",
  27017: "database",
  67: "infra",
  68: "infra",
  123: "infra",
  137: "infra",
  138: "infra",
  161: "infra",
  162: "infra",
  389: "infra",
  514: "infra",
  636: "infra",
  500: "vpn",
  1194: "vpn",
  1701: "vpn",
  1723: "vpn",
  4500: "vpn",
  51820: "vpn",
  119: "messaging",
  1883: "messaging",
  5222: "messaging",
  5269: "messaging",
  8883: "messaging",
  2375: "dev",
  2376: "dev",
  3000: "dev",
  6443: "dev",
  9090: "dev",
}

export const CATEGORIZED_PORTS: readonly CategorizedPortEntry[] = COMMON_PORTS.map((entry) => ({
  ...entry,
  category: CATEGORY_BY_PORT[entry.port] ?? "infra",
})).sort((a, b) => a.port - b.port)

export function rangeOf(port: number): PortRangeEntry | undefined {
  return PORT_RANGES.find((range) => port >= range.start && port <= range.end)
}

export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 0 && port <= 65535
}

export function transportsOf(protocol: PortProtocol): readonly ("TCP" | "UDP")[] {
  return protocol === "TCP/UDP" ? ["TCP", "UDP"] : [protocol]
}
