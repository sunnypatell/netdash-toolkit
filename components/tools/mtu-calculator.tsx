"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Download } from "lucide-react"
import { ResultCard } from "@/components/ui/result-card"

interface ProtocolOverhead {
  name: string
  overhead: number
  enabled: boolean
}

export function MTUCalculator() {
  const [linkMTU, setLinkMTU] = useState("1500")
  const [ipVersion, setIpVersion] = useState("ipv4")
  const [transport, setTransport] = useState("tcp")
  const [protocols, setProtocols] = useState<ProtocolOverhead[]>([
    { name: "Ethernet II", overhead: 14, enabled: true },
    { name: "802.1Q VLAN", overhead: 4, enabled: false },
    { name: "QinQ (802.1ad)", overhead: 4, enabled: false },
    { name: "PPPoE", overhead: 8, enabled: false },
    { name: "GRE", overhead: 24, enabled: false },
    { name: "VXLAN", overhead: 50, enabled: false },
    { name: "IPsec ESP", overhead: 50, enabled: false },
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
      fragmentationWarning: payloadMTU < 576, // IPv4 minimum
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

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "mtu-calculation.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">MTU Calculator</h1>
        <p className="text-muted-foreground">
          Calculate Maximum Transmission Unit and payload sizes with protocol overhead analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set up your network path parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="link-mtu">Link MTU (bytes)</Label>
              <Input id="link-mtu" value={linkMTU} onChange={(e) => setLinkMTU(e.target.value)} placeholder="1500" />
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
              <div className="space-y-2 mt-2">
                {protocols.map((protocol, index) => (
                  <div key={protocol.name} className="flex items-center space-x-2">
                    <Checkbox checked={protocol.enabled} onCheckedChange={() => toggleProtocol(index)} />
                    <span className="text-sm flex-1">{protocol.name}</span>
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
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Fragmentation Warning</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Payload MTU is below IPv4 minimum (576 bytes). This may cause fragmentation issues.
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
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total Overhead</span>
                  <span>{result.totalOverhead} bytes</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-2">
            <Button onClick={exportResults} variant="outline" className="flex-1 bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
