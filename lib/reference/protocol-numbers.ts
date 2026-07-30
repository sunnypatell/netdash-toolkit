import type { ProtocolNumberEntry } from "./types"

// names are the iana protocol-numbers keywords; the rfc column names the current
// defining document rather than an obsoleted one. three rows were stale against
// the registry: TCP (RFC 793 -> RFC 9293), VRRP (RFC 5798 -> RFC 9568) and
// SCTP (RFC 4960 -> RFC 9260).
export const IP_PROTOCOL_NUMBERS: readonly ProtocolNumberEntry[] = [
  {
    number: 1,
    name: "ICMP",
    description: "Internet Control Message Protocol",
    rfc: "RFC 792",
  },
  {
    number: 2,
    name: "IGMP",
    description: "Internet Group Management Protocol",
    rfc: "RFC 1112",
  },
  {
    number: 4,
    name: "IPv4",
    description: "IPv4 encapsulation, IP in IP tunnelling",
    rfc: "RFC 2003",
  },
  {
    number: 6,
    name: "TCP",
    description: "Transmission Control Protocol",
    rfc: "RFC 9293",
  },
  {
    number: 17,
    name: "UDP",
    description: "User Datagram Protocol",
    rfc: "RFC 768",
  },
  {
    number: 41,
    name: "IPv6",
    description: "IPv6 encapsulation, used by 6to4 and configured tunnels",
    rfc: "RFC 2473",
  },
  {
    number: 43,
    name: "IPv6-Route",
    description: "Routing header for IPv6",
    rfc: "RFC 8200",
    ipv6ExtensionHeader: true,
  },
  {
    number: 44,
    name: "IPv6-Frag",
    description: "Fragment header for IPv6",
    rfc: "RFC 8200",
    ipv6ExtensionHeader: true,
  },
  {
    number: 47,
    name: "GRE",
    description: "Generic Routing Encapsulation",
    rfc: "RFC 2784",
  },
  {
    number: 50,
    name: "ESP",
    description: "Encapsulating Security Payload, the encrypted half of IPsec",
    rfc: "RFC 4303",
    ipv6ExtensionHeader: true,
  },
  {
    number: 51,
    name: "AH",
    description: "Authentication Header, integrity without encryption",
    rfc: "RFC 4302",
    ipv6ExtensionHeader: true,
  },
  {
    number: 58,
    name: "IPv6-ICMP",
    description: "ICMPv6, ICMP for IPv6 including neighbor discovery",
    rfc: "RFC 4443",
  },
  {
    number: 59,
    name: "IPv6-NoNxt",
    description: "No next header for IPv6, nothing follows",
    rfc: "RFC 8200",
  },
  {
    number: 60,
    name: "IPv6-Opts",
    description: "Destination options header for IPv6",
    rfc: "RFC 8200",
    ipv6ExtensionHeader: true,
  },
  {
    number: 88,
    name: "EIGRP",
    description: "Enhanced Interior Gateway Routing Protocol",
    rfc: "RFC 7868",
  },
  {
    number: 89,
    name: "OSPFIGP",
    description: "OSPF, Open Shortest Path First",
    rfc: "RFC 2328",
  },
  {
    number: 112,
    name: "VRRP",
    description: "Virtual Router Redundancy Protocol",
    rfc: "RFC 9568",
  },
  {
    number: 115,
    name: "L2TP",
    description: "Layer 2 Tunneling Protocol version 3",
    rfc: "RFC 3931",
  },
  {
    number: 132,
    name: "SCTP",
    description: "Stream Control Transmission Protocol",
    rfc: "RFC 9260",
  },
]
