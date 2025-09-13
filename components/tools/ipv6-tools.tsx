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
import { ResultCard } from "@/components/ui/result-card"

export function IPv6Tools() {
  const [ipv6Address, setIpv6Address] = useState("2001:db8::1")
  const [macAddress, setMacAddress] = useState("00:11:22:33:44:55")
  const [prefix, setPrefix] = useState("64")
  const [error, setError] = useState("")

  const classifyIPv6Address = (address: string): string => {
    const expanded = expandIPv6(address).result
    if (expanded.startsWith("::1")) return "Loopback"
    if (expanded.startsWith("fe80:")) return "Link-Local"
    if (expanded.startsWith("ff")) return "Multicast"
    if (expanded.startsWith("2001:db8:")) return "Documentation"
    if (expanded.startsWith("::")) return "Unspecified"
    if (expanded.startsWith("2001:")) return "Global Unicast"
    if (expanded.startsWith("fc") || expanded.startsWith("fd")) return "Unique Local"
    return "Global Unicast"
  }

  // IPv6 compression per RFC 5952
  const compressIPv6 = (address: string): { result: string; error?: string } => {
    try {
      // Basic validation
      if (!address || typeof address !== "string") {
        return { result: address, error: "Invalid IPv6 address" }
      }

      // Remove leading zeros from each group
      let compressed = address.toLowerCase().replace(/\b0+([0-9a-f]+)/g, "$1")

      // Find the longest sequence of consecutive zero groups
      const groups = compressed.split(":")
      let maxZeroStart = -1
      let maxZeroLength = 0
      let currentZeroStart = -1
      let currentZeroLength = 0

      for (let i = 0; i < groups.length; i++) {
        if (groups[i] === "0" || groups[i] === "") {
          if (currentZeroStart === -1) {
            currentZeroStart = i
            currentZeroLength = 1
          } else {
            currentZeroLength++
          }
        } else {
          if (currentZeroLength > maxZeroLength) {
            maxZeroStart = currentZeroStart
            maxZeroLength = currentZeroLength
          }
          currentZeroStart = -1
          currentZeroLength = 0
        }
      }

      // Check final sequence
      if (currentZeroLength > maxZeroLength) {
        maxZeroStart = currentZeroStart
        maxZeroLength = currentZeroLength
      }

      // Replace longest zero sequence with ::
      if (maxZeroLength > 1) {
        const before = groups.slice(0, maxZeroStart).join(":")
        const after = groups.slice(maxZeroStart + maxZeroLength).join(":")

        if (before && after) {
          compressed = `${before}::${after}`
        } else if (before) {
          compressed = `${before}::`
        } else if (after) {
          compressed = `::${after}`
        } else {
          compressed = "::"
        }
      }

      return { result: compressed }
    } catch (err) {
      return { result: address, error: err instanceof Error ? err.message : "Compression failed" }
    }
  }

  // IPv6 expansion
  const expandIPv6 = (address: string): { result: string; error?: string } => {
    try {
      if (!address || typeof address !== "string") {
        return { result: address, error: "Invalid IPv6 address" }
      }

      let expanded = address.toLowerCase()

      // Handle :: compression
      if (expanded.includes("::")) {
        const parts = expanded.split("::")
        const leftGroups = parts[0] ? parts[0].split(":") : []
        const rightGroups = parts[1] ? parts[1].split(":") : []
        const missingGroups = 8 - leftGroups.length - rightGroups.length

        if (missingGroups < 0) {
          return { result: address, error: "Invalid IPv6 format" }
        }

        const middleGroups = Array(missingGroups).fill("0000")
        const allGroups = [...leftGroups, ...middleGroups, ...rightGroups]
        expanded = allGroups.join(":")
      }

      // Pad each group to 4 characters
      const result = expanded
        .split(":")
        .map((group) => group.padStart(4, "0"))
        .join(":")

      // Validate result has exactly 8 groups
      if (result.split(":").length !== 8) {
        return { result: address, error: "Invalid IPv6 format" }
      }

      return { result }
    } catch (err) {
      return { result: address, error: err instanceof Error ? err.message : "Expansion failed" }
    }
  }

  // Calculate solicited-node multicast address
  const calculateSolicitedNode = (address: string): string => {
    try {
      const expandResult = expandIPv6(address)
      if (expandResult.error) return "Invalid IPv6 address"

      const lastGroups = expandResult.result.split(":").slice(-2).join("")
      const last24Bits = lastGroups.slice(-6)
      return `ff02::1:ff${last24Bits.slice(0, 2)}:${last24Bits.slice(2)}`
    } catch {
      return "Invalid IPv6 address"
    }
  }

  // Generate EUI-64 from MAC address
  const generateEUI64 = (mac: string, prefixAddr: string): string => {
    try {
      // Clean MAC address
      const cleanMac = mac.replace(/[:-]/g, "").toLowerCase()
      if (cleanMac.length !== 12 || !/^[0-9a-f]{12}$/.test(cleanMac)) {
        throw new Error("Invalid MAC address format")
      }

      // Split MAC into bytes
      const macBytes = cleanMac.match(/.{2}/g) || []
      if (macBytes.length !== 6) {
        throw new Error("Invalid MAC address")
      }

      // Flip the U/L bit (7th bit of first byte)
      const firstByte = Number.parseInt(macBytes[0], 16)
      const flippedByte = (firstByte ^ 0x02).toString(16).padStart(2, "0")

      // Insert FF:FE in the middle
      const eui64 = `${flippedByte}${macBytes[1]}:${macBytes[2]}ff:fe${macBytes[3]}:${macBytes[4]}${macBytes[5]}`

      // Combine with prefix
      const prefixPart = prefixAddr.split("::")[0] || prefixAddr.split(":").slice(0, 4).join(":")
      return `${prefixPart}:${eui64}`
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : "Invalid MAC address"}`
    }
  }

  // Generate link-local address
  const generateLinkLocal = (mac: string): string => {
    return generateEUI64(mac, "fe80::")
  }

  const results = useMemo(() => {
    const compressResult = compressIPv6(ipv6Address)
    const expandResult = expandIPv6(ipv6Address)

    // Set error if any operation failed
    const hasError = compressResult.error || expandResult.error
    if (hasError && !error) {
      setError(compressResult.error || expandResult.error || "")
    } else if (!hasError && error) {
      setError("")
    }

    return {
      original: ipv6Address,
      compressed: compressResult.result,
      expanded: expandResult.result,
      solicitedNode: calculateSolicitedNode(ipv6Address),
      eui64: generateEUI64(macAddress, `2001:db8::/${prefix}`),
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

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "ipv6-tools-results.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">IPv6 Tools</h1>
        <p className="text-muted-foreground">
          Comprehensive IPv6 address manipulation, EUI-64 generation, and multicast calculation per RFC 5952.
        </p>
      </div>

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
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
                  <Input id="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="64" />
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
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reference" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  IPv6 Address Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Loopback:</span>
                    <code className="text-xs bg-muted px-1 rounded">::1/128</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Link-Local:</span>
                    <code className="text-xs bg-muted px-1 rounded">fe80::/10</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Unique Local:</span>
                    <code className="text-xs bg-muted px-1 rounded">fc00::/7</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Global Unicast:</span>
                    <code className="text-xs bg-muted px-1 rounded">2000::/3</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Multicast:</span>
                    <code className="text-xs bg-muted px-1 rounded">ff00::/8</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Documentation:</span>
                    <code className="text-xs bg-muted px-1 rounded">2001:db8::/32</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Compression Rules (RFC 5952)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
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
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
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
                    Used for Neighbor Discovery Protocol (NDP) to resolve IPv6 addresses to MAC addresses.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
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
