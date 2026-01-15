"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  BarChart3,
  Network,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Clock,
  Wifi,
  Router,
  Server,
  Download,
  Upload,
} from "lucide-react"

interface NetworkDevice {
  id: string
  name: string
  type: "router" | "switch" | "server" | "workstation" | "firewall"
  ip: string
  interfaces: NetworkInterface[]
}

interface NetworkInterface {
  name: string
  speed: number // Mbps
  utilization: number // percentage
  mtu: number
  duplex: "full" | "half"
  status: "up" | "down"
}

interface BandwidthAnalysis {
  totalCapacity: number
  currentUtilization: number
  peakUtilization: number
  availableBandwidth: number
  bottlenecks: string[]
  recommendations: string[]
}

interface LatencyAnalysis {
  averageLatency: number
  jitter: number
  packetLoss: number
  qualityScore: number
  issues: string[]
}

export function NetworkAnalyzer() {
  const [devices, setDevices] = useState<NetworkDevice[]>([
    {
      id: "1",
      name: "Core-Switch-01",
      type: "switch",
      ip: "192.168.1.1",
      interfaces: [
        {
          name: "GigE1/0/1",
          speed: 1000,
          utilization: 45,
          mtu: 1500,
          duplex: "full",
          status: "up",
        },
        {
          name: "GigE1/0/2",
          speed: 1000,
          utilization: 78,
          mtu: 1500,
          duplex: "full",
          status: "up",
        },
        {
          name: "GigE1/0/24",
          speed: 1000,
          utilization: 23,
          mtu: 1500,
          duplex: "full",
          status: "up",
        },
      ],
    },
    {
      id: "2",
      name: "Edge-Router-01",
      type: "router",
      ip: "192.168.1.254",
      interfaces: [
        { name: "GigE0/0", speed: 1000, utilization: 67, mtu: 1500, duplex: "full", status: "up" },
        { name: "GigE0/1", speed: 100, utilization: 89, mtu: 1500, duplex: "full", status: "up" },
      ],
    },
  ])

  const [newDevice, setNewDevice] = useState<Partial<NetworkDevice>>({
    name: "",
    type: "switch",
    ip: "",
    interfaces: [],
  })

  const [analysisResults, setAnalysisResults] = useState<{
    bandwidth: BandwidthAnalysis | null
    latency: LatencyAnalysis | null
  }>({
    bandwidth: null,
    latency: null,
  })

  const [topologyData, setTopologyData] = useState("")

  const analyzeBandwidth = (): BandwidthAnalysis => {
    const allInterfaces = devices.flatMap((device) =>
      device.interfaces.filter((iface) => iface.status === "up")
    )

    const totalCapacity = allInterfaces.reduce((sum, iface) => sum + iface.speed, 0)
    const currentUtilization = allInterfaces.reduce(
      (sum, iface) => sum + (iface.speed * iface.utilization) / 100,
      0
    )
    const utilizationPercentage = (currentUtilization / totalCapacity) * 100

    const peakUtilization = Math.max(...allInterfaces.map((iface) => iface.utilization))
    const availableBandwidth = totalCapacity - currentUtilization

    const bottlenecks: string[] = []
    const recommendations: string[] = []

    // Identify bottlenecks
    allInterfaces.forEach((iface) => {
      if (iface.utilization > 80) {
        const device = devices.find((d) => d.interfaces.includes(iface))
        bottlenecks.push(`${device?.name} - ${iface.name} (${iface.utilization}% utilized)`)
      }
    })

    // Generate recommendations
    if (utilizationPercentage > 70) {
      recommendations.push("Overall network utilization is high - consider capacity planning")
    }
    if (bottlenecks.length > 0) {
      recommendations.push(
        "High utilization interfaces detected - consider load balancing or upgrades"
      )
    }
    if (peakUtilization > 90) {
      recommendations.push("Critical utilization levels detected - immediate attention required")
    }

    return {
      totalCapacity,
      currentUtilization,
      peakUtilization,
      availableBandwidth,
      bottlenecks,
      recommendations,
    }
  }

  const analyzeLatency = (): LatencyAnalysis => {
    // Simulated latency analysis based on network topology
    const routerCount = devices.filter((d) => d.type === "router").length
    const switchCount = devices.filter((d) => d.type === "switch").length
    const totalDevices = devices.length

    // Base latency calculation (simplified)
    const baseLatency = routerCount * 2 + switchCount * 0.5 + Math.random() * 5
    const jitter = Math.random() * 2
    const packetLoss = Math.random() * 0.5

    // Quality score calculation
    let qualityScore = 100
    if (baseLatency > 50) qualityScore -= 20
    if (baseLatency > 100) qualityScore -= 30
    if (jitter > 1) qualityScore -= 15
    if (packetLoss > 0.1) qualityScore -= 25

    const issues: string[] = []
    if (baseLatency > 50) issues.push("High latency detected")
    if (jitter > 1) issues.push("High jitter affecting real-time applications")
    if (packetLoss > 0.1) issues.push("Packet loss detected")
    if (totalDevices > 10) issues.push("Complex topology may contribute to latency")

    return {
      averageLatency: baseLatency,
      jitter,
      packetLoss,
      qualityScore: Math.max(0, qualityScore),
      issues,
    }
  }

  const runAnalysis = () => {
    const bandwidthAnalysis = analyzeBandwidth()
    const latencyAnalysis = analyzeLatency()

    setAnalysisResults({
      bandwidth: bandwidthAnalysis,
      latency: latencyAnalysis,
    })
  }

  const addDevice = () => {
    if (!newDevice.name || !newDevice.ip) return

    const device: NetworkDevice = {
      id: Date.now().toString(),
      name: newDevice.name,
      type: newDevice.type || "switch",
      ip: newDevice.ip,
      interfaces: [],
    }

    setDevices([...devices, device])
    setNewDevice({ name: "", type: "switch", ip: "", interfaces: [] })
  }

  const addInterface = (deviceId: string) => {
    const interfaceName = prompt("Interface name (e.g., GigE1/0/1):")
    const speed = prompt("Interface speed in Mbps (e.g., 1000):")
    const utilization = prompt("Current utilization percentage (0-100):")

    if (interfaceName && speed && utilization) {
      setDevices(
        devices.map((device) => {
          if (device.id === deviceId) {
            const newInterface: NetworkInterface = {
              name: interfaceName,
              speed: Number.parseInt(speed),
              utilization: Number.parseInt(utilization),
              mtu: 1500,
              duplex: "full",
              status: "up",
            }
            return { ...device, interfaces: [...device.interfaces, newInterface] }
          }
          return device
        })
      )
    }
  }

  const removeDevice = (deviceId: string) => {
    setDevices(devices.filter((device) => device.id !== deviceId))
  }

  const generateTopologyReport = () => {
    let report = "# Network Topology Analysis Report\n\n"
    report += `Generated: ${new Date().toISOString()}\n\n`

    report += "## Network Overview\n"
    report += `- Total Devices: ${devices.length}\n`
    report += `- Routers: ${devices.filter((d) => d.type === "router").length}\n`
    report += `- Switches: ${devices.filter((d) => d.type === "switch").length}\n`
    report += `- Servers: ${devices.filter((d) => d.type === "server").length}\n`
    report += `- Workstations: ${devices.filter((d) => d.type === "workstation").length}\n\n`

    if (analysisResults.bandwidth) {
      const bw = analysisResults.bandwidth
      report += "## Bandwidth Analysis\n"
      report += `- Total Capacity: ${bw.totalCapacity.toFixed(0)} Mbps\n`
      report += `- Current Utilization: ${bw.currentUtilization.toFixed(0)} Mbps (${((bw.currentUtilization / bw.totalCapacity) * 100).toFixed(1)}%)\n`
      report += `- Available Bandwidth: ${bw.availableBandwidth.toFixed(0)} Mbps\n`
      report += `- Peak Interface Utilization: ${bw.peakUtilization.toFixed(1)}%\n\n`

      if (bw.bottlenecks.length > 0) {
        report += "### Bottlenecks Identified\n"
        bw.bottlenecks.forEach((bottleneck) => {
          report += `- ${bottleneck}\n`
        })
        report += "\n"
      }

      if (bw.recommendations.length > 0) {
        report += "### Recommendations\n"
        bw.recommendations.forEach((rec) => {
          report += `- ${rec}\n`
        })
        report += "\n"
      }
    }

    if (analysisResults.latency) {
      const lat = analysisResults.latency
      report += "## Latency Analysis\n"
      report += `- Average Latency: ${lat.averageLatency.toFixed(2)} ms\n`
      report += `- Jitter: ${lat.jitter.toFixed(2)} ms\n`
      report += `- Packet Loss: ${lat.packetLoss.toFixed(3)}%\n`
      report += `- Quality Score: ${lat.qualityScore.toFixed(0)}/100\n\n`

      if (lat.issues.length > 0) {
        report += "### Issues Identified\n"
        lat.issues.forEach((issue) => {
          report += `- ${issue}\n`
        })
        report += "\n"
      }
    }

    report += "## Device Details\n"
    devices.forEach((device) => {
      report += `### ${device.name} (${device.type})\n`
      report += `- IP Address: ${device.ip}\n`
      report += `- Interfaces: ${device.interfaces.length}\n`

      if (device.interfaces.length > 0) {
        report += "- Interface Details:\n"
        device.interfaces.forEach((iface) => {
          report += `  - ${iface.name}: ${iface.speed} Mbps, ${iface.utilization}% utilized, ${iface.status}\n`
        })
      }
      report += "\n"
    })

    setTopologyData(report)
  }

  const exportReport = () => {
    const blob = new Blob([topologyData], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `network-analysis-${new Date().toISOString().split("T")[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const networkHealth = useMemo(() => {
    if (!analysisResults.bandwidth || !analysisResults.latency) return 0

    const bwScore = Math.max(
      0,
      100 -
        (analysisResults.bandwidth.currentUtilization / analysisResults.bandwidth.totalCapacity) *
          100
    )
    const latencyScore = analysisResults.latency.qualityScore

    return Math.round((bwScore + latencyScore) / 2)
  }, [analysisResults])

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <BarChart3 className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Network Analyzer</h1>
          <p className="text-muted-foreground">
            Advanced network topology analysis, bandwidth monitoring, and performance diagnostics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Network className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-muted-foreground text-sm">Total Devices</p>
                <p className="text-2xl font-bold">{devices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-muted-foreground text-sm">Network Health</p>
                <p className="text-2xl font-bold">{networkHealth}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-muted-foreground text-sm">Active Interfaces</p>
                <p className="text-2xl font-bold">
                  {devices.reduce(
                    (sum, device) =>
                      sum + device.interfaces.filter((i) => i.status === "up").length,
                    0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-muted-foreground text-sm">Total Capacity</p>
                <p className="text-2xl font-bold">
                  {devices.reduce(
                    (sum, device) =>
                      sum + device.interfaces.reduce((iSum, iface) => iSum + iface.speed, 0),
                    0
                  )}{" "}
                  Mbps
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="devices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Network Devices</CardTitle>
              <CardDescription>Manage your network topology and device inventory</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Input
                  placeholder="Device name"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                />
                <Select
                  value={newDevice.type}
                  onValueChange={(value: any) => setNewDevice({ ...newDevice, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="router">Router</SelectItem>
                    <SelectItem value="switch">Switch</SelectItem>
                    <SelectItem value="server">Server</SelectItem>
                    <SelectItem value="workstation">Workstation</SelectItem>
                    <SelectItem value="firewall">Firewall</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="IP Address"
                  value={newDevice.ip}
                  onChange={(e) => setNewDevice({ ...newDevice, ip: e.target.value })}
                />
                <Button onClick={addDevice} disabled={!newDevice.name || !newDevice.ip}>
                  Add Device
                </Button>
              </div>

              <div className="space-y-4">
                {devices.map((device) => (
                  <Card key={device.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center space-x-3">
                          {device.type === "router" && <Router className="h-5 w-5 text-blue-600" />}
                          {device.type === "switch" && (
                            <Network className="h-5 w-5 text-green-600" />
                          )}
                          {device.type === "server" && (
                            <Server className="h-5 w-5 text-purple-600" />
                          )}
                          {device.type === "workstation" && (
                            <Wifi className="h-5 w-5 text-orange-600" />
                          )}
                          {device.type === "firewall" && (
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          )}
                          <h4 className="font-semibold">{device.name}</h4>
                          <Badge variant="outline">{device.type}</Badge>
                          <span className="text-muted-foreground text-sm">{device.ip}</span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">
                              Interfaces ({device.interfaces.length})
                            </Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addInterface(device.id)}
                            >
                              Add Interface
                            </Button>
                          </div>

                          {device.interfaces.length > 0 && (
                            <div className="space-y-1">
                              {device.interfaces.map((iface, index) => (
                                <div
                                  key={index}
                                  className="bg-muted/50 flex items-center justify-between rounded p-2 text-sm"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono">{iface.name}</span>
                                    <Badge
                                      variant={iface.status === "up" ? "secondary" : "destructive"}
                                    >
                                      {iface.status}
                                    </Badge>
                                  </div>
                                  <div className="text-muted-foreground flex items-center space-x-4 text-xs">
                                    <span>{iface.speed} Mbps</span>
                                    <span>{iface.utilization}% util</span>
                                    <div className="w-16">
                                      <Progress value={iface.utilization} className="h-2" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeDevice(device.id)}>
                        Remove
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Network Analysis</CardTitle>
              <CardDescription>Comprehensive bandwidth and latency analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runAnalysis} className="w-full">
                <BarChart3 className="mr-2 h-4 w-4" />
                Run Network Analysis
              </Button>

              {analysisResults.bandwidth && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Bandwidth Analysis</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Card className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Capacity:</span>
                          <span className="font-mono">
                            {analysisResults.bandwidth.totalCapacity.toFixed(0)} Mbps
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Current Usage:</span>
                          <span className="font-mono">
                            {analysisResults.bandwidth.currentUtilization.toFixed(0)} Mbps
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Available:</span>
                          <span className="font-mono">
                            {analysisResults.bandwidth.availableBandwidth.toFixed(0)} Mbps
                          </span>
                        </div>
                        <Progress
                          value={
                            (analysisResults.bandwidth.currentUtilization /
                              analysisResults.bandwidth.totalCapacity) *
                            100
                          }
                          className="mt-2"
                        />
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Peak Utilization:</span>
                          <span className="font-mono">
                            {analysisResults.bandwidth.peakUtilization.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bottlenecks:</span>
                          <span className="font-mono">
                            {analysisResults.bandwidth.bottlenecks.length}
                          </span>
                        </div>
                        <Progress
                          value={analysisResults.bandwidth.peakUtilization}
                          className="mt-2"
                        />
                      </div>
                    </Card>
                  </div>

                  {analysisResults.bandwidth.bottlenecks.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Bottlenecks detected:</strong>
                        <ul className="mt-1 list-inside list-disc">
                          {analysisResults.bandwidth.bottlenecks.map((bottleneck, index) => (
                            <li key={index}>{bottleneck}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {analysisResults.bandwidth.recommendations.length > 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Recommendations:</strong>
                        <ul className="mt-1 list-inside list-disc">
                          {analysisResults.bandwidth.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {analysisResults.latency && (
                <div className="space-y-4">
                  <Separator />
                  <h4 className="font-semibold">Latency Analysis</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Card className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Average Latency:</span>
                          <span className="font-mono">
                            {analysisResults.latency.averageLatency.toFixed(2)} ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Jitter:</span>
                          <span className="font-mono">
                            {analysisResults.latency.jitter.toFixed(2)} ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Packet Loss:</span>
                          <span className="font-mono">
                            {analysisResults.latency.packetLoss.toFixed(3)}%
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Quality Score:</span>
                          <span className="font-mono">
                            {analysisResults.latency.qualityScore.toFixed(0)}/100
                          </span>
                        </div>
                        <Progress value={analysisResults.latency.qualityScore} className="mt-2" />
                        <div className="text-muted-foreground text-xs">
                          {analysisResults.latency.qualityScore >= 80 && "Excellent"}
                          {analysisResults.latency.qualityScore >= 60 &&
                            analysisResults.latency.qualityScore < 80 &&
                            "Good"}
                          {analysisResults.latency.qualityScore >= 40 &&
                            analysisResults.latency.qualityScore < 60 &&
                            "Fair"}
                          {analysisResults.latency.qualityScore < 40 && "Poor"}
                        </div>
                      </div>
                    </Card>
                  </div>

                  {analysisResults.latency.issues.length > 0 && (
                    <Alert variant="destructive">
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Latency issues detected:</strong>
                        <ul className="mt-1 list-inside list-disc">
                          {analysisResults.latency.issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Monitoring</CardTitle>
              <CardDescription>
                Monitor interface utilization and network performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devices.map((device) => (
                  <Card key={device.id} className="p-4">
                    <h4 className="mb-3 font-semibold">{device.name}</h4>
                    <div className="space-y-2">
                      {device.interfaces.map((iface, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm">{iface.name}</span>
                            <Badge variant={iface.status === "up" ? "secondary" : "destructive"}>
                              {iface.status}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Upload className="h-3 w-3" />
                              <span className="text-xs">
                                {((iface.speed * iface.utilization) / 100).toFixed(0)} Mbps
                              </span>
                            </div>
                            <div className="w-32">
                              <Progress value={iface.utilization} className="h-2" />
                            </div>
                            <span className="w-12 font-mono text-xs">{iface.utilization}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Network Reports</CardTitle>
              <CardDescription>Generate comprehensive network analysis reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Button onClick={generateTopologyReport} className="flex-1">
                  Generate Report
                </Button>
                <Button onClick={exportReport} variant="outline" disabled={!topologyData}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>

              {topologyData && (
                <div>
                  <Label>Generated Report:</Label>
                  <Textarea
                    value={topologyData}
                    readOnly
                    className="mt-2 min-h-[400px] font-mono text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
