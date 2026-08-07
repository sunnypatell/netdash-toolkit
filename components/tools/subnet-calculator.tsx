"use client"

import { useMemo } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calculator, Download, Info } from "lucide-react"
import { IPInput } from "@/components/ui/ip-input"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { ResultCard } from "@/components/ui/result-card"
import { ToolHeader } from "@/components/ui/tool-header"
import { downloadTextFile, dateStamp } from "@/lib/download"
import {
  calculateIPv4Subnet,
  calculateIPv6Subnet,
  isValidIPv4,
  isValidIPv6,
} from "@/lib/network-utils"
import type { IPv4Result, IPv6Result } from "@/lib/network-utils"

// which field an error names, derived from the compute's guard order rather than the message text
type Culprit = "address" | "prefix" | "both" | null

function computeIPv4(address: string, prefixText: string) {
  if (!address.trim()) return { result: null, error: "", culprit: null as Culprit }
  if (!isValidIPv4(address)) {
    return { result: null, error: "Invalid IPv4 address", culprit: "address" as Culprit }
  }
  const prefix = Number.parseInt(prefixText, 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    return { result: null, error: "Invalid prefix length", culprit: "prefix" as Culprit }
  }
  try {
    return { result: calculateIPv4Subnet(address, prefix), error: "", culprit: null as Culprit }
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : "Calculation failed",
      culprit: "both" as Culprit,
    }
  }
}

function computeIPv6(address: string, prefixText: string) {
  if (!address.trim()) return { result: null, error: "", culprit: null as Culprit }
  if (!isValidIPv6(address)) {
    return { result: null, error: "Invalid IPv6 address", culprit: "address" as Culprit }
  }
  const prefix = Number.parseInt(prefixText, 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 128) {
    return { result: null, error: "Invalid prefix length", culprit: "prefix" as Culprit }
  }
  try {
    return { result: calculateIPv6Subnet(address, prefix), error: "", culprit: null as Culprit }
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : "Calculation failed",
      culprit: "both" as Culprit,
    }
  }
}

export function SubnetCalculator() {
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(["ipv4", "ipv6"] as const).withDefault("ipv4"),
      ip: parseAsString.withDefault("192.168.1.1"),
      prefix: parseAsString.withDefault("24"),
      ip6: parseAsString.withDefault("2001:db8::1"),
      prefix6: parseAsString.withDefault("64"),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const { tab, ip: ipv4Address, prefix: ipv4Prefix, ip6: ipv6Address, prefix6: ipv6Prefix } = query

  const setIpv4Address = (value: string) => void setQuery({ ip: value })
  const setIpv4Prefix = (value: string) => void setQuery({ prefix: value })
  const setIpv6Address = (value: string) => void setQuery({ ip6: value })
  const setIpv6Prefix = (value: string) => void setQuery({ prefix6: value })

  const ipv4 = useMemo(() => computeIPv4(ipv4Address, ipv4Prefix), [ipv4Address, ipv4Prefix])
  const ipv6 = useMemo(() => computeIPv6(ipv6Address, ipv6Prefix), [ipv6Address, ipv6Prefix])

  const ipv4Results = tab === "ipv4" ? ipv4.result : null
  const ipv6Results = tab === "ipv6" ? ipv6.result : null
  const error = tab === "ipv4" ? ipv4.error : ipv6.error
  const culprit = tab === "ipv4" ? ipv4.culprit : ipv6.culprit
  const addressAtFault = culprit === "address" || culprit === "both"
  const prefixAtFault = culprit === "prefix" || culprit === "both"
  const ERROR_ID = "subnet-calculator-error"

  const exportResults = (format: "json" | "csv") => {
    const results = ipv4Results || ipv6Results
    if (!results) return

    const filename = `subnet-calculation-${dateStamp()}.${format}`

    if (format === "json") {
      downloadTextFile(JSON.stringify(results, null, 2), filename, "application/json")
      return
    }

    const entries = Object.entries(results)
    const csv = "Property,Value\n" + entries.map(([key, value]) => `${key},${value}`).join("\n")
    downloadTextFile(csv, filename, "text/csv")
  }

  const getIPv4Badges = (result: IPv4Result) => {
    const badges = []
    if (result.isPrivate) badges.push({ label: "Private", variant: "secondary" as const })
    if (result.isLoopback) badges.push({ label: "Loopback", variant: "outline" as const })
    if (result.isLinkLocal) badges.push({ label: "Link-Local", variant: "outline" as const })
    if (result.isMulticast) badges.push({ label: "Multicast", variant: "destructive" as const })
    return badges
  }

  const getIPv6Badges = (result: IPv6Result) => {
    const badges = []
    if (result.isPrivate) badges.push({ label: "Private", variant: "secondary" as const })
    if (result.isLoopback) badges.push({ label: "Loopback", variant: "outline" as const })
    if (result.isLinkLocal) badges.push({ label: "Link-Local", variant: "outline" as const })
    if (result.isMulticast) badges.push({ label: "Multicast", variant: "destructive" as const })
    return badges
  }

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const input = data.input as { address: string; prefix: string } | undefined
    const version = data.version as string | undefined

    // only inputs are restored; results recompute, so a saved item can never show a stale figure
    if (!input) return
    if (version === "ipv4") {
      void setQuery({ tab: "ipv4", ip: input.address, prefix: input.prefix })
    } else if (version === "ipv6") {
      void setQuery({ tab: "ipv6", ip6: input.address, prefix6: input.prefix })
    }
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Calculator}
        title="Subnet Calculator"
        description="Calculate network parameters for IPv4 and IPv6 subnets"
        actions={
          <>
            <LoadFromProject itemType="subnet" onLoad={handleLoadFromProject} size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportResults("csv")}
              disabled={!ipv4Results && !ipv6Results}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportResults("json")}
              disabled={!ipv4Results && !ipv6Results}
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            {(ipv4Results || ipv6Results) && (
              <SaveToProject
                itemType="subnet"
                itemName={
                  ipv4Results
                    ? `${ipv4Results.cidr}`
                    : `${ipv6Results?.compressed}/${ipv6Results?.prefix}`
                }
                itemData={{
                  version: ipv4Results ? "ipv4" : "ipv6",
                  input: ipv4Results
                    ? { address: ipv4Address, prefix: ipv4Prefix }
                    : { address: ipv6Address, prefix: ipv6Prefix },
                  results: ipv4Results || ipv6Results,
                }}
                toolSource="Subnet Calculator"
                size="sm"
              />
            )}
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription id={ERROR_ID}>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setQuery({ tab: v as "ipv4" | "ipv6" })}
        className="space-y-4 sm:space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ipv4" className="text-sm">
            IPv4 Calculator
          </TabsTrigger>
          <TabsTrigger value="ipv6" className="text-sm">
            IPv6 Calculator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ipv4" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">IPv4 Subnet Calculation</CardTitle>
              <CardDescription className="text-sm">
                Enter an IPv4 address and prefix length to calculate all subnet parameters including
                network, broadcast, and host ranges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <IPInput
                  label="IP Address"
                  placeholder="192.168.1.1"
                  value={ipv4Address}
                  onChange={setIpv4Address}
                  ipVersion="ipv4"
                  invalid={addressAtFault}
                  describedBy={addressAtFault ? ERROR_ID : undefined}
                />
                <IPInput
                  label="Prefix Length"
                  placeholder="24"
                  value={ipv4Prefix}
                  onChange={setIpv4Prefix}
                  ipVersion="ipv4"
                  invalid={prefixAtFault}
                  describedBy={prefixAtFault ? ERROR_ID : undefined}
                />
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Special Cases:</strong> /31 networks have 2 usable addresses (RFC 3021),
                  /32 networks have 1 host, and /30 networks have 2 usable hosts.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {!ipv4Results && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Enter an IPv4 address and prefix length - network, broadcast and host range appear
              here.
            </p>
          )}

          {ipv4Results && (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
              <ResultCard
                title="Network Information"
                results={{
                  network: ipv4Results.network,
                  broadcast: ipv4Results.broadcast,
                  cidr: ipv4Results.cidr,
                  netmask: ipv4Results.netmask,
                  wildcardMask: ipv4Results.wildcardMask,
                }}
                badges={getIPv4Badges(ipv4Results)}
              />

              <ResultCard
                title="Host Information"
                results={{
                  firstHost: ipv4Results.firstHost,
                  lastHost: ipv4Results.lastHost,
                  hostCount: ipv4Results.hostCount,
                  usableHosts: ipv4Results.hostCount,
                }}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">IPv4 Reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Private Address Ranges</h4>
                  <div className="space-y-1 font-mono text-xs sm:text-sm">
                    <div>10.0.0.0/8 (Class A)</div>
                    <div>172.16.0.0/12 (Class B)</div>
                    <div>192.168.0.0/16 (Class C)</div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Special Addresses</h4>
                  <div className="space-y-1 font-mono text-xs sm:text-sm">
                    <div>127.0.0.0/8 (Loopback)</div>
                    <div>169.254.0.0/16 (Link-Local)</div>
                    <div>224.0.0.0/4 (Multicast)</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ipv6" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">IPv6 Subnet Calculation</CardTitle>
              <CardDescription className="text-sm">
                Enter an IPv6 address and prefix length to calculate network parameters,
                compression, and special addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <IPInput
                  label="IPv6 Address"
                  placeholder="2001:db8::1"
                  value={ipv6Address}
                  onChange={setIpv6Address}
                  ipVersion="ipv6"
                  invalid={addressAtFault}
                  describedBy={addressAtFault ? ERROR_ID : undefined}
                />
                <IPInput
                  label="Prefix Length"
                  placeholder="64"
                  value={ipv6Prefix}
                  onChange={setIpv6Prefix}
                  ipVersion="ipv6"
                  invalid={prefixAtFault}
                  describedBy={prefixAtFault ? ERROR_ID : undefined}
                />
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>IPv6 Features:</strong> Automatic address compression per RFC 5952,
                  solicited-node multicast calculation, and EUI-64 interface identifier support.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {!ipv6Results && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Enter an IPv6 address and prefix length - network, compressed form and host bits
              appear here.
            </p>
          )}

          {ipv6Results && (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
              <ResultCard
                title="Address Information"
                results={{
                  network: ipv6Results.network,
                  compressed: ipv6Results.compressed,
                  expanded: ipv6Results.expanded,
                  prefix: `/${ipv6Results.prefix}`,
                }}
                badges={getIPv6Badges(ipv6Results)}
              />

              <ResultCard
                title="Network Details"
                results={{
                  hostBits: ipv6Results.hostBits,
                  ...(ipv6Results.solicitedNode && { solicitedNode: ipv6Results.solicitedNode }),
                }}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">IPv6 Reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Special Addresses</h4>
                  <div className="space-y-1 font-mono text-xs sm:text-sm">
                    <div>::1/128 (Loopback)</div>
                    <div>fe80::/10 (Link-Local)</div>
                    <div>fc00::/7 (Unique Local)</div>
                    <div>ff00::/8 (Multicast)</div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Common Prefixes</h4>
                  <div className="space-y-1 font-mono text-xs sm:text-sm">
                    <div>/48 (Site prefix)</div>
                    <div>/64 (Subnet prefix)</div>
                    <div>/128 (Host address)</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calculation Examples</CardTitle>
          <CardDescription className="text-sm">
            Test cases to verify subnet calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold">IPv4 Test Cases</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm"
                  onClick={() => {
                    setIpv4Address("10.0.0.1")
                    setIpv4Prefix("24")
                  }}
                >
                  10.0.0.1/24 (Standard /24)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm"
                  onClick={() => {
                    setIpv4Address("192.0.2.10")
                    setIpv4Prefix("31")
                  }}
                >
                  192.0.2.10/31 (RFC 3021)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm"
                  onClick={() => {
                    setIpv4Address("203.0.113.1")
                    setIpv4Prefix("32")
                  }}
                >
                  203.0.113.1/32 (Host route)
                </Button>
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">IPv6 Test Cases</h4>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm"
                  onClick={() => {
                    setIpv6Address("2001:db8::1")
                    setIpv6Prefix("64")
                  }}
                >
                  2001:db8::1/64 (Standard)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm"
                  onClick={() => {
                    setIpv6Address("2001:0db8:0000:0000:0000:0000:0000:0001")
                    setIpv6Prefix("48")
                  }}
                >
                  <span className="truncate">Expanded form /48</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs sm:text-sm"
                  onClick={() => {
                    setIpv6Address("fe80::1")
                    setIpv6Prefix("64")
                  }}
                >
                  fe80::1/64 (Link-Local)
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
