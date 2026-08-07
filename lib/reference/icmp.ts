// names are the IANA icmp-parameters registry's own wording, so type 8 is "Echo", not "Echo Request"

export interface ICMPTypeEntry {
  type: number
  // iana registry name, verbatim
  name: string
  // the name engineers use when the registry wording differs
  commonName?: string
  description: string
  rfc: string
  deprecated?: boolean
}

export interface ICMPCodeEntry {
  code: number
  name: string
  rfc: string
}

export const ICMP_TYPES: readonly ICMPTypeEntry[] = [
  {
    type: 0,
    name: "Echo Reply",
    description: "Reply to an echo request; the second half of a ping",
    rfc: "RFC 792",
  },
  {
    type: 3,
    name: "Destination Unreachable",
    description: "Datagram could not be delivered; the code says why",
    rfc: "RFC 792",
  },
  {
    type: 4,
    name: "Source Quench (Deprecated)",
    description: "Obsolete congestion signal; routers must not send it and hosts must ignore it",
    rfc: "RFC 6633",
    deprecated: true,
  },
  {
    type: 5,
    name: "Redirect",
    description: "A better first hop exists for this destination",
    rfc: "RFC 792",
  },
  {
    type: 8,
    name: "Echo",
    commonName: "Echo Request",
    description: "Ping request; the registry calls it Echo, not Echo Request",
    rfc: "RFC 792",
  },
  {
    type: 9,
    name: "Router Advertisement",
    description: "Router discovery advertisement",
    rfc: "RFC 1256",
  },
  {
    type: 10,
    name: "Router Solicitation",
    description: "Router discovery solicitation",
    rfc: "RFC 1256",
  },
  {
    type: 11,
    name: "Time Exceeded",
    description: "TTL or reassembly time reached zero; this is what traceroute reads",
    rfc: "RFC 792",
  },
  {
    type: 12,
    name: "Parameter Problem",
    description: "A field in the IP header is wrong",
    rfc: "RFC 792",
  },
  {
    type: 13,
    name: "Timestamp",
    commonName: "Timestamp Request",
    description: "Round-trip time measurement request",
    rfc: "RFC 792",
  },
  {
    type: 14,
    name: "Timestamp Reply",
    description: "Reply carrying originate, receive and transmit timestamps",
    rfc: "RFC 792",
  },
  {
    type: 30,
    name: "Traceroute (Deprecated)",
    description: "Never deployed; RFC 1393 itself is now Historic",
    rfc: "RFC 6918",
    deprecated: true,
  },
  {
    type: 40,
    name: "Photuris",
    description: "Security failure notification for the Photuris key management protocol",
    rfc: "RFC 2521",
  },
  {
    type: 42,
    name: "Extended Echo Request",
    description: "Probes a target on behalf of another interface, for PROBE",
    rfc: "RFC 8335",
  },
  {
    type: 43,
    name: "Extended Echo Reply",
    description: "Reply to an extended echo request",
    rfc: "RFC 8335",
  },
]

// the registry is complete from 0 to 15; the old table skipped 8 and 11 to 15
export const ICMP_UNREACHABLE_CODES: readonly ICMPCodeEntry[] = [
  { code: 0, name: "Net Unreachable", rfc: "RFC 792" },
  { code: 1, name: "Host Unreachable", rfc: "RFC 792" },
  { code: 2, name: "Protocol Unreachable", rfc: "RFC 792" },
  { code: 3, name: "Port Unreachable", rfc: "RFC 792" },
  {
    code: 4,
    name: "Fragmentation Needed and Don't Fragment was Set",
    rfc: "RFC 792, RFC 1191",
  },
  { code: 5, name: "Source Route Failed", rfc: "RFC 792" },
  { code: 6, name: "Destination Network Unknown", rfc: "RFC 1122" },
  { code: 7, name: "Destination Host Unknown", rfc: "RFC 1122" },
  { code: 8, name: "Source Host Isolated", rfc: "RFC 1122" },
  {
    code: 9,
    name: "Communication with Destination Network is Administratively Prohibited",
    rfc: "RFC 1122",
  },
  {
    code: 10,
    name: "Communication with Destination Host is Administratively Prohibited",
    rfc: "RFC 1122",
  },
  {
    code: 11,
    name: "Destination Network Unreachable for Type of Service",
    rfc: "RFC 1122",
  },
  { code: 12, name: "Destination Host Unreachable for Type of Service", rfc: "RFC 1122" },
  { code: 13, name: "Communication Administratively Prohibited", rfc: "RFC 1812" },
  { code: 14, name: "Host Precedence Violation", rfc: "RFC 1812" },
  { code: 15, name: "Precedence cutoff in effect", rfc: "RFC 1812" },
]

// rfc 1191 s4: the router puts the next hop mtu in the low 16 bits of the field
// rfc 792 labels unused, which is what makes code 4 the carrier for pmtud
export const PMTUD_NOTE =
  "Type 3 code 4 is the only unreachable code that carries data: RFC 1191 section 4 puts the next-hop MTU in the low 16 bits of the field RFC 792 leaves unused, and that value never goes below 68. Filtering it breaks path MTU discovery."
