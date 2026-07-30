// MTU and MSS arithmetic. Every byte count below is decomposed and cited,
// because a flat "overhead" number hides which layer and which cipher it assumed.

export type IPVersion = "ipv4" | "ipv6"
export type Transport = "tcp" | "udp" | "none"

// rfc 791 s3.1 (IHL min 5 words) and rfc 8200 s3
export const IPV4_HEADER = 20
export const IPV6_HEADER = 40
// rfc 9293 s3.1 (Data Offset min 5 words) and rfc 768
export const TCP_HEADER = 20
export const UDP_HEADER = 8

// rfc 8200 s5: "IPv6 requires that every link in the Internet have an MTU of
// 1280 octets or greater"
export const IPV6_MIN_LINK_MTU = 1280
// rfc 791 s3.2: 60-octet max header + 8-octet min fragment
export const IPV4_MIN_MTU = 68
// rfc 791 s3.2 / rfc 1122 s3.3.2: the datagram size every host must reassemble
export const IPV4_MIN_REASSEMBLY = 576

// rfc 9293 s3.7.1 defaults
export const DEFAULT_MSS_IPV4 = 536
export const DEFAULT_MSS_IPV6 = 1220

export interface Encapsulation {
  id: string
  label: string
  bytes: number
  detail: string
}

// each figure is the reduction in the inner IP MTU for a given outer layer-3
// MTU, which is what an operator sets on a tunnel interface
export const ENCAPSULATIONS: readonly Encapsulation[] = [
  {
    id: "dot1q",
    label: "802.1Q VLAN tag",
    bytes: 4,
    detail:
      "2-byte TPID plus 2-byte TCI (IEEE 802.1Q clause 9.6). Only costs MTU on gear that cannot carry the 1522-byte baby-giant frame.",
  },
  {
    id: "qinq",
    label: "802.1ad QinQ double tag",
    bytes: 8,
    detail: "S-TAG plus C-TAG, 4 bytes each (IEEE 802.1Q, formerly 802.1ad).",
  },
  {
    id: "pppoe",
    label: "PPPoE",
    bytes: 8,
    detail:
      "6-byte PPPoE header plus 2-byte PPP protocol id (RFC 2516 section 7), which is why DSL links run a 1492 MTU.",
  },
  {
    id: "gre",
    label: "GRE over IPv4",
    bytes: 24,
    detail:
      "20-byte delivery IPv4 header plus the 4-byte GRE header (RFC 2784 section 2.1). Add 4 per optional key or sequence field (RFC 2890), and use 44 for an IPv6 delivery header.",
  },
  {
    id: "vxlan",
    label: "VXLAN over IPv4",
    bytes: 50,
    detail:
      "20 outer IPv4 + 8 outer UDP + 8 VXLAN + 14 inner Ethernet (RFC 7348 section 5). Assumes an IPv4 outer with no outer VLAN tag; an IPv6 outer costs 70.",
  },
  {
    id: "esp-gcm",
    label: "IPsec ESP tunnel, AES-GCM",
    bytes: 57,
    detail:
      "20 outer IPv4 + 8 ESP header + 8 IV (RFC 4106 section 3) + 2 ESP trailer + 16 ICV (RFC 4106 section 6) + up to 3 padding. Worst case shown.",
  },
  {
    id: "esp-cbc",
    label: "IPsec ESP tunnel, AES-CBC with HMAC-SHA1-96",
    bytes: 73,
    detail:
      "20 outer IPv4 + 8 ESP header + 16 IV (RFC 3602 section 3) + 2 ESP trailer + 12 ICV + up to 15 padding to the 16-byte block (RFC 4303 section 2.3). Worst case shown.",
  },
  {
    id: "nat-t",
    label: "IPsec NAT-T UDP encapsulation",
    bytes: 8,
    detail: "8-byte UDP header wrapping ESP for NAT traversal (RFC 3948).",
  },
  {
    id: "mpls",
    label: "MPLS label",
    bytes: 4,
    detail: "One 4-byte label stack entry (RFC 3032 section 2.1). Add 4 per additional label.",
  },
]

export function encapsulationById(id: string): Encapsulation | undefined {
  return ENCAPSULATIONS.find((option) => option.id === id)
}

export interface MTUBreakdownRow {
  label: string
  bytes: number
}

export interface MTUResult {
  linkMTU: number
  encapsulationOverhead: number
  // what the inner ip layer sees; this is the number the rfc minimums apply to
  effectiveMTU: number
  ipHeader: number
  transportHeader: number
  payloadBytes: number
  // tcp mss for the same path, regardless of the transport selected above
  tcpMSS: number
  defaultMSS: number
  breakdown: MTUBreakdownRow[]
  errors: string[]
  warnings: string[]
}

export function ipHeaderSize(version: IPVersion): number {
  return version === "ipv4" ? IPV4_HEADER : IPV6_HEADER
}

export function transportHeaderSize(transport: Transport): number {
  if (transport === "tcp") return TCP_HEADER
  if (transport === "udp") return UDP_HEADER
  return 0
}

export function calculateMTU(
  linkMTU: number,
  version: IPVersion,
  transport: Transport,
  encapsulationIds: readonly string[]
): MTUResult {
  const selected = encapsulationIds
    .map(encapsulationById)
    .filter((option): option is Encapsulation => option !== undefined)

  const encapsulationOverhead = selected.reduce((sum, option) => sum + option.bytes, 0)
  const effectiveMTU = linkMTU - encapsulationOverhead
  const ipHeader = ipHeaderSize(version)
  const transportHeader = transportHeaderSize(transport)

  const errors: string[] = []
  const warnings: string[] = []

  // the rfc floors are link mtu figures, so they are compared against the mtu
  // the inner ip layer sees, not against the payload left after tcp or udp
  if (version === "ipv6" && effectiveMTU < IPV6_MIN_LINK_MTU) {
    errors.push(
      `Effective MTU ${effectiveMTU} is below the ${IPV6_MIN_LINK_MTU}-byte IPv6 minimum link MTU (RFC 8200 section 5). The link needs fragmentation below IPv6, or less encapsulation.`
    )
  }
  if (version === "ipv4" && effectiveMTU < IPV4_MIN_MTU) {
    errors.push(
      `Effective MTU ${effectiveMTU} is below the ${IPV4_MIN_MTU}-byte minimum every IPv4 router must forward (RFC 791 section 3.2).`
    )
  }
  if (version === "ipv4" && effectiveMTU >= IPV4_MIN_MTU && effectiveMTU < IPV4_MIN_REASSEMBLY) {
    warnings.push(
      `Effective MTU ${effectiveMTU} is below the ${IPV4_MIN_REASSEMBLY}-byte datagram every IPv4 host must be able to reassemble (RFC 791 section 3.2, RFC 1122 section 3.3.2).`
    )
  }
  if (effectiveMTU - ipHeader - transportHeader <= 0) {
    errors.push("Encapsulation and headers leave no room for payload.")
  }

  return {
    linkMTU,
    encapsulationOverhead,
    effectiveMTU,
    ipHeader,
    transportHeader,
    payloadBytes: effectiveMTU - ipHeader - transportHeader,
    // rfc 9293 s3.7.1: mss ignores options, so fixed ip + fixed tcp headers
    tcpMSS: effectiveMTU - ipHeader - TCP_HEADER,
    defaultMSS: version === "ipv4" ? DEFAULT_MSS_IPV4 : DEFAULT_MSS_IPV6,
    breakdown: [
      ...selected.map((option) => ({ label: option.label, bytes: option.bytes })),
      { label: version === "ipv4" ? "IPv4 header" : "IPv6 header", bytes: ipHeader },
      ...(transportHeader > 0
        ? [{ label: transport === "tcp" ? "TCP header" : "UDP header", bytes: transportHeader }]
        : []),
    ],
    errors,
    warnings,
  }
}
