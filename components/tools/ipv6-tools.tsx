"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, AlertTriangle, Globe, Network, Zap } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { ResultCard } from "@/components/ui/result-card"
import { compressIPv6, expandIPv6, isValidIPv6 } from "@/lib/network-utils"
import { normalizeMac } from "@/lib/parsers"
import { downloadTextFile, dateStamp } from "@/lib/download"

const EXPANDED_LOOPBACK = "0000:0000:0000:0000:0000:0000:0000:0001"
const EXPANDED_UNSPECIFIED = "0000:0000:0000:0000:0000:0000:0000:0000"

// the shared expand/compress helpers assume a well-formed address, so gate on
// isValidIPv6 here to keep this tool's inline error UX
const safeExpand = (address: string): { result: string; error?: string } => {
  if (!isValidIPv6(address)) return { result: address, error: "Invalid IPv6 address" }
  return { result: expandIPv6(address) }
}

const safeCompress = (address: string): { result: string; error?: string } => {
  if (!isValidIPv6(address)) return { result: address, error: "Invalid IPv6 address" }
  return { result: compressIPv6(address) }
}

export function IPv6Tools() {
  const [ipv6Address, setIpv6Address] = useState("2001:db8::1")
  const [macAddress, setMacAddress] = useState("00:11:22:33:44:55")
  const [prefix, setPrefix] = useState("64")
  const [error, setError] = useState("")

  const classifyIPv6Address = (address: string): string => {
    const expanded = safeExpand(address)
    if (expanded.error) return "Unknown"

    // classify against the EXPANDED form - the old prefix literals were
    // compressed ("::1", "fe80:"), so they never matched and everything
    // fell through to Global Unicast
    if (expanded.result === EXPANDED_LOOPBACK) return "Loopback"
    if (expanded.result === EXPANDED_UNSPECIFIED) return "Unspecified"

    const firstGroup = Number.parseInt(expanded.result.slice(0, 4), 16)
    if ((firstGroup & 0xff00) === 0xff00) return "Multicast"
    // fe80::/10 spans fe80-febf, not just fe80::/16
    if ((firstGroup & 0xffc0) === 0xfe80) return "Link-Local"
    if ((firstGroup & 0xfe00) === 0xfc00) return "Unique Local"
    if (expanded.result.startsWith("2001:0db8:")) return "Documentation"
    return "Global Unicast"
  }

  // Calculate solicited-node multicast address
  const calculateSolicitedNode = (address: string): string => {
    try {
      const expandResult = safeExpand(address)
      if (expandResult.error) return "Invalid IPv6 address"

      const lastGroups = expandResult.result.split(":").slice(-2).join("")
      const last24Bits = lastGroups.slice(-6)
      return `ff02::1:ff${last24Bits.slice(0, 2)}:${last24Bits.slice(2)}`
    } catch {
      return "Invalid IPv6 address"
    }
  }

  // Generate EUI-64 from MAC address
  const getNetworkPrefix = (
    address: string,
    prefixLength: number
  ): { network: string; error?: string } => {
    const expanded = safeExpand(address)
    if (expanded.error) {
      return { network: "", error: expanded.error }
    }

    if (Number.isNaN(prefixLength) || prefixLength < 0 || prefixLength > 128) {
      return { network: "", error: "Invalid prefix length. Enter a value between 0 and 128." }
    }

    const groups = expanded.result.split(":").map((group) => Number.parseInt(group, 16))
    const maskedGroups = groups.map((group, index) => {
      const bitsRemaining = prefixLength - index * 16
      if (bitsRemaining >= 16) return group
      if (bitsRemaining <= 0) return 0

      const mask = 0xffff - ((1 << (16 - bitsRemaining)) - 1)
      return group & mask
    })

    const network = maskedGroups.map((group) => group.toString(16).padStart(4, "0")).join(":")
    return { network }
  }

  const generateEUI64 = (mac: string, networkPrefix: string, prefixLength: number): string => {
    if (prefixLength > 64) {
      throw new Error("Prefix length must be 64 or less for EUI-64 generation")
    }

    const macBytes = normalizeMac(mac).split(":")

    const firstByte = Number.parseInt(macBytes[0], 16)
    const flippedByte = (firstByte ^ 0x02).toString(16).padStart(2, "0")
    const eui64 = `${flippedByte}${macBytes[1]}:${macBytes[2]}ff:fe${macBytes[3]}:${macBytes[4]}${macBytes[5]}`

    const expandedPrefix = safeExpand(networkPrefix)
    if (expandedPrefix.error) {
      throw new Error(expandedPrefix.error)
    }

    const prefixGroups = expandedPrefix.result.split(":")
    const groupsNeeded = 4
    const baseGroups = prefixGroups.slice(0, groupsNeeded)
    while (baseGroups.length < groupsNeeded) {
      baseGroups.push("0000")
    }

    const combined = `${baseGroups.join(":")}:${eui64}`
    const compressed = safeCompress(combined)

    if (compressed.error) {
      throw new Error(compressed.error)
    }

    return compressed.result
  }

  const generateLinkLocal = (mac: string): string => {
    try {
      return generateEUI64(mac, "fe80::", 64)
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : "Unable to generate link-local address"}`
    }
  }

  const results = useMemo(() => {
    const compressResult = safeCompress(ipv6Address)
    const expandResult = safeExpand(ipv6Address)

    let currentError = compressResult.error || expandResult.error || ""

    const prefixLength = Number.parseInt(prefix, 10)
    if (!currentError && (Number.isNaN(prefixLength) || prefixLength < 0 || prefixLength > 128)) {
      currentError = "Invalid prefix length. Enter a value between 0 and 128."
    }

    let networkPrefix = ""
    if (!currentError) {
      const networkResult = getNetworkPrefix(ipv6Address, prefixLength)
      if (networkResult.error) {
        currentError = networkResult.error
      } else {
        networkPrefix = networkResult.network
      }
    }

    let eui64Address = ""
    if (!currentError && networkPrefix) {
      try {
        eui64Address = generateEUI64(macAddress, networkPrefix, prefixLength)
      } catch (err) {
        currentError = err instanceof Error ? err.message : "Unable to generate EUI-64 address"
      }
    }

    if (currentError !== error) {
      setError(currentError)
    } else if (!currentError && error) {
      setError("")
    }

    return {
      original: ipv6Address,
      compressed: compressResult.result,
      expanded: expandResult.result,
      solicitedNode: calculateSolicitedNode(ipv6Address),
      eui64: eui64Address || "-",
      linkLocal: generateLinkLocal(macAddress),
      addressType: classifyIPv6Address(ipv6Address),
    }
  }, [ipv6Address, macAddress, prefix, error])

  const exportResults = () => {
    const data = {
      input: {
        ipv6Address,
        macAddress,
        prefix,
      },
      results,
      timestamp: new Date().toISOString(),
    }

    downloadTextFile(
      JSON.stringify(data, null, 2),
      `ipv6-tools-results-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe}
        title="IPv6 Tools"
        description="Comprehensive IPv6 address manipulation, EUI-64 generation, and multicast calculation per RFC 5952."
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="reference">Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Input Configuration
                </CardTitle>
                <CardDescription>Enter IPv6 address and MAC for calculations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ipv6-address">IPv6 Address</Label>
                  <Input
                    id="ipv6-address"
                    value={ipv6Address}
                    onChange={(e) => setIpv6Address(e.target.value)}
                    placeholder="2001:db8::1"
                  />
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {results.addressType}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label htmlFor="mac-address">MAC Address</Label>
                  <Input
                    id="mac-address"
                    value={macAddress}
                    onChange={(e) => setMacAddress(e.target.value)}
                    placeholder="00:11:22:33:44:55"
                  />
                </div>

                <div>
                  <Label htmlFor="prefix">Prefix Length</Label>
                  <Input
                    id="prefix"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="64"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quick Load Examples</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIpv6Address("2001:db8::1")
                        setMacAddress("00:11:22:33:44:55")
                      }}
                    >
                      Documentation
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIpv6Address("2001:4860:4860::8888")
                        setMacAddress("00:1a:11:22:33:44")
                      }}
                    >
                      Google DNS
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIpv6Address("::1")
                        setMacAddress("02:00:00:00:00:01")
                      }}
                    >
                      Loopback
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIpv6Address("fe80::1")
                        setMacAddress("00:50:56:12:34:56")
                      }}
                    >
                      Link-Local
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <ResultCard
                title="IPv6 Address Formats"
                data={[
                  {
                    label: "Original",
                    value: results.original,
                    copyable: true,
                  },
                  {
                    label: "Compressed (RFC 5952)",
                    value: results.compressed,
                    copyable: true,
                    highlight: true,
                  },
                  {
                    label: "Expanded",
                    value: results.expanded,
                    copyable: true,
                  },
                ]}
              />

              <ResultCard
                title="Multicast & Special Addresses"
                data={[
                  {
                    label: "Solicited-Node Multicast",
                    value: results.solicitedNode,
                    copyable: true,
                    highlight: true,
                  },
                ]}
              />

              <ResultCard
                title="EUI-64 Generation"
                data={[
                  {
                    label: "EUI-64 Address",
                    value: results.eui64,
                    copyable: true,
                    highlight: true,
                  },
                  {
                    label: "Link-Local Address",
                    value: results.linkLocal,
                    copyable: true,
                  },
                ]}
              />

              <Button onClick={exportResults} variant="outline" className="w-full bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Export Results
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reference" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  IPv6 Address Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Loopback:</span>
                    <code className="bg-muted rounded px-1 text-xs">::1/128</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Link-Local:</span>
                    <code className="bg-muted rounded px-1 text-xs">fe80::/10</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Unique Local:</span>
                    <code className="bg-muted rounded px-1 text-xs">fc00::/7</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Global Unicast:</span>
                    <code className="bg-muted rounded px-1 text-xs">2000::/3</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Multicast:</span>
                    <code className="bg-muted rounded px-1 text-xs">ff00::/8</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Documentation:</span>
                    <code className="bg-muted rounded px-1 text-xs">2001:db8::/32</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Compression Rules (RFC 5952)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <ul className="text-muted-foreground list-inside list-disc space-y-1">
                    <li>Remove leading zeros in each group</li>
                    <li>Replace longest sequence of zero groups with ::</li>
                    <li>Use :: only once per address</li>
                    <li>Lowercase hexadecimal digits</li>
                    <li>Prefer :: over single zero groups</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>EUI-64 Process</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <ul className="text-muted-foreground list-inside list-disc space-y-1">
                    <li>Split MAC address into two halves</li>
                    <li>Insert FF:FE in the middle</li>
                    <li>Flip the U/L bit (7th bit of first byte)</li>
                    <li>Combine with network prefix</li>
                    <li>Results in 64-bit interface identifier</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Solicited-Node Multicast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Used for Neighbor Discovery Protocol (NDP) to resolve IPv6 addresses to MAC
                    addresses.
                  </p>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1">
                    <li>Prefix: ff02::1:ff00:0/104</li>
                    <li>Last 24 bits from target address</li>
                    <li>More efficient than broadcast</li>
                    <li>Essential for IPv6 neighbor discovery</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
