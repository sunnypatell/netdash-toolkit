"use client"

import { Suspense, lazy } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { formatCompactNumber } from "@/lib/format"
import { cidrToRange, intToIpv4 } from "@/lib/network-utils"
import { IPV4_SPECIAL_RANGES } from "@/lib/reference/ipv4-ranges"

const CommonCIDRs = lazy(() => import("./common"))
const AllCIDRs = lazy(() => import("./all"))

const TABS = ["common", "all"] as const

// both cards are views over the one ipv4 registry table in lib/reference. the
// copies that used to live here labelled the rfc 1918 blocks "Class A/B/C",
// which reference-data.test.ts now forbids outright.
const PRIVATE_RANGES = IPV4_SPECIAL_RANGES.filter((entry) => entry.rfc === "RFC 1918")
const SPECIAL_RANGES = IPV4_SPECIAL_RANGES.filter((entry) => entry.rfc !== "RFC 1918")

function addressSpan(cidr: string): string {
  const { start, end } = cidrToRange(cidr)
  return `${intToIpv4(start)} - ${intToIpv4(end)}`
}

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
                <div key={entry.range} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Badge className="font-mono">{entry.range}</Badge>
                    <span className="text-muted-foreground text-sm">{entry.type}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    {addressSpan(entry.range)} ({formatCompactNumber(entry.addresses)} addresses)
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">{entry.description}</p>
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
                <div key={entry.range} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="font-mono">{entry.range}</Badge>
                    <span className="text-muted-foreground text-xs">{entry.rfc}</span>
                  </div>
                  <p className="mt-1 text-sm">{entry.type}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{entry.description}</p>
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
