"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Router, Network, Settings, Info, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ResultCard } from "@/components/ui/result-card"

interface OSPFConfig {
  processId: string
  routerId: string
  networks: Array<{
    address: string
    wildcardMask: string
    area: string
  }>
  areas: Array<{
    id: string
    type: "standard" | "stub" | "nssa" | "totally-stub"
    authentication: boolean
  }>
  redistributeStatic: boolean
  redistributeConnected: boolean
  defaultOriginate: boolean
  passiveInterfaces: string[]
}

interface EIGRPConfig {
  asNumber: string
  routerId: string
  networks: Array<{
    address: string
    wildcardMask: string
  }>
  redistributeStatic: boolean
  redistributeConnected: boolean
  autoSummary: boolean
  variance: string
  maximumPaths: string
  passiveInterfaces: string[]
}

interface StaticRoute {
  destination: string
  mask: string
  nextHop: string
  interface: string
  adminDistance: string
  description: string
  permanent: boolean
  track: string
}

export function RoutingTools() {
  const { toast } = useToast()
  const [ospfConfig, setOspfConfig] = useState<OSPFConfig>({
    processId: "1",
    routerId: "",
    networks: [{ address: "", wildcardMask: "", area: "0" }],
    areas: [{ id: "0", type: "standard", authentication: false }],
    redistributeStatic: false,
    redistributeConnected: false,
    defaultOriginate: false,
    passiveInterfaces: [],
  })

  const [eigrpConfig, setEigrpConfig] = useState<EIGRPConfig>({
    asNumber: "",
    routerId: "",
    networks: [{ address: "", wildcardMask: "" }],
    redistributeStatic: false,
    redistributeConnected: false,
    autoSummary: false,
    variance: "1",
    maximumPaths: "4",
    passiveInterfaces: [],
  })

  const [staticRoutes, setStaticRoutes] = useState<StaticRoute[]>([
    {
      destination: "",
      mask: "",
      nextHop: "",
      interface: "",
      adminDistance: "1",
      description: "",
      permanent: false,
      track: "",
    },
  ])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: "Configuration copied successfully",
    })
  }

  const generateOSPFConfig = () => {
    let config = `! OSPF Configuration\n`
    config += `router ospf ${ospfConfig.processId}\n`

    if (ospfConfig.routerId) {
      config += ` router-id ${ospfConfig.routerId}\n`
    }

    if (ospfConfig.defaultOriginate) {
      config += ` default-information originate\n`
    }

    ospfConfig.networks.forEach((network) => {
      if (network.address && network.wildcardMask) {
        config += ` network ${network.address} ${network.wildcardMask} area ${network.area}\n`
      }
    })

    if (ospfConfig.redistributeStatic) {
      config += ` redistribute static subnets\n`
    }

    if (ospfConfig.redistributeConnected) {
      config += ` redistribute connected subnets\n`
    }

    ospfConfig.passiveInterfaces.forEach((intf) => {
      if (intf) config += ` passive-interface ${intf}\n`
    })

    config += `!\n`

    // Area configurations
    ospfConfig.areas.forEach((area) => {
      if (area.id !== "0") {
        if (area.type === "stub") {
          config += `area ${area.id} stub\n`
        } else if (area.type === "nssa") {
          config += `area ${area.id} nssa\n`
        } else if (area.type === "totally-stub") {
          config += `area ${area.id} stub no-summary\n`
        }

        if (area.authentication) {
          config += `area ${area.id} authentication\n`
        }
      }
    })

    return config
  }

  const generateEIGRPConfig = () => {
    let config = `! EIGRP Configuration\n`
    config += `router eigrp ${eigrpConfig.asNumber}\n`

    if (eigrpConfig.routerId) {
      config += ` eigrp router-id ${eigrpConfig.routerId}\n`
    }

    eigrpConfig.networks.forEach((network) => {
      if (network.address && network.wildcardMask) {
        config += ` network ${network.address} ${network.wildcardMask}\n`
      }
    })

    if (!eigrpConfig.autoSummary) {
      config += ` no auto-summary\n`
    }

    if (eigrpConfig.variance !== "1") {
      config += ` variance ${eigrpConfig.variance}\n`
    }

    if (eigrpConfig.maximumPaths !== "4") {
      config += ` maximum-paths ${eigrpConfig.maximumPaths}\n`
    }

    if (eigrpConfig.redistributeStatic) {
      config += ` redistribute static\n`
    }

    if (eigrpConfig.redistributeConnected) {
      config += ` redistribute connected\n`
    }

    eigrpConfig.passiveInterfaces.forEach((intf) => {
      if (intf) config += ` passive-interface ${intf}\n`
    })

    config += `!\n`
    return config
  }

  const generateStaticRoutes = () => {
    let config = `! Static Routes Configuration\n`

    staticRoutes.forEach((route, index) => {
      if (route.destination && route.mask && (route.nextHop || route.interface)) {
        let routeCmd = `ip route ${route.destination} ${route.mask}`

        if (route.nextHop) {
          routeCmd += ` ${route.nextHop}`
        } else if (route.interface) {
          routeCmd += ` ${route.interface}`
        }

        if (route.adminDistance !== "1") {
          routeCmd += ` ${route.adminDistance}`
        }

        if (route.permanent) {
          routeCmd += ` permanent`
        }

        if (route.track) {
          routeCmd += ` track ${route.track}`
        }

        config += `${routeCmd}\n`

        if (route.description) {
          config += `! ${route.description}\n`
        }
      }
    })

    return config
  }

  const addNetwork = (type: "ospf" | "eigrp") => {
    if (type === "ospf") {
      setOspfConfig((prev) => ({
        ...prev,
        networks: [...prev.networks, { address: "", wildcardMask: "", area: "0" }],
      }))
    } else {
      setEigrpConfig((prev) => ({
        ...prev,
        networks: [...prev.networks, { address: "", wildcardMask: "" }],
      }))
    }
  }

  const addStaticRoute = () => {
    setStaticRoutes((prev) => [
      ...prev,
      {
        destination: "",
        mask: "",
        nextHop: "",
        interface: "",
        adminDistance: "1",
        description: "",
        permanent: false,
        track: "",
      },
    ])
  }

  const exportConfig = (config: string, filename: string) => {
    const blob = new Blob([config], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const administrativeDistances = [
    {
      protocol: "Connected Interface",
      distance: 0,
      description: "Directly connected networks",
      color: "bg-green-100 text-green-800",
    },
    {
      protocol: "Static Route",
      distance: 1,
      description: "Manually configured routes",
      color: "bg-blue-100 text-blue-800",
    },
    {
      protocol: "EIGRP Summary",
      distance: 5,
      description: "EIGRP summary routes",
      color: "bg-purple-100 text-purple-800",
    },
    {
      protocol: "External BGP",
      distance: 20,
      description: "Routes from external BGP peers",
      color: "bg-orange-100 text-orange-800",
    },
    {
      protocol: "Internal EIGRP",
      distance: 90,
      description: "EIGRP internal routes",
      color: "bg-indigo-100 text-indigo-800",
    },
    { protocol: "OSPF", distance: 110, description: "Open Shortest Path First", color: "bg-cyan-100 text-cyan-800" },
    {
      protocol: "IS-IS",
      distance: 115,
      description: "Intermediate System to Intermediate System",
      color: "bg-teal-100 text-teal-800",
    },
    {
      protocol: "RIP",
      distance: 120,
      description: "Routing Information Protocol",
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      protocol: "External EIGRP",
      distance: 170,
      description: "EIGRP external routes",
      color: "bg-pink-100 text-pink-800",
    },
    {
      protocol: "Internal BGP",
      distance: 200,
      description: "Routes from internal BGP peers",
      color: "bg-red-100 text-red-800",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Router className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Routing Tools</h1>
          <p className="text-muted-foreground">
            Configure and generate routing protocols, static routes, and understand administrative distances
          </p>
        </div>
      </div>

      <Tabs defaultValue="ospf" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ospf">OSPF</TabsTrigger>
          <TabsTrigger value="eigrp">EIGRP</TabsTrigger>
          <TabsTrigger value="static">Static Routes</TabsTrigger>
          <TabsTrigger value="admin-distance">Admin Distance</TabsTrigger>
        </TabsList>

        <TabsContent value="ospf" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Router className="w-5 h-5" />
                  OSPF Configuration
                </CardTitle>
                <CardDescription>Generate comprehensive OSPF router configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ospf-process-id">Process ID</Label>
                    <Input
                      id="ospf-process-id"
                      placeholder="1"
                      value={ospfConfig.processId}
                      onChange={(e) => setOspfConfig((prev) => ({ ...prev, processId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ospf-router-id">Router ID</Label>
                    <Input
                      id="ospf-router-id"
                      placeholder="1.1.1.1"
                      value={ospfConfig.routerId}
                      onChange={(e) => setOspfConfig((prev) => ({ ...prev, routerId: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Network Statements</Label>
                    <Button size="sm" variant="outline" onClick={() => addNetwork("ospf")} className="bg-transparent">
                      Add Network
                    </Button>
                  </div>
                  {ospfConfig.networks.map((network, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                      <Input
                        placeholder="192.168.1.0"
                        value={network.address}
                        onChange={(e) => {
                          const newNetworks = [...ospfConfig.networks]
                          newNetworks[index].address = e.target.value
                          setOspfConfig((prev) => ({ ...prev, networks: newNetworks }))
                        }}
                      />
                      <Input
                        placeholder="0.0.0.255"
                        value={network.wildcardMask}
                        onChange={(e) => {
                          const newNetworks = [...ospfConfig.networks]
                          newNetworks[index].wildcardMask = e.target.value
                          setOspfConfig((prev) => ({ ...prev, networks: newNetworks }))
                        }}
                      />
                      <Input
                        placeholder="0"
                        value={network.area}
                        onChange={(e) => {
                          const newNetworks = [...ospfConfig.networks]
                          newNetworks[index].area = e.target.value
                          setOspfConfig((prev) => ({ ...prev, networks: newNetworks }))
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={ospfConfig.redistributeStatic}
                      onCheckedChange={(checked) =>
                        setOspfConfig((prev) => ({ ...prev, redistributeStatic: !!checked }))
                      }
                    />
                    <Label>Redistribute Static Routes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={ospfConfig.redistributeConnected}
                      onCheckedChange={(checked) =>
                        setOspfConfig((prev) => ({ ...prev, redistributeConnected: !!checked }))
                      }
                    />
                    <Label>Redistribute Connected Routes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={ospfConfig.defaultOriginate}
                      onCheckedChange={(checked) => setOspfConfig((prev) => ({ ...prev, defaultOriginate: !!checked }))}
                    />
                    <Label>Default Information Originate</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <ResultCard
                title="Generated OSPF Configuration"
                data={[
                  { label: "Process ID", value: ospfConfig.processId },
                  { label: "Router ID", value: ospfConfig.routerId || "Auto-selected" },
                  {
                    label: "Networks",
                    value: ospfConfig.networks.filter((n) => n.address && n.wildcardMask).length.toString(),
                  },
                ]}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Configuration Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Textarea value={generateOSPFConfig()} readOnly className="font-mono text-sm min-h-[300px]" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 bg-transparent"
                      onClick={() => copyToClipboard(generateOSPFConfig())}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button
                      onClick={() => exportConfig(generateOSPFConfig(), "ospf-config.txt")}
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>OSPF Best Practices:</strong> Use area 0 as backbone, configure router-id manually, and use
              passive-interface for networks that don't need OSPF neighbors.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="eigrp" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  EIGRP Configuration
                </CardTitle>
                <CardDescription>Generate Enhanced Interior Gateway Routing Protocol configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eigrp-as">AS Number</Label>
                    <Input
                      id="eigrp-as"
                      placeholder="100"
                      value={eigrpConfig.asNumber}
                      onChange={(e) => setEigrpConfig((prev) => ({ ...prev, asNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="eigrp-router-id">Router ID</Label>
                    <Input
                      id="eigrp-router-id"
                      placeholder="1.1.1.1"
                      value={eigrpConfig.routerId}
                      onChange={(e) => setEigrpConfig((prev) => ({ ...prev, routerId: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Network Statements</Label>
                    <Button size="sm" variant="outline" onClick={() => addNetwork("eigrp")} className="bg-transparent">
                      Add Network
                    </Button>
                  </div>
                  {eigrpConfig.networks.map((network, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                      <Input
                        placeholder="192.168.1.0"
                        value={network.address}
                        onChange={(e) => {
                          const newNetworks = [...eigrpConfig.networks]
                          newNetworks[index].address = e.target.value
                          setEigrpConfig((prev) => ({ ...prev, networks: newNetworks }))
                        }}
                      />
                      <Input
                        placeholder="0.0.0.255"
                        value={network.wildcardMask}
                        onChange={(e) => {
                          const newNetworks = [...eigrpConfig.networks]
                          newNetworks[index].wildcardMask = e.target.value
                          setEigrpConfig((prev) => ({ ...prev, networks: newNetworks }))
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Variance</Label>
                    <Select
                      value={eigrpConfig.variance}
                      onValueChange={(value) => setEigrpConfig((prev) => ({ ...prev, variance: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 (Default)</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Maximum Paths</Label>
                    <Select
                      value={eigrpConfig.maximumPaths}
                      onValueChange={(value) => setEigrpConfig((prev) => ({ ...prev, maximumPaths: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="4">4 (Default)</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={eigrpConfig.redistributeStatic}
                      onCheckedChange={(checked) =>
                        setEigrpConfig((prev) => ({ ...prev, redistributeStatic: !!checked }))
                      }
                    />
                    <Label>Redistribute Static Routes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={eigrpConfig.redistributeConnected}
                      onCheckedChange={(checked) =>
                        setEigrpConfig((prev) => ({ ...prev, redistributeConnected: !!checked }))
                      }
                    />
                    <Label>Redistribute Connected Routes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={eigrpConfig.autoSummary}
                      onCheckedChange={(checked) => setEigrpConfig((prev) => ({ ...prev, autoSummary: !!checked }))}
                    />
                    <Label>Auto-Summary (Not Recommended)</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <ResultCard
                title="Generated EIGRP Configuration"
                data={[
                  { label: "AS Number", value: eigrpConfig.asNumber || "Not set" },
                  { label: "Router ID", value: eigrpConfig.routerId || "Auto-selected" },
                  {
                    label: "Networks",
                    value: eigrpConfig.networks.filter((n) => n.address && n.wildcardMask).length.toString(),
                  },
                ]}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Configuration Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Textarea value={generateEIGRPConfig()} readOnly className="font-mono text-sm min-h-[300px]" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 bg-transparent"
                      onClick={() => copyToClipboard(generateEIGRPConfig())}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button
                      onClick={() => exportConfig(generateEIGRPConfig(), "eigrp-config.txt")}
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Config
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>EIGRP Best Practices:</strong> Disable auto-summary, use same AS number on all routers, and
              configure authentication for security.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="static" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Static Route Configuration
                </CardTitle>
                <CardDescription>Generate multiple static routes with advanced options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Static Routes</Label>
                  <Button size="sm" variant="outline" onClick={addStaticRoute} className="bg-transparent">
                    Add Route
                  </Button>
                </div>

                {staticRoutes.map((route, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-sm">Destination</Label>
                          <Input
                            placeholder="192.168.2.0"
                            value={route.destination}
                            onChange={(e) => {
                              const newRoutes = [...staticRoutes]
                              newRoutes[index].destination = e.target.value
                              setStaticRoutes(newRoutes)
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Subnet Mask</Label>
                          <Input
                            placeholder="255.255.255.0"
                            value={route.mask}
                            onChange={(e) => {
                              const newRoutes = [...staticRoutes]
                              newRoutes[index].mask = e.target.value
                              setStaticRoutes(newRoutes)
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-sm">Next Hop IP</Label>
                          <Input
                            placeholder="192.168.1.1"
                            value={route.nextHop}
                            onChange={(e) => {
                              const newRoutes = [...staticRoutes]
                              newRoutes[index].nextHop = e.target.value
                              newRoutes[index].interface = ""
                              setStaticRoutes(newRoutes)
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Or Exit Interface</Label>
                          <Input
                            placeholder="GigabitEthernet0/0"
                            value={route.interface}
                            onChange={(e) => {
                              const newRoutes = [...staticRoutes]
                              newRoutes[index].interface = e.target.value
                              newRoutes[index].nextHop = ""
                              setStaticRoutes(newRoutes)
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-sm">Admin Distance</Label>
                          <Select
                            value={route.adminDistance}
                            onValueChange={(value) => {
                              const newRoutes = [...staticRoutes]
                              newRoutes[index].adminDistance = value
                              setStaticRoutes(newRoutes)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 (Default)</SelectItem>
                              <SelectItem value="5">5 (Backup)</SelectItem>
                              <SelectItem value="10">10 (Custom)</SelectItem>
                              <SelectItem value="50">50 (Low Priority)</SelectItem>
                              <SelectItem value="100">100 (Very Low)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm">Track Object</Label>
                          <Input
                            placeholder="100"
                            value={route.track}
                            onChange={(e) => {
                              const newRoutes = [...staticRoutes]
                              newRoutes[index].track = e.target.value
                              setStaticRoutes(newRoutes)
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm">Description</Label>
                        <Input
                          placeholder="Route to branch office"
                          value={route.description}
                          onChange={(e) => {
                            const newRoutes = [...staticRoutes]
                            newRoutes[index].description = e.target.value
                            setStaticRoutes(newRoutes)
                          }}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={route.permanent}
                          onCheckedChange={(checked) => {
                            const newRoutes = [...staticRoutes]
                            newRoutes[index].permanent = !!checked
                            setStaticRoutes(newRoutes)
                          }}
                        />
                        <Label className="text-sm">Permanent Route</Label>
                      </div>
                    </div>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <ResultCard
                title="Static Routes Summary"
                data={[
                  {
                    label: "Total Routes",
                    value: staticRoutes
                      .filter((r) => r.destination && r.mask && (r.nextHop || r.interface))
                      .length.toString(),
                  },
                  {
                    label: "Default Routes",
                    value: staticRoutes
                      .filter((r) => r.destination === "0.0.0.0" && r.mask === "0.0.0.0")
                      .length.toString(),
                  },
                  {
                    label: "Floating Static",
                    value: staticRoutes.filter((r) => Number.parseInt(r.adminDistance) > 1).length.toString(),
                  },
                ]}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Generated Commands</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Textarea value={generateStaticRoutes()} readOnly className="font-mono text-sm min-h-[300px]" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2 bg-transparent"
                      onClick={() => copyToClipboard(generateStaticRoutes())}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <Button
                      onClick={() => exportConfig(generateStaticRoutes(), "static-routes.txt")}
                      variant="outline"
                      className="flex-1 bg-transparent"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Routes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Static Route Tips:</strong> Use 0.0.0.0 0.0.0.0 for default routes, higher AD for backup routes,
              and track objects for high availability.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="admin-distance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Administrative Distance Reference</CardTitle>
              <CardDescription>
                Understanding route preference and administrative distances in Cisco routers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Administrative Distance (AD) determines route preference. Lower values are preferred. When multiple
                    routes to the same destination exist, the route with the lowest AD is installed.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {administrativeDistances.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="font-mono text-base px-3 py-1">
                          {item.distance}
                        </Badge>
                        <div>
                          <p className="font-medium">{item.protocol}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <Badge className={item.color}>
                        {item.distance === 0
                          ? "Highest"
                          : item.distance <= 20
                            ? "High"
                            : item.distance <= 110
                              ? "Medium"
                              : "Low"}{" "}
                        Priority
                      </Badge>
                    </div>
                  ))}
                </div>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Bridge Priority (STP) Reference</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium mb-2">Priority Values</h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Default Priority:</span>
                            <Badge variant="secondary">32768</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Range:</span>
                            <span className="font-mono">0-65535</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Increment:</span>
                            <span className="font-mono">4096</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-medium mb-2">Common Values</h5>
                        <div className="flex flex-wrap gap-1">
                          {[4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768].map((priority) => (
                            <Badge key={priority} variant="outline" className="text-xs">
                              {priority}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-mono">spanning-tree vlan [vlan-id] priority [priority]</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
