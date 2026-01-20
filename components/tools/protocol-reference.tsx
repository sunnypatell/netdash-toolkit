"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Search } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

interface ProtocolEntry {
  number: number
  name: string
  description: string
  rfc?: string
}

interface ICMPEntry {
  type: number
  name: string
  description: string
}

const IP_PROTOCOLS: ProtocolEntry[] = [
  { number: 1, name: "ICMP", description: "Internet Control Message Protocol", rfc: "792" },
  { number: 2, name: "IGMP", description: "Internet Group Management Protocol", rfc: "1112" },
  { number: 4, name: "IP-in-IP", description: "IP in IP encapsulation", rfc: "2003" },
  { number: 6, name: "TCP", description: "Transmission Control Protocol", rfc: "793" },
  { number: 17, name: "UDP", description: "User Datagram Protocol", rfc: "768" },
  { number: 41, name: "IPv6", description: "IPv6 encapsulation", rfc: "2473" },
  { number: 43, name: "IPv6-Route", description: "Routing Header for IPv6" },
  { number: 44, name: "IPv6-Frag", description: "Fragment Header for IPv6" },
  { number: 47, name: "GRE", description: "Generic Routing Encapsulation", rfc: "2784" },
  { number: 50, name: "ESP", description: "Encapsulating Security Payload", rfc: "4303" },
  { number: 51, name: "AH", description: "Authentication Header", rfc: "4302" },
  { number: 58, name: "ICMPv6", description: "ICMP for IPv6", rfc: "4443" },
  { number: 59, name: "IPv6-NoNxt", description: "No Next Header for IPv6" },
  { number: 60, name: "IPv6-Opts", description: "Destination Options for IPv6" },
  { number: 88, name: "EIGRP", description: "Enhanced Interior Gateway Routing Protocol" },
  { number: 89, name: "OSPF", description: "Open Shortest Path First", rfc: "2328" },
  { number: 112, name: "VRRP", description: "Virtual Router Redundancy Protocol", rfc: "5798" },
  { number: 115, name: "L2TP", description: "Layer 2 Tunneling Protocol", rfc: "3931" },
  { number: 132, name: "SCTP", description: "Stream Control Transmission Protocol", rfc: "4960" },
]

const ICMP_TYPES: ICMPEntry[] = [
  { type: 0, name: "Echo Reply", description: "Ping response" },
  { type: 3, name: "Destination Unreachable", description: "Packet could not be delivered" },
  { type: 4, name: "Source Quench", description: "Congestion control (deprecated)" },
  { type: 5, name: "Redirect", description: "Route redirection" },
  { type: 8, name: "Echo Request", description: "Ping request" },
  { type: 9, name: "Router Advertisement", description: "Router discovery" },
  { type: 10, name: "Router Solicitation", description: "Router discovery request" },
  { type: 11, name: "Time Exceeded", description: "TTL expired (traceroute)" },
  { type: 12, name: "Parameter Problem", description: "IP header issue" },
  { type: 13, name: "Timestamp Request", description: "Time synchronization" },
  { type: 14, name: "Timestamp Reply", description: "Time synchronization response" },
  { type: 30, name: "Traceroute", description: "Traceroute (deprecated)" },
]

const ICMP_UNREACHABLE_CODES = [
  { code: 0, description: "Network unreachable" },
  { code: 1, description: "Host unreachable" },
  { code: 2, description: "Protocol unreachable" },
  { code: 3, description: "Port unreachable" },
  { code: 4, description: "Fragmentation needed but DF set" },
  { code: 5, description: "Source route failed" },
  { code: 6, description: "Destination network unknown" },
  { code: 7, description: "Destination host unknown" },
  { code: 9, description: "Network administratively prohibited" },
  { code: 10, description: "Host administratively prohibited" },
  { code: 13, description: "Communication administratively prohibited" },
]

export function ProtocolReference() {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("protocols")

  const filteredProtocols = useMemo(() => {
    if (!search) return IP_PROTOCOLS
    const q = search.toLowerCase()
    return IP_PROTOCOLS.filter(
      (p) =>
        p.number.toString().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    )
  }, [search])

  const filteredICMP = useMemo(() => {
    if (!search) return ICMP_TYPES
    const q = search.toLowerCase()
    return ICMP_TYPES.filter(
      (i) =>
        i.type.toString().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileText}
        title="Protocol Reference"
        description="IP protocol numbers and ICMP types reference"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="search">Search by number or name</Label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="TCP, 6, ICMP..."
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="protocols">IP Protocol Numbers</TabsTrigger>
          <TabsTrigger value="icmp">ICMP Types</TabsTrigger>
          <TabsTrigger value="unreachable">ICMP Unreachable Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="protocols">
          <Card>
            <CardHeader>
              <CardTitle>IP Protocol Numbers</CardTitle>
              <CardDescription>Protocol field values in IP header (commonly used)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">Number</th>
                      <th className="p-2 text-left font-medium">Name</th>
                      <th className="p-2 text-left font-medium">Description</th>
                      <th className="p-2 text-left font-medium">RFC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProtocols.map((p) => (
                      <tr key={p.number} className="hover:bg-muted/50 border-b">
                        <td className="p-2">
                          <Badge variant="secondary" className="font-mono">
                            {p.number}
                          </Badge>
                        </td>
                        <td className="p-2 font-medium">{p.name}</td>
                        <td className="text-muted-foreground p-2">{p.description}</td>
                        <td className="p-2">
                          {p.rfc && <Badge variant="outline">RFC {p.rfc}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredProtocols.length === 0 && (
                <p className="text-muted-foreground py-4 text-center">No protocols match</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="icmp">
          <Card>
            <CardHeader>
              <CardTitle>ICMP Message Types</CardTitle>
              <CardDescription>Common ICMP type values</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">Type</th>
                      <th className="p-2 text-left font-medium">Name</th>
                      <th className="p-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredICMP.map((i) => (
                      <tr key={i.type} className="hover:bg-muted/50 border-b">
                        <td className="p-2">
                          <Badge variant="secondary" className="font-mono">
                            {i.type}
                          </Badge>
                        </td>
                        <td className="p-2 font-medium">{i.name}</td>
                        <td className="text-muted-foreground p-2">{i.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredICMP.length === 0 && (
                <p className="text-muted-foreground py-4 text-center">No ICMP types match</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unreachable">
          <Card>
            <CardHeader>
              <CardTitle>ICMP Destination Unreachable Codes</CardTitle>
              <CardDescription>Code values for ICMP Type 3</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">Code</th>
                      <th className="p-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ICMP_UNREACHABLE_CODES.map((c) => (
                      <tr key={c.code} className="hover:bg-muted/50 border-b">
                        <td className="p-2">
                          <Badge variant="secondary" className="font-mono">
                            {c.code}
                          </Badge>
                        </td>
                        <td className="p-2">{c.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Transport Protocol Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <Badge className="mb-2">TCP (6)</Badge>
              <h4 className="font-semibold">Connection-Oriented</h4>
              <ul className="text-muted-foreground mt-2 list-inside list-disc text-sm">
                <li>Reliable delivery</li>
                <li>Flow control</li>
                <li>Ordered packets</li>
                <li>Error recovery</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <Badge className="mb-2">UDP (17)</Badge>
              <h4 className="font-semibold">Connectionless</h4>
              <ul className="text-muted-foreground mt-2 list-inside list-disc text-sm">
                <li>Best-effort delivery</li>
                <li>Low latency</li>
                <li>No ordering</li>
                <li>Minimal overhead</li>
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <Badge className="mb-2">SCTP (132)</Badge>
              <h4 className="font-semibold">Message-Oriented</h4>
              <ul className="text-muted-foreground mt-2 list-inside list-disc text-sm">
                <li>Multi-homing</li>
                <li>Multi-streaming</li>
                <li>Message boundaries</li>
                <li>Partial reliability</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
