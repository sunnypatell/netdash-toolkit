"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calculator, Download, Info } from "lucide-react"
import { IPInput } from "@/components/ui/ip-input"
import { SaveToProject } from "@/components/ui/save-to-project"
import { ResultCard } from "@/components/ui/result-card"
import {
  calculateIPv4Subnet,
  calculateIPv6Subnet,
  isValidIPv4,
  isValidIPv6,
} from "@/lib/network-utils"
import type { IPv4Result, IPv6Result } from "@/lib/network-utils"

export function SubnetCalculator() {
  const [ipv4Address, setIpv4Address] = useState("192.168.1.1")
  const [ipv4Prefix, setIpv4Prefix] = useState("24")
  const [ipv6Address, setIpv6Address] = useState("2001:db8::1")
  const [ipv6Prefix, setIpv6Prefix] = useState("64")
  const [ipv4Results, setIpv4Results] = useState<IPv4Result | null>(null)
  const [ipv6Results, setIpv6Results] = useState<IPv6Result | null>(null)
  const [error, setError] = useState<string>("")

  const calculateIPv4 = () => {
    setError("")
    try {
      if (!isValidIPv4(ipv4Address)) {
        throw new Error("Invalid IPv4 address")
      }

      const prefix = Number.parseInt(ipv4Prefix)
      if (isNaN(prefix) || prefix < 0 || prefix > 32) {
        throw new Error("Invalid prefix length (must be 0-32)")
      }

      const result = calculateIPv4Subnet(ipv4Address, prefix)
      setIpv4Results(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed")
      setIpv4Results(null)
    }
  }

  const calculateIPv6 = () => {
    setError("")
    try {
      if (!isValidIPv6(ipv6Address)) {
        throw new Error("Invalid IPv6 address")
      }

      const prefix = Number.parseInt(ipv6Prefix)
      if (isNaN(prefix) || prefix < 0 || prefix > 128) {
        throw new Error("Invalid prefix length (must be 0-128)")
      }

      const result = calculateIPv6Subnet(ipv6Address, prefix)
      setIpv6Results(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed")
      setIpv6Results(null)
    }
  }

  const exportResults = (format: "json" | "csv") => {
    const results = ipv4Results || ipv6Results
    if (!results) return

    let content = ""
    let filename = ""

    if (format === "json") {
      content = JSON.stringify(results, null, 2)
      filename = "subnet-calculation.json"
    } else {
      const entries = Object.entries(results)
      content = "Property,Value\n" + entries.map(([key, value]) => `${key},${value}`).join("\n")
      filename = "subnet-calculation.csv"
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-start space-x-3">
          <Calculator className="text-primary mt-0.5 h-6 w-6 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Subnet Calculator</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Calculate network parameters for IPv4 and IPv6 subnets
            </p>
          </div>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportResults("csv")}
            disabled={!ipv4Results && !ipv6Results}
          >
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export </span>CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportResults("json")}
            disabled={!ipv4Results && !ipv6Results}
          >
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export </span>JSON
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
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="ipv4" className="space-y-4 sm:space-y-6">
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
                />
                <IPInput
                  label="Prefix Length"
                  placeholder="24"
                  value={ipv4Prefix}
                  onChange={setIpv4Prefix}
                  ipVersion="ipv4"
                />
                <div className="flex items-end">
                  <Button onClick={calculateIPv4} className="w-full">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate
                  </Button>
                </div>
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
                />
                <IPInput
                  label="Prefix Length"
                  placeholder="64"
                  value={ipv6Prefix}
                  onChange={setIpv6Prefix}
                  ipVersion="ipv6"
                />
                <div className="flex items-end">
                  <Button onClick={calculateIPv6} className="w-full">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate
                  </Button>
                </div>
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
