"use client"

import { Suspense, lazy } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

const CommonCIDRs = lazy(() => import("./common"))
const AllCIDRs = lazy(() => import("./all"))

const TABS = ["common", "all"] as const

const PRIVATE_RANGES = [
  {
    cidr: "10.0.0.0/8",
    legacyClass: "Class A",
    range: "10.0.0.0 - 10.255.255.255",
    hosts: "16.7M",
  },
  {
    cidr: "172.16.0.0/12",
    legacyClass: "Class B",
    range: "172.16.0.0 - 172.31.255.255",
    hosts: "1.05M",
  },
  {
    cidr: "192.168.0.0/16",
    legacyClass: "Class C",
    range: "192.168.0.0 - 192.168.255.255",
    hosts: "65.5K",
  },
]

const SPECIAL_RANGES = [
  { cidr: "0.0.0.0/8", purpose: "This network", source: "RFC 1122" },
  { cidr: "100.64.0.0/10", purpose: "Shared address space (CGNAT)", source: "RFC 6598" },
  { cidr: "127.0.0.0/8", purpose: "Loopback", source: "RFC 1122" },
  { cidr: "169.254.0.0/16", purpose: "Link-local (APIPA)", source: "RFC 3927" },
  { cidr: "192.0.2.0/24", purpose: "Documentation (TEST-NET-1)", source: "RFC 5737" },
  { cidr: "224.0.0.0/4", purpose: "Multicast", source: "RFC 5771" },
  { cidr: "240.0.0.0/4", purpose: "Reserved, formerly class E", source: "RFC 1112" },
  { cidr: "255.255.255.255/32", purpose: "Limited broadcast", source: "RFC 919" },
]

const fallback = <p className="text-muted-foreground py-8 text-center text-sm">Loading table</p>

export function CIDRReference() {
  const [{ tab }, setQuery] = useQueryStates(
    { tab: parseAsStringLiteral(TABS).withDefault("common") },
    { history: "replace" }
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Network}
        title="CIDR Reference"
        description="Prefix, mask, wildcard and host counts for every IPv4 CIDR block"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="common">Common CIDRs</TabsTrigger>
          <TabsTrigger value="all">All CIDRs (0-32)</TabsTrigger>
        </TabsList>

        <TabsContent value="common">
          <Suspense fallback={fallback}>
            <CommonCIDRs embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="all">
          <Suspense fallback={fallback}>
            <AllCIDRs embedded />
          </Suspense>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>IPv4 Private Ranges (RFC 1918)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PRIVATE_RANGES.map((entry) => (
                <div key={entry.cidr} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Badge className="font-mono">{entry.cidr}</Badge>
                    <span className="text-muted-foreground text-sm">{entry.legacyClass}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    {entry.range} ({entry.hosts} addresses)
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Special-Purpose Ranges (RFC 6890)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SPECIAL_RANGES.map((entry) => (
                <div key={entry.cidr} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="font-mono">{entry.cidr}</Badge>
                    <span className="text-muted-foreground text-xs">{entry.source}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{entry.purpose}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CIDRReference
