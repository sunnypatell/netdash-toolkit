"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Copy, Download, AlertTriangle, List, ArrowDown, ArrowUp } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"
import { ResultCard } from "@/components/ui/result-card"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import type { ProjectItem } from "@/contexts/project-context"

interface EnumerationResult {
  networkAddress: string
  broadcastAddress: string
  firstUsable: string
  lastUsable: string
  gateway: string
  totalHosts: number
  usableHosts: number
  allIPs: string[]
  usableIPs: string[]
  prefix: number
  subnetMask: string
}

export function IPEnumerator() {
  const { toast } = useToast()
  const [cidrInput, setCidrInput] = useState("192.168.1.0/28")
  const [includeNetwork, setIncludeNetwork] = useState(false)
  const [includeBroadcast, setIncludeBroadcast] = useState(false)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [displayLimit, setDisplayLimit] = useState(256)

  const parseAndEnumerate = (cidr: string): EnumerationResult | null => {
    try {
      const [ipPart, prefixPart] = cidr.trim().split("/")
      if (!ipPart || !prefixPart) return null

      const prefix = parseInt(prefixPart, 10)
      if (isNaN(prefix) || prefix < 0 || prefix > 32) return null

      const octets = ipPart.split(".").map((o) => parseInt(o, 10))
      if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) return null

      // Convert to 32-bit integer
      const ipInt = ((octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0

      // Calculate network and broadcast
      const hostBits = 32 - prefix
      const mask = prefix === 0 ? 0 : (0xffffffff << hostBits) >>> 0
      const networkInt = (ipInt & mask) >>> 0
      const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0

      // Convert integers to dotted decimal
      const intToIP = (num: number): string => {
        return [(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff].join(".")
      }

      const networkAddress = intToIP(networkInt)
      const broadcastAddress = intToIP(broadcastInt)

      // Calculate totals
      const totalHosts = Math.pow(2, hostBits)
      const usableHosts = prefix >= 31 ? totalHosts : Math.max(0, totalHosts - 2)

      // First and last usable
      const firstUsableInt = prefix >= 31 ? networkInt : networkInt + 1
      const lastUsableInt = prefix >= 31 ? broadcastInt : broadcastInt - 1
      const firstUsable = intToIP(firstUsableInt)
      const lastUsable = intToIP(lastUsableInt)

      // Gateway (typically first usable)
      const gateway = firstUsable

      // Subnet mask
      const subnetMask = intToIP(mask)

      // Generate all IPs (with safety limit)
      const allIPs: string[] = []
      const usableIPs: string[] = []
      const maxEnumerate = Math.min(totalHosts, 65536) // Safety limit for /16

      for (let i = 0; i < maxEnumerate; i++) {
        const currentIP = intToIP(networkInt + i)
        allIPs.push(currentIP)

        // Add to usable if not network or broadcast (for /30 and smaller)
        if (prefix < 31) {
          if (i > 0 && i < totalHosts - 1) {
            usableIPs.push(currentIP)
          }
        } else {
          usableIPs.push(currentIP)
        }
      }

      return {
        networkAddress,
        broadcastAddress,
        firstUsable,
        lastUsable,
        gateway,
        totalHosts,
        usableHosts,
        allIPs,
        usableIPs,
        prefix,
        subnetMask,
      }
    } catch {
      return null
    }
  }

  const result = useMemo(() => parseAndEnumerate(cidrInput), [cidrInput])

  const displayIPs = useMemo(() => {
    if (!result) return []

    let ips: string[] = []

    if (includeNetwork && includeBroadcast) {
      ips = result.allIPs
    } else if (includeNetwork) {
      ips = [result.networkAddress, ...result.usableIPs]
    } else if (includeBroadcast) {
      ips = [...result.usableIPs, result.broadcastAddress]
    } else {
      ips = result.usableIPs
    }

    if (sortOrder === "desc") {
      ips = [...ips].reverse()
    }

    return ips.slice(0, displayLimit)
  }, [result, includeNetwork, includeBroadcast, sortOrder, displayLimit])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "IP list copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const exportToCSV = () => {
    if (!result) return

    const csv = ["IP Address", ...displayIPs].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ip-range-${cidrInput.replace("/", "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToJSON = () => {
    if (!result) return

    const data = {
      cidr: cidrInput,
      network: result.networkAddress,
      broadcast: result.broadcastAddress,
      subnetMask: result.subnetMask,
      prefix: result.prefix,
      totalHosts: result.totalHosts,
      usableHosts: result.usableHosts,
      firstUsable: result.firstUsable,
      lastUsable: result.lastUsable,
      ips: displayIPs,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ip-range-${cidrInput.replace("/", "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadFromProject = (data: Record<string, unknown>, _item: ProjectItem) => {
    const input = data.input as { cidr: string } | undefined
    if (input?.cidr) {
      setCidrInput(input.cidr)
    }
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={List}
        title="IP Range Enumerator"
        description="List all IP addresses within a CIDR block with network details"
        actions={
          <>
            <LoadFromProject itemType="ip-range" onLoad={handleLoadFromProject} size="sm" />
            {result && (
              <SaveToProject
                itemType="ip-range"
                itemName={cidrInput}
                itemData={{
                  input: { cidr: cidrInput },
                  result: {
                    networkAddress: result.networkAddress,
                    broadcastAddress: result.broadcastAddress,
                    subnetMask: result.subnetMask,
                    firstUsable: result.firstUsable,
                    lastUsable: result.lastUsable,
                    totalHosts: result.totalHosts,
                    usableHosts: result.usableHosts,
                  },
                }}
                toolSource="IP Range Enumerator"
                size="sm"
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CIDR Input</CardTitle>
            <CardDescription>Enter a network in CIDR notation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cidr">Network CIDR</Label>
              <Input
                id="cidr"
                value={cidrInput}
                onChange={(e) => setCidrInput(e.target.value)}
                placeholder="192.168.1.0/24"
                className="font-mono"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Example: 10.0.0.0/24, 192.168.1.0/28, 172.16.0.0/16
              </p>
            </div>

            {!result && cidrInput.trim() && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Invalid CIDR notation</AlertDescription>
              </Alert>
            )}

            {result && result.totalHosts > 65536 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Large network ({result.totalHosts.toLocaleString()} hosts). Only first 65,536 IPs
                  will be enumerated.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label>Options</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-network"
                  checked={includeNetwork}
                  onCheckedChange={(c) => setIncludeNetwork(c === true)}
                />
                <Label htmlFor="include-network" className="text-sm font-normal">
                  Include network address
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-broadcast"
                  checked={includeBroadcast}
                  onCheckedChange={(c) => setIncludeBroadcast(c === true)}
                />
                <Label htmlFor="include-broadcast" className="text-sm font-normal">
                  Include broadcast address
                </Label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? (
                  <ArrowUp className="mr-2 h-4 w-4" />
                ) : (
                  <ArrowDown className="mr-2 h-4 w-4" />
                )}
                {sortOrder === "asc" ? "Ascending" : "Descending"}
              </Button>
            </div>

            {result && (
              <ResultCard
                title="Network Details"
                data={[
                  { label: "Network Address", value: result.networkAddress },
                  { label: "Broadcast Address", value: result.broadcastAddress },
                  { label: "Subnet Mask", value: result.subnetMask },
                  { label: "First Usable", value: result.firstUsable },
                  { label: "Last Usable", value: result.lastUsable },
                  { label: "Gateway (typical)", value: result.gateway },
                  { label: "Total Hosts", value: result.totalHosts.toLocaleString() },
                  {
                    label: "Usable Hosts",
                    value: result.usableHosts.toLocaleString(),
                    highlight: true,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>IP Address List</span>
              {result && (
                <Badge variant="secondary">
                  {displayIPs.length} / {result.usableHosts.toLocaleString()}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {result
                ? `Showing ${displayIPs.length} addresses`
                : "Enter a valid CIDR to enumerate"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result && displayIPs.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(displayIPs.join("\n"))}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy All
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToJSON}>
                    <Download className="mr-2 h-4 w-4" />
                    JSON
                  </Button>
                </div>

                <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-3">
                  {displayIPs.map((ip, index) => (
                    <div
                      key={index}
                      className="hover:bg-muted/50 flex items-center justify-between rounded px-2 py-1 font-mono text-sm"
                    >
                      <span
                        className={
                          ip === result.networkAddress
                            ? "text-blue-600"
                            : ip === result.broadcastAddress
                              ? "text-orange-600"
                              : ip === result.gateway
                                ? "text-green-600"
                                : ""
                        }
                      >
                        {ip}
                      </span>
                      <div className="flex items-center gap-2">
                        {ip === result.networkAddress && (
                          <Badge variant="outline" className="text-xs">
                            Network
                          </Badge>
                        )}
                        {ip === result.broadcastAddress && (
                          <Badge variant="outline" className="text-xs">
                            Broadcast
                          </Badge>
                        )}
                        {ip === result.gateway && ip !== result.networkAddress && (
                          <Badge variant="outline" className="text-xs">
                            Gateway
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {displayIPs.length < result.usableHosts && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Showing {displayIPs.length} of {result.usableHosts.toLocaleString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDisplayLimit((l) => Math.min(l + 256, result.allIPs.length))
                      }
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">Enter a valid CIDR to see IP list</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common CIDR Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 lg:grid-cols-6">
            {[
              { cidr: "/30", hosts: 2, use: "Point-to-point" },
              { cidr: "/29", hosts: 6, use: "Small office" },
              { cidr: "/28", hosts: 14, use: "Small subnet" },
              { cidr: "/27", hosts: 30, use: "Department" },
              { cidr: "/26", hosts: 62, use: "Medium subnet" },
              { cidr: "/25", hosts: 126, use: "Large subnet" },
              { cidr: "/24", hosts: 254, use: "Standard LAN" },
              { cidr: "/23", hosts: 510, use: "Large LAN" },
              { cidr: "/22", hosts: 1022, use: "Campus" },
              { cidr: "/20", hosts: 4094, use: "Data center" },
              { cidr: "/16", hosts: 65534, use: "Enterprise" },
              { cidr: "/8", hosts: "16M", use: "ISP block" },
            ].map((item) => (
              <button
                key={item.cidr}
                onClick={() => setCidrInput(`192.168.1.0${item.cidr}`)}
                className="hover:bg-muted rounded-lg border p-3 text-left transition-colors"
              >
                <p className="font-mono font-semibold">{item.cidr}</p>
                <p className="text-muted-foreground text-xs">
                  {typeof item.hosts === "number" ? item.hosts.toLocaleString() : item.hosts} hosts
                </p>
                <p className="text-muted-foreground text-xs">{item.use}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
