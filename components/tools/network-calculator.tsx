"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calculator } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"

export function NetworkCalculator() {
  // Latency Calculator
  const [distance, setDistance] = useState("1000")
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km")
  const [medium, setMedium] = useState<"fiber" | "copper" | "wireless">("fiber")

  // Throughput Calculator
  const [bandwidth, setBandwidth] = useState("1000")
  const [rtt, setRtt] = useState("50")
  const [windowSize, setWindowSize] = useState("65535")

  // IP Math
  const [ip1, setIp1] = useState("192.168.1.0")
  const [ip2, setIp2] = useState("192.168.1.255")

  const SPEED_OF_LIGHT = 299792 // km/s
  const FIBER_SPEED = 0.67 * SPEED_OF_LIGHT // ~67% of light speed
  const COPPER_SPEED = 0.77 * SPEED_OF_LIGHT // ~77% of light speed
  const WIRELESS_SPEED = 0.95 * SPEED_OF_LIGHT // ~95% for radio waves

  const latencyResult = useMemo(() => {
    const dist = parseFloat(distance)
    if (isNaN(dist) || dist <= 0) return null

    const distKm = distanceUnit === "mi" ? dist * 1.60934 : dist

    const speeds = {
      fiber: FIBER_SPEED,
      copper: COPPER_SPEED,
      wireless: WIRELESS_SPEED,
    }

    const speed = speeds[medium]
    const propagationDelay = (distKm / speed) * 1000 // ms
    const roundTripDelay = propagationDelay * 2

    return {
      propagationDelay: propagationDelay.toFixed(3),
      roundTripDelay: roundTripDelay.toFixed(3),
      speedKmPerMs: (speed / 1000).toFixed(2),
    }
  }, [distance, distanceUnit, medium])

  const throughputResult = useMemo(() => {
    const bw = parseFloat(bandwidth)
    const r = parseFloat(rtt)
    const win = parseFloat(windowSize)

    if (isNaN(bw) || isNaN(r) || isNaN(win) || bw <= 0 || r <= 0 || win <= 0) return null

    // Bandwidth Delay Product (BDP)
    const bdpBits = (bw * 1000000 * r) / 1000 // bits
    const bdpBytes = bdpBits / 8

    // Maximum throughput with given window size
    const maxThroughputBps = (win * 8 * 1000) / r // bits per second
    const maxThroughputMbps = maxThroughputBps / 1000000

    // Optimal window size for full bandwidth utilization
    const optimalWindowBytes = (bw * 1000000 * r) / (8 * 1000)

    // Efficiency
    const efficiency = Math.min(100, (maxThroughputMbps / bw) * 100)

    return {
      bdpBytes: Math.round(bdpBytes).toLocaleString(),
      bdpKB: (bdpBytes / 1024).toFixed(2),
      maxThroughputMbps: maxThroughputMbps.toFixed(2),
      optimalWindowBytes: Math.round(optimalWindowBytes).toLocaleString(),
      optimalWindowKB: (optimalWindowBytes / 1024).toFixed(2),
      efficiency: efficiency.toFixed(1),
    }
  }, [bandwidth, rtt, windowSize])

  const ipMathResult = useMemo(() => {
    const parseIP = (ip: string): number | null => {
      const parts = ip.trim().split(".")
      if (parts.length !== 4) return null
      const octets = parts.map((p) => parseInt(p, 10))
      if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return null
      return ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]
    }

    const intToIP = (num: number): string => {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join(".")
    }

    const n1 = parseIP(ip1)
    const n2 = parseIP(ip2)

    if (n1 === null || n2 === null) return null

    const diff = Math.abs(n2 - n1)
    const xor = n1 ^ n2
    const and = n1 & n2
    const or = n1 | n2
    const min = Math.min(n1, n2)
    const max = Math.max(n1, n2)

    return {
      difference: diff.toLocaleString(),
      hostsInRange: (diff + 1).toLocaleString(),
      xor: intToIP(xor >>> 0),
      and: intToIP(and >>> 0),
      or: intToIP(or >>> 0),
      min: intToIP(min >>> 0),
      max: intToIP(max >>> 0),
    }
  }, [ip1, ip2])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Calculator}
        title="Network Calculator"
        description="Calculate latency, throughput, and perform IP math"
      />

      <Tabs defaultValue="latency" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="latency">Latency</TabsTrigger>
          <TabsTrigger value="throughput">Throughput</TabsTrigger>
          <TabsTrigger value="ipmath">IP Math</TabsTrigger>
        </TabsList>

        <TabsContent value="latency">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Propagation Delay</CardTitle>
                <CardDescription>
                  Calculate signal propagation time based on distance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label htmlFor="distance">Distance</Label>
                    <Input
                      id="distance"
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select
                      value={distanceUnit}
                      onValueChange={(v) => setDistanceUnit(v as "km" | "mi")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="km">km</SelectItem>
                        <SelectItem value="mi">miles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Medium</Label>
                  <Select value={medium} onValueChange={(v) => setMedium(v as typeof medium)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiber">Fiber Optic (~67% c)</SelectItem>
                      <SelectItem value="copper">Copper (~77% c)</SelectItem>
                      <SelectItem value="wireless">Wireless (~95% c)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setDistance("100")}
                  >
                    100 km (city)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setDistance("1000")}
                  >
                    1000 km
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setDistance("6000")}
                  >
                    6000 km (US coast)
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                {latencyResult ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-muted-foreground text-sm">One-Way Delay</p>
                      <p className="text-3xl font-bold">{latencyResult.propagationDelay} ms</p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-muted-foreground text-sm">Round-Trip Time (RTT)</p>
                      <p className="text-3xl font-bold">{latencyResult.roundTripDelay} ms</p>
                    </div>
                    <p className="text-muted-foreground text-center text-xs">
                      Signal speed: {latencyResult.speedKmPerMs} km/ms
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground py-8 text-center">Enter a valid distance</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="throughput">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Bandwidth Delay Product</CardTitle>
                <CardDescription>Calculate optimal TCP window size</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bandwidth">Bandwidth (Mbps)</Label>
                  <Input
                    id="bandwidth"
                    type="number"
                    value={bandwidth}
                    onChange={(e) => setBandwidth(e.target.value)}
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="rtt">Round-Trip Time (ms)</Label>
                  <Input
                    id="rtt"
                    type="number"
                    value={rtt}
                    onChange={(e) => setRtt(e.target.value)}
                    min={0}
                  />
                </div>
                <div>
                  <Label htmlFor="windowSize">TCP Window Size (bytes)</Label>
                  <Input
                    id="windowSize"
                    type="number"
                    value={windowSize}
                    onChange={(e) => setWindowSize(e.target.value)}
                    min={0}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Default TCP: 65535, with scaling: up to 1GB
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                {throughputResult ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-sm">Bandwidth Delay Product</p>
                      <p className="font-mono font-medium">
                        {throughputResult.bdpBytes} bytes ({throughputResult.bdpKB} KB)
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-sm">
                        Max Throughput (with current window)
                      </p>
                      <p className="font-mono font-medium">
                        {throughputResult.maxThroughputMbps} Mbps
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-sm">Optimal Window Size</p>
                      <p className="font-mono font-medium">
                        {throughputResult.optimalWindowBytes} bytes (
                        {throughputResult.optimalWindowKB} KB)
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-sm">Link Efficiency</p>
                      <p className="font-mono font-medium">{throughputResult.efficiency}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground py-8 text-center">Enter valid values</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ipmath">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>IP Address Math</CardTitle>
                <CardDescription>Perform bitwise operations on IP addresses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ip1">IP Address 1</Label>
                  <Input
                    id="ip1"
                    value={ip1}
                    onChange={(e) => setIp1(e.target.value)}
                    placeholder="192.168.1.0"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="ip2">IP Address 2</Label>
                  <Input
                    id="ip2"
                    value={ip2}
                    onChange={(e) => setIp2(e.target.value)}
                    placeholder="192.168.1.255"
                    className="font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent>
                {ipMathResult ? (
                  <div className="space-y-2">
                    {[
                      { label: "Difference", value: ipMathResult.difference },
                      { label: "Hosts in Range", value: ipMathResult.hostsInRange },
                      { label: "AND (Network)", value: ipMathResult.and },
                      { label: "OR (Broadcast)", value: ipMathResult.or },
                      { label: "XOR", value: ipMathResult.xor },
                      { label: "Min IP", value: ipMathResult.min },
                      { label: "Max IP", value: ipMathResult.max },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-lg border p-2"
                      >
                        <div>
                          <span className="text-muted-foreground text-sm">{item.label}: </span>
                          <span className="font-mono">{item.value}</span>
                        </div>
                        <CopyButton value={item.value} size="sm" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground py-8 text-center">
                    Enter two valid IP addresses
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
