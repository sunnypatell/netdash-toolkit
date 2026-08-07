import type { IPv4Kind, IPv6Kind, MacFormat, MacScope } from "@/lib/random-gen"

// outside the panels so the shell can derive its url parsers without statically importing them

export const IPV4_KINDS: { id: IPv4Kind; label: string }[] = [
  { id: "any", label: "Any unicast first octet (1-223)" },
  { id: "public", label: "Public only (globally routable)" },
  { id: "private-a", label: "Private class A (10.0.0.0/8)" },
  { id: "private-b", label: "Private class B (172.16.0.0/12)" },
  { id: "private-c", label: "Private class C (192.168.0.0/16)" },
  { id: "loopback", label: "Loopback (127.0.0.0/8)" },
  { id: "link-local", label: "Link-local (169.254.0.0/16)" },
]

export const IPV6_KINDS: { id: IPv6Kind; label: string }[] = [
  { id: "global", label: "Global unicast (2000::/3, RFC 4291)" },
  { id: "ula", label: "Unique local (fd00::/8, RFC 4193)" },
  { id: "link-local", label: "Link-local (fe80::/10, RFC 4291)" },
  { id: "documentation", label: "Documentation (2001:db8::/32, RFC 3849)" },
]

export const MAC_SCOPES: { id: MacScope; label: string }[] = [
  { id: "unicast-local", label: "Unicast, locally administered (safe for testing)" },
  { id: "unicast", label: "Unicast (I/G bit clear)" },
  { id: "multicast", label: "Multicast (I/G bit set)" },
  { id: "local", label: "Locally administered (U/L bit set)" },
  { id: "universal", label: "Universally administered (U/L bit clear)" },
  { id: "any", label: "Any (both bits random)" },
]

export const MAC_FORMATS: { id: MacFormat; label: string }[] = [
  { id: "colon", label: "Colon (AA:BB:CC:DD:EE:FF)" },
  { id: "dash", label: "Dash (AA-BB-CC-DD-EE-FF)" },
  { id: "dot", label: "Cisco dotted (AABB.CCDD.EEFF)" },
  { id: "none", label: "Bare (AABBCCDDEEFF)" },
]
