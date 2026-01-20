"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Globe2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

export function IPv6Reference() {
  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe2}
        title="IPv6 Reference"
        description="IPv6 address types, prefixes, and format reference"
      />

      <Tabs defaultValue="types" className="space-y-6">
        <TabsList>
          <TabsTrigger value="types">Address Types</TabsTrigger>
          <TabsTrigger value="special">Special Addresses</TabsTrigger>
          <TabsTrigger value="format">Format Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="types">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Unicast Addresses</CardTitle>
                <CardDescription>Single destination addresses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">2000::/3</Badge>
                    <span className="font-medium">Global Unicast</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Publicly routable addresses. Equivalent to public IPv4.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">fc00::/7</Badge>
                    <span className="font-medium">Unique Local (ULA)</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Private addresses (like RFC 1918). fd00::/8 most common.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">fe80::/10</Badge>
                    <span className="font-medium">Link-Local</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Auto-configured, not routable. Required on all interfaces.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Multicast Addresses</CardTitle>
                <CardDescription>One-to-many communication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">ff00::/8</Badge>
                    <span className="font-medium">All Multicast</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    All multicast addresses start with ff.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">ff02::1</Badge>
                    <span className="font-medium">All Nodes</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    All IPv6-capable nodes on link.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">ff02::2</Badge>
                    <span className="font-medium">All Routers</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">All routers on link.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono">ff02::1:ff00:0/104</Badge>
                    <span className="font-medium">Solicited-Node</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Used for neighbor discovery (NDP).
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="special">
          <Card>
            <CardHeader>
              <CardTitle>Special Purpose Addresses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">Address</th>
                      <th className="p-2 text-left font-medium">Name</th>
                      <th className="p-2 text-left font-medium">Description</th>
                      <th className="p-2 text-left font-medium">IPv4 Equivalent</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-muted/50 border-b">
                      <td className="p-2 font-mono">::</td>
                      <td className="p-2">Unspecified</td>
                      <td className="text-muted-foreground p-2">No address assigned yet</td>
                      <td className="p-2 font-mono">0.0.0.0</td>
                    </tr>
                    <tr className="hover:bg-muted/50 border-b">
                      <td className="p-2 font-mono">::1</td>
                      <td className="p-2">Loopback</td>
                      <td className="text-muted-foreground p-2">Localhost</td>
                      <td className="p-2 font-mono">127.0.0.1</td>
                    </tr>
                    <tr className="hover:bg-muted/50 border-b">
                      <td className="p-2 font-mono">::ffff:0:0/96</td>
                      <td className="p-2">IPv4-Mapped</td>
                      <td className="text-muted-foreground p-2">IPv4 address in IPv6 format</td>
                      <td className="p-2">-</td>
                    </tr>
                    <tr className="hover:bg-muted/50 border-b">
                      <td className="p-2 font-mono">64:ff9b::/96</td>
                      <td className="p-2">NAT64</td>
                      <td className="text-muted-foreground p-2">IPv4/IPv6 translation</td>
                      <td className="p-2">-</td>
                    </tr>
                    <tr className="hover:bg-muted/50 border-b">
                      <td className="p-2 font-mono">2001:db8::/32</td>
                      <td className="p-2">Documentation</td>
                      <td className="text-muted-foreground p-2">For examples/docs only</td>
                      <td className="p-2 font-mono">192.0.2.0/24</td>
                    </tr>
                    <tr className="hover:bg-muted/50 border-b">
                      <td className="p-2 font-mono">2002::/16</td>
                      <td className="p-2">6to4</td>
                      <td className="text-muted-foreground p-2">
                        Transition mechanism (deprecated)
                      </td>
                      <td className="p-2">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="format">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Address Format</CardTitle>
                <CardDescription>128-bit address notation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">
                    Full format (8 groups of 4 hex digits)
                  </p>
                  <p className="mt-2 font-mono text-sm">2001:0db8:0000:0000:0000:0000:0000:0001</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">Leading zeros removed</p>
                  <p className="mt-2 font-mono text-sm">2001:db8:0:0:0:0:0:1</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground text-sm">
                    Consecutive zeros compressed (:: once)
                  </p>
                  <p className="mt-2 font-mono text-sm">2001:db8::1</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compression Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/20">
                  <p className="font-medium text-green-800 dark:text-green-200">Do</p>
                  <ul className="text-muted-foreground mt-1 list-inside list-disc text-sm">
                    <li>Remove leading zeros in each group</li>
                    <li>Use :: for longest run of zeros</li>
                    <li>Use :: only once per address</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
                  <p className="font-medium text-red-800 dark:text-red-200">Do Not</p>
                  <ul className="text-muted-foreground mt-1 list-inside list-disc text-sm">
                    <li>Use :: more than once</li>
                    <li>Remove trailing zeros (0001 = 1, not empty)</li>
                    <li>Mix uppercase and lowercase</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Global Unicast Address Structure</CardTitle>
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
                  45 bits (assigned by ISP)
                </p>
              </div>
              <div className="rounded border bg-yellow-100 p-2 dark:bg-yellow-900">
                <p className="text-center font-bold">Subnet ID</p>
                <p className="text-muted-foreground text-center text-xs">16 bits</p>
              </div>
              <div className="flex-1 rounded border bg-red-100 p-2 dark:bg-red-900">
                <p className="text-center font-bold">Interface ID</p>
                <p className="text-muted-foreground text-center text-xs">
                  64 bits (EUI-64 or random)
                </p>
              </div>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            Standard allocation: /48 to sites, /64 to subnets. Interface ID is typically 64 bits,
            allowing for EUI-64 or privacy extensions.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
