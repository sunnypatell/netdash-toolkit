"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Download, Ruler } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { ResultCard } from "@/components/ui/result-card"
import { PROTOCOL_OVERHEADS } from "@/lib/network-testing"
import { dateStamp, downloadTextFile } from "@/lib/download"

interface ProtocolOverhead {
  name: string
  overhead: number
  enabled: boolean
}

export function MTUCalculator() {
  const [linkMTU, setLinkMTU] = useState("1500")
  const [ipVersion, setIpVersion] = useState("ipv4")
  const [transport, setTransport] = useState("tcp")
  // link mtu is already the l3 payload limit (1500 excludes the 14-byte
  // ethernet header), so only encapsulation that eats into it is listed here
  const [protocols, setProtocols] = useState<ProtocolOverhead[]>([
    { name: "802.1Q VLAN", overhead: PROTOCOL_OVERHEADS["802.1Q"], enabled: false },
    { name: "QinQ (802.1ad)", overhead: PROTOCOL_OVERHEADS.QinQ, enabled: false },
    { name: "PPPoE", overhead: PROTOCOL_OVERHEADS.PPPoE, enabled: false },
    { name: "GRE", overhead: PROTOCOL_OVERHEADS.GRE, enabled: false },
    { name: "VXLAN", overhead: PROTOCOL_OVERHEADS.VXLAN, enabled: false },
    { name: "IPsec ESP", overhead: PROTOCOL_OVERHEADS["IPsec ESP"], enabled: false },
  ])

  const calculateMTU = () => {
    const baseMTU = Number.parseInt(linkMTU) || 1500

    // Calculate total overhead
    let totalOverhead = 0

    // Protocol overheads
    protocols.forEach((protocol) => {
      if (protocol.enabled) {
        totalOverhead += protocol.overhead
      }
    })

    // IP header overhead
    const ipOverhead = ipVersion === "ipv4" ? 20 : 40
    totalOverhead += ipOverhead

    // Transport header overhead
    const transportOverhead = transport === "tcp" ? 20 : transport === "udp" ? 8 : 0
    totalOverhead += transportOverhead

    const payloadMTU = baseMTU - totalOverhead

    return {
      linkMTU: baseMTU,
      totalOverhead,
      payloadMTU,
      // rfc 8200 s5 for ipv6; 576 is ipv4's minimum reassembly buffer, which
      // is the practical floor operators care about (rfc 791's mtu min is 68)
      fragmentationWarning: ipVersion === "ipv6" ? payloadMTU < 1280 : payloadMTU < 576,
      breakdown: {
        protocols: protocols.filter((p) => p.enabled),
        ip: { version: ipVersion, overhead: ipOverhead },
        transport: { protocol: transport, overhead: transportOverhead },
      },
    }
  }

  const result = calculateMTU()

  const toggleProtocol = (index: number) => {
    const newProtocols = [...protocols]
    newProtocols[index].enabled = !newProtocols[index].enabled
    setProtocols(newProtocols)
  }

  const exportResults = () => {
    const data = {
      configuration: {
        linkMTU: Number.parseInt(linkMTU),
        ipVersion,
        transport,
        enabledProtocols: protocols.filter((p) => p.enabled).map((p) => p.name),
      },
      results: result,
    }

    downloadTextFile(
      JSON.stringify(data, null, 2),
      `mtu-calculation-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Ruler}
        title="MTU Calculator"
        description="Calculate Maximum Transmission Unit and payload sizes with protocol overhead analysis."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set up your network path parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="link-mtu">Link MTU (bytes)</Label>
              <Input
                id="link-mtu"
                value={linkMTU}
                onChange={(e) => setLinkMTU(e.target.value)}
                placeholder="1500"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Layer 3 MTU. Ethernet&apos;s 1500 already excludes the 14-byte frame header.
              </p>
            </div>

            <div>
              <Label>IP Version</Label>
              <Select value={ipVersion} onValueChange={setIpVersion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ipv4">IPv4 (20 bytes)</SelectItem>
                  <SelectItem value="ipv6">IPv6 (40 bytes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Transport Protocol</Label>
              <Select value={transport} onValueChange={setTransport}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">TCP (20 bytes)</SelectItem>
                  <SelectItem value="udp">UDP (8 bytes)</SelectItem>
                  <SelectItem value="none">None (0 bytes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Protocol Stack</Label>
              <div className="mt-2 space-y-2">
                {protocols.map((protocol, index) => (
                  <div key={protocol.name} className="flex items-center space-x-2">
                    <Checkbox
                      checked={protocol.enabled}
                      onCheckedChange={() => toggleProtocol(index)}
                    />
                    <span className="flex-1 text-sm">{protocol.name}</span>
                    <Badge variant="secondary">{protocol.overhead} bytes</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ResultCard
            title="MTU Analysis"
            data={[
              { label: "Link MTU", value: `${result.linkMTU} bytes` },
              { label: "Total Overhead", value: `${result.totalOverhead} bytes` },
              { label: "Payload MTU", value: `${result.payloadMTU} bytes`, highlight: true },
            ]}
          />

          {result.fragmentationWarning && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="text-destructive flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Fragmentation Warning</span>
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Payload MTU is below IPv4 minimum (576 bytes). This may cause fragmentation
                  issues.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Overhead Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.breakdown.protocols.map((protocol) => (
                  <div key={protocol.name} className="flex justify-between text-sm">
                    <span>{protocol.name}</span>
                    <span>{protocol.overhead} bytes</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span>{result.breakdown.ip.version.toUpperCase()} Header</span>
                  <span>{result.breakdown.ip.overhead} bytes</span>
                </div>
                {result.breakdown.transport.overhead > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>{result.breakdown.transport.protocol.toUpperCase()} Header</span>
                    <span>{result.breakdown.transport.overhead} bytes</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 font-medium">
                  <span>Total Overhead</span>
                  <span>{result.totalOverhead} bytes</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-2">
            <Button onClick={exportResults} variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Export Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
