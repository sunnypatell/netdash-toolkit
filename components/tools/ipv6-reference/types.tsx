"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import type { PanelProps } from "@/lib/tool-panel"

interface AddressType {
  prefix: string
  name: string
  description: string
  source: string
}

const UNICAST: AddressType[] = [
  {
    prefix: "2000::/3",
    name: "Global Unicast",
    description: "The only unicast range currently allocated for global routing.",
    source: "RFC 4291 2.5.4, RFC 3587",
  },
  {
    prefix: "fc00::/7",
    name: "Unique Local (ULA)",
    description: "Private addressing. Only fd00::/8 is defined for self-assignment.",
    source: "RFC 4193",
  },
  {
    prefix: "fe80::/10",
    name: "Link-Local",
    description: "Auto-configured, never routed. Required on every IPv6 interface.",
    source: "RFC 4291 2.5.6",
  },
  {
    prefix: "::/128",
    name: "Unspecified",
    description: "Source address before an address is assigned. Never a destination.",
    source: "RFC 4291 2.5.2",
  },
  {
    prefix: "::1/128",
    name: "Loopback",
    description: "Localhost. Never sent on a link or forwarded by a router.",
    source: "RFC 4291 2.5.3",
  },
]

const MULTICAST: AddressType[] = [
  {
    prefix: "ff00::/8",
    name: "All Multicast",
    description: "Every multicast address starts with ff. There is no IPv6 broadcast.",
    source: "RFC 4291 2.7",
  },
  {
    prefix: "ff02::1",
    name: "All Nodes (link-local scope)",
    description: "Every IPv6 node on the link. Replaces the IPv4 subnet broadcast.",
    source: "RFC 4291 2.7.1",
  },
  {
    prefix: "ff02::2",
    name: "All Routers (link-local scope)",
    description: "Every IPv6 router on the link. Target of router solicitations.",
    source: "RFC 4291 2.7.1",
  },
  {
    prefix: "ff02::1:ff00:0/104",
    name: "Solicited-Node",
    description: "Low 24 bits of the target address appended. Used by neighbour discovery.",
    source: "RFC 4291 2.7.1, RFC 4861",
  },
]

function TypeList({ entries }: { entries: AddressType[] }) {
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry.prefix} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="font-mono">{entry.prefix}</Badge>
            <span className="font-medium">{entry.name}</span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{entry.description}</p>
          <p className="text-muted-foreground mt-1 text-xs">{entry.source}</p>
        </div>
      ))}
    </div>
  )
}

export function IPv6AddressTypes({ embedded }: PanelProps) {
  return (
    <div className={embedded ? "space-y-6" : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Globe2}
          title="IPv6 Address Types"
          description="Unicast and multicast prefixes with the RFC that defines each one"
        />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Unicast and Anycast</CardTitle>
            <CardDescription>A single interface, or the nearest of a set</CardDescription>
          </CardHeader>
          <CardContent>
            <TypeList entries={UNICAST} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Multicast</CardTitle>
            <CardDescription>One to many. IPv6 has no broadcast address</CardDescription>
          </CardHeader>
          <CardContent>
            <TypeList entries={MULTICAST} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Unicast Address Structure</CardTitle>
          <CardDescription>RFC 3587 allocation model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex min-w-[600px] items-center gap-1 font-mono text-sm">
              <div className="rounded border bg-blue-100 p-2 dark:bg-blue-900">
                <p className="text-center font-bold">001</p>
                <p className="text-muted-foreground text-xs">3 bits</p>
              </div>
              <div className="flex-1 rounded border bg-green-100 p-2 dark:bg-green-900">
                <p className="text-center font-bold">Global Routing Prefix</p>
                <p className="text-muted-foreground text-center text-xs">
                  45 bits, assigned by the RIR or ISP
                </p>
              </div>
              <div className="rounded border bg-yellow-100 p-2 dark:bg-yellow-900">
                <p className="text-center font-bold">Subnet ID</p>
                <p className="text-muted-foreground text-center text-xs">16 bits</p>
              </div>
              <div className="flex-1 rounded border bg-red-100 p-2 dark:bg-red-900">
                <p className="text-center font-bold">Interface ID</p>
                <p className="text-muted-foreground text-center text-xs">64 bits</p>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            3 + 45 + 16 + 64 = 128 bits. Sites normally receive a /48 and each subnet is a /64,
            because the interface identifier is 64 bits wide for stateless autoconfiguration.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default IPv6AddressTypes
