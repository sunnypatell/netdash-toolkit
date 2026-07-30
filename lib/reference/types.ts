// row shapes for the networking reference tables. every row is verified against
// a primary source: the iana registry or the rfc named in the row itself.

export type PortProtocol = "TCP" | "UDP" | "TCP/UDP"

export interface PortEntry {
  port: number
  protocol: PortProtocol
  // the name engineers use day to day
  service: string
  // registered service name, so de facto uses are visible rather than implied
  ianaName: string
  description: string
}

export interface IPv4RangeEntry {
  range: string
  prefix: number
  type: string
  // derived from the prefix, not transcribed
  addresses: number
  rfc: string
  description: string
}

export type Routable = "Yes" | "No" | "Varies"

export interface IPv6RangeEntry {
  range: string
  name: string
  routable: Routable
  rfc: string
  description: string
}

export interface SubnetMaskEntry {
  prefix: number
  mask: string
  wildcard: string
  usableHosts: number
}

export interface ProtocolNumberEntry {
  number: number
  // iana keyword for the protocol
  name: string
  description: string
  rfc: string
  ipv6ExtensionHeader?: boolean
}

export interface CommonSubnetEntry {
  prefix: number
  name: string
  useCase: string
}
