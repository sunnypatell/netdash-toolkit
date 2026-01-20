"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"

interface CIDREntry {
  cidr: number
  mask: string
  wildcard: string
  hosts: number
  usable: number
  networks256: number
}

const generateCIDRTable = (): CIDREntry[] => {
  const entries: CIDREntry[] = []

  for (let cidr = 0; cidr <= 32; cidr++) {
    const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0
    const wildcardInt = ~maskInt >>> 0

    const mask = [
      (maskInt >>> 24) & 255,
      (maskInt >>> 16) & 255,
      (maskInt >>> 8) & 255,
      maskInt & 255,
    ].join(".")

    const wildcard = [
      (wildcardInt >>> 24) & 255,
      (wildcardInt >>> 16) & 255,
      (wildcardInt >>> 8) & 255,
      wildcardInt & 255,
    ].join(".")

    const totalHosts = Math.pow(2, 32 - cidr)
    const usableHosts = cidr >= 31 ? totalHosts : Math.max(0, totalHosts - 2)
    const networks256 = cidr <= 24 ? 1 : Math.pow(2, cidr - 24)

    entries.push({
      cidr,
      mask,
      wildcard,
      hosts: totalHosts,
      usable: usableHosts,
      networks256,
    })
  }

  return entries
}

const CIDR_TABLE = generateCIDRTable()

export function CIDRReference() {
  const [tab, setTab] = useState("common")

  const commonCIDRs = CIDR_TABLE.filter((e) =>
    [8, 16, 24, 25, 26, 27, 28, 29, 30, 31, 32].includes(e.cidr)
  )
  const allCIDRs = CIDR_TABLE

  const formatNumber = (n: number): string => {
    if (n >= 1000000000) return (n / 1000000000).toFixed(1) + "B"
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
    if (n >= 1000) return (n / 1000).toFixed(1) + "K"
    return n.toLocaleString()
  }

  const CIDRRow = ({ entry }: { entry: CIDREntry }) => (
    <tr className="hover:bg-muted/50 border-b">
      <td className="p-2">
        <Badge variant="secondary" className="font-mono">
          /{entry.cidr}
        </Badge>
      </td>
      <td className="p-2 font-mono text-sm">{entry.mask}</td>
      <td className="p-2 font-mono text-sm">{entry.wildcard}</td>
      <td className="p-2 text-right">{formatNumber(entry.hosts)}</td>
      <td className="p-2 text-right">{formatNumber(entry.usable)}</td>
      <td className="p-2">
        <CopyButton value={entry.mask} size="sm" />
      </td>
    </tr>
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Network}
        title="CIDR Reference"
        description="Complete CIDR notation cheat sheet"
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="common">Common CIDRs</TabsTrigger>
          <TabsTrigger value="all">All CIDRs (0-32)</TabsTrigger>
        </TabsList>

        <TabsContent value="common">
          <Card>
            <CardHeader>
              <CardTitle>Commonly Used CIDR Blocks</CardTitle>
              <CardDescription>Most frequently used subnet sizes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">CIDR</th>
                      <th className="p-2 text-left font-medium">Subnet Mask</th>
                      <th className="p-2 text-left font-medium">Wildcard</th>
                      <th className="p-2 text-right font-medium">Total IPs</th>
                      <th className="p-2 text-right font-medium">Usable</th>
                      <th className="p-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {commonCIDRs.map((entry) => (
                      <CIDRRow key={entry.cidr} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Complete CIDR Table</CardTitle>
              <CardDescription>All CIDR values from /0 to /32</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background sticky top-0">
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">CIDR</th>
                      <th className="p-2 text-left font-medium">Subnet Mask</th>
                      <th className="p-2 text-left font-medium">Wildcard</th>
                      <th className="p-2 text-right font-medium">Total IPs</th>
                      <th className="p-2 text-right font-medium">Usable</th>
                      <th className="p-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allCIDRs.map((entry) => (
                      <CIDRRow key={entry.cidr} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>IPv4 Private Ranges (RFC 1918)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Badge className="font-mono">10.0.0.0/8</Badge>
                  <span className="text-muted-foreground text-sm">Class A</span>
                </div>
                <p className="mt-1 text-sm">10.0.0.0 - 10.255.255.255 (16.7M hosts)</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Badge className="font-mono">172.16.0.0/12</Badge>
                  <span className="text-muted-foreground text-sm">Class B</span>
                </div>
                <p className="mt-1 text-sm">172.16.0.0 - 172.31.255.255 (1M hosts)</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Badge className="font-mono">192.168.0.0/16</Badge>
                  <span className="text-muted-foreground text-sm">Class C</span>
                </div>
                <p className="mt-1 text-sm">192.168.0.0 - 192.168.255.255 (65K hosts)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Special IP Ranges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <Badge className="font-mono">127.0.0.0/8</Badge>
                <p className="text-muted-foreground mt-1 text-sm">Loopback (localhost)</p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className="font-mono">169.254.0.0/16</Badge>
                <p className="text-muted-foreground mt-1 text-sm">Link-local (APIPA)</p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className="font-mono">224.0.0.0/4</Badge>
                <p className="text-muted-foreground mt-1 text-sm">Multicast</p>
              </div>
              <div className="rounded-lg border p-3">
                <Badge className="font-mono">240.0.0.0/4</Badge>
                <p className="text-muted-foreground mt-1 text-sm">Reserved (formerly Class E)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
