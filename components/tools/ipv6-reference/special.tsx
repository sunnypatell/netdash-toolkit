"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import type { PanelProps } from "@/lib/tool-panel"

// rfc 8200 / rfc 6890 special-purpose ipv6 address registry
const SPECIAL_ADDRESSES = [
  {
    address: "::/128",
    name: "Unspecified",
    description: "No address assigned yet",
    v4: "0.0.0.0",
    source: "RFC 4291 2.5.2",
  },
  {
    address: "::1/128",
    name: "Loopback",
    description: "Localhost",
    v4: "127.0.0.1",
    source: "RFC 4291 2.5.3",
  },
  {
    address: "::ffff:0:0/96",
    name: "IPv4-Mapped",
    description: "An IPv4 address inside an IPv6 socket API",
    v4: "-",
    source: "RFC 4291 2.5.5.2",
  },
  {
    address: "::/96",
    name: "IPv4-Compatible (deprecated)",
    description: "Withdrawn transition form; do not use",
    v4: "-",
    source: "RFC 4291 2.5.5.1",
  },
  {
    address: "64:ff9b::/96",
    name: "NAT64 Well-Known Prefix",
    description: "IPv4 embedded for stateful translation",
    v4: "-",
    source: "RFC 6052",
  },
  {
    address: "100::/64",
    name: "Discard-Only",
    description: "Remotely triggered black hole next hop",
    v4: "-",
    source: "RFC 6666",
  },
  {
    address: "2001:20::/28",
    name: "ORCHIDv2",
    description: "Cryptographic host identifiers",
    v4: "-",
    source: "RFC 7343",
  },
  {
    address: "2001:db8::/32",
    name: "Documentation",
    description: "Examples and documentation only",
    v4: "192.0.2.0/24",
    source: "RFC 3849",
  },
  {
    address: "2002::/16",
    name: "6to4 (deprecated)",
    description: "Transition mechanism, formally deprecated",
    v4: "-",
    source: "RFC 7526",
  },
  {
    address: "fe80::/10",
    name: "Link-Local Unicast",
    description: "Auto-configured, never routed off the link",
    v4: "169.254.0.0/16",
    source: "RFC 4291 2.5.6",
  },
  {
    address: "fc00::/7",
    name: "Unique Local",
    description: "Private addressing, not globally routed",
    v4: "RFC 1918 ranges",
    source: "RFC 4193",
  },
]

export function IPv6SpecialAddresses({ embedded }: PanelProps) {
  return (
    <div className={embedded ? undefined : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Globe2}
          title="IPv6 Special Addresses"
          description="Special-purpose IPv6 prefixes and their IPv4 counterparts"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Special Purpose Addresses</CardTitle>
          <CardDescription>
            The IANA special-purpose IPv6 registry, with the RFC that reserved each prefix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Special-purpose IPv6 prefixes</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-2 text-left font-medium">
                    Prefix
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Name
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Description
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    IPv4 Equivalent
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody>
                {SPECIAL_ADDRESSES.map((entry) => (
                  <tr key={entry.address} className="hover:bg-muted/50 border-b">
                    <th scope="row" className="p-2 text-left font-mono font-normal">
                      {entry.address}
                    </th>
                    <td className="p-2">{entry.name}</td>
                    <td className="text-muted-foreground p-2">{entry.description}</td>
                    <td className="p-2 font-mono text-xs">{entry.v4}</td>
                    <td className="text-muted-foreground p-2 text-xs">{entry.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default IPv6SpecialAddresses
