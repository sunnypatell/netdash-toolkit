import type { CommonSubnetEntry } from "./types"

// mask and host counts come from SUBNET_MASKS so the two tables cannot disagree
export const COMMON_SUBNETS: readonly CommonSubnetEntry[] = [
  { prefix: 32, name: "Single host", useCase: "Host routes, loopbacks, ACL entries" },
  { prefix: 31, name: "Point-to-point", useCase: "Router links without a wasted pair (RFC 3021)" },
  { prefix: 30, name: "Classic point-to-point", useCase: "WAN links on kit that predates /31" },
  { prefix: 29, name: "Very small LAN", useCase: "A handful of servers or appliances" },
  { prefix: 28, name: "Small LAN", useCase: "Small departments, DMZ segments" },
  { prefix: 27, name: "Medium LAN", useCase: "Meeting rooms, small teams" },
  { prefix: 26, name: "Large LAN", useCase: "Floor segments" },
  { prefix: 25, name: "Half of a /24", useCase: "Splitting a /24 between two VLANs" },
  { prefix: 24, name: "Standard segment", useCase: "The default LAN or VLAN size" },
  { prefix: 23, name: "Double /24", useCase: "Large departments, wireless pools" },
  { prefix: 22, name: "Campus block", useCase: "Campus buildings, DHCP scopes" },
  { prefix: 21, name: "Site block", useCase: "Large sites, summarised in routing" },
]
