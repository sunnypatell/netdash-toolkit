"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Router, Network, Settings, Info, Download, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SaveToProject } from "@/components/ui/save-to-project"
import { ResultCard } from "@/components/ui/result-card"
import {
  calculateIPv4Subnet,
  intToIpv4,
  ipv4ToInt,
  isValidIPv4,
  netmaskToPrefix,
  prefixToNetmask,
} from "@/lib/network-utils"

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

interface NetworkStatementEvaluation {
  isValid: boolean
  network?: string
  wildcard?: string
  warnings: string[]
  error?: string
}

interface StaticRouteEvaluation {
  isValid: boolean
  destination?: string
  mask?: string
  nextHop?: string
  exitInterface?: string
  warnings: string[]
  error?: string
}

const evaluateNetworkStatement = (
  address: string,
  wildcardMask?: string
): NetworkStatementEvaluation => {
  const warnings: string[] = []
  const trimmedAddress = address.trim()

  if (!trimmedAddress) {
    return { isValid: false, warnings, error: "Network address is required" }
  }

  if (trimmedAddress.includes("/")) {
    const [ip, prefixStr] = trimmedAddress.split("/")
    const prefix = Number.parseInt(prefixStr ?? "", 10)

    if (!isValidIPv4(ip) || isNaN(prefix) || prefix < 0 || prefix > 32) {
      return { isValid: false, warnings, error: "Invalid CIDR notation" }
    }

    const subnet = calculateIPv4Subnet(ip, prefix)
    if (subnet.network !== ip) {
      warnings.push(`Normalized network to ${subnet.network}/${prefix}`)
    }

    return { isValid: true, network: subnet.network, wildcard: subnet.wildcardMask, warnings }
  }

  if (!isValidIPv4(trimmedAddress)) {
    return { isValid: false, warnings, error: "Invalid IPv4 address" }
  }

  let wildcard = (wildcardMask ?? "").trim()
  if (!wildcard) {
    wildcard = "0.0.0.0"
    warnings.push("Wildcard mask missing; assuming host-specific statement")
  }

  if (!isValidIPv4(wildcard)) {
    return { isValid: false, warnings, error: "Invalid wildcard mask" }
  }

  const wildcardInt = ipv4ToInt(wildcard)
  const netmaskInt = ~wildcardInt >>> 0
  const netmask = intToIpv4(netmaskInt)
  let prefix: number
  try {
    prefix = netmaskToPrefix(netmask)
  } catch (error) {
    return {
      isValid: false,
      warnings,
      error:
        error instanceof Error ? error.message : "Wildcard must translate to a valid subnet mask",
    }
  }

  const normalizedMask = prefixToNetmask(prefix)

  if (ipv4ToInt(normalizedMask) !== netmaskInt) {
    return { isValid: false, warnings, error: "Wildcard must map to a contiguous subnet" }
  }

  const subnet = calculateIPv4Subnet(trimmedAddress, prefix)
  if (subnet.network !== trimmedAddress) {
    warnings.push(`Normalized network to ${subnet.network}/${prefix}`)
  }

  return { isValid: true, network: subnet.network, wildcard: subnet.wildcardMask, warnings }
}

const evaluateStaticRoute = (route: StaticRoute): StaticRouteEvaluation => {
  const warnings: string[] = []
  const destinationInput = route.destination.trim()
  let maskInput = route.mask.trim()
  const nextHopInput = route.nextHop.trim()
  const interfaceInput = route.interface.trim()

  if (!destinationInput) {
    return { isValid: false, warnings, error: "Destination network is required" }
  }

  let destination = destinationInput
  let prefixFromDestination: number | null = null

  if (destination.includes("/")) {
    const [ip, prefixStr] = destination.split("/")
    const prefix = Number.parseInt(prefixStr ?? "", 10)

    if (!isValidIPv4(ip) || isNaN(prefix) || prefix < 0 || prefix > 32) {
      return { isValid: false, warnings, error: "Invalid destination CIDR" }
    }

    const subnet = calculateIPv4Subnet(ip, prefix)
    if (subnet.network !== ip) {
      warnings.push(`Destination normalized to ${subnet.network}/${prefix}`)
    }

    destination = subnet.network
    maskInput = prefixToNetmask(prefix)
    prefixFromDestination = prefix
  } else if (!isValidIPv4(destination)) {
    return { isValid: false, warnings, error: "Invalid destination address" }
  }

  if (!maskInput) {
    if (prefixFromDestination !== null) {
      maskInput = prefixToNetmask(prefixFromDestination)
    } else {
      return { isValid: false, warnings, error: "Subnet mask or prefix is required" }
    }
  }

  let prefix: number
  if (maskInput.includes(".")) {
    if (!isValidIPv4(maskInput)) {
      return { isValid: false, warnings, error: "Invalid subnet mask" }
    }
    try {
      prefix = netmaskToPrefix(maskInput)
    } catch (error) {
      return {
        isValid: false,
        warnings,
        error: error instanceof Error ? error.message : "Subnet mask must have contiguous 1 bits",
      }
    }
  } else {
    const sanitized = maskInput.startsWith("/") ? maskInput.slice(1) : maskInput
    const parsed = Number.parseInt(sanitized, 10)
    if (isNaN(parsed) || parsed < 0 || parsed > 32) {
      return { isValid: false, warnings, error: "Invalid prefix length" }
    }
    prefix = parsed
    maskInput = prefixToNetmask(prefix)
  }

  const subnet = calculateIPv4Subnet(destination, prefix)
  if (subnet.network !== destination) {
    warnings.push(`Destination adjusted to ${subnet.network}/${prefix}`)
    destination = subnet.network
  }

  if (nextHopInput && !isValidIPv4(nextHopInput)) {
    return { isValid: false, warnings, error: "Invalid next-hop address" }
  }

  if (!nextHopInput && !interfaceInput) {
    return { isValid: false, warnings, error: "Specify a next hop or exit interface" }
  }

  return {
    isValid: true,
    destination,
    mask: subnet.netmask,
    nextHop: nextHopInput || undefined,
    exitInterface: interfaceInput || undefined,
    warnings,
  }
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

  const ospfNetworkEvaluations = useMemo(
    () =>
      ospfConfig.networks.map((network) => ({
        raw: network,
        evaluation: evaluateNetworkStatement(network.address, network.wildcardMask),
      })),
    [ospfConfig.networks]
  )

  const eigrpNetworkEvaluations = useMemo(
    () =>
      eigrpConfig.networks.map((network) => ({
        raw: network,
        evaluation: evaluateNetworkStatement(network.address, network.wildcardMask),
      })),
    [eigrpConfig.networks]
  )

  const staticRouteEvaluations = useMemo(
    () => staticRoutes.map((route) => evaluateStaticRoute(route)),
    [staticRoutes]
  )

  const ospfConfigText = useMemo(() => {
    let config = `! OSPF Configuration\n`
    config += `router ospf ${ospfConfig.processId}\n`

    if (ospfConfig.routerId) {
      config += ` router-id ${ospfConfig.routerId}\n`
    }

    if (ospfConfig.defaultOriginate) {
      config += ` default-information originate\n`
    }

    ospfNetworkEvaluations.forEach(({ raw, evaluation }, index) => {
      if (!raw.address) return

      if (!evaluation.isValid || !evaluation.network || !evaluation.wildcard) {
        config += `! Skipped network ${raw.address || `entry ${index + 1}`}: ${evaluation.error || "Invalid definition"}\n`
        return
      }

      evaluation.warnings.forEach((warning) => {
        config += `! Warning [${raw.address || `entry ${index + 1}`}]: ${warning}\n`
      })

      config += ` network ${evaluation.network} ${evaluation.wildcard} area ${raw.area || "0"}\n`
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
  }, [ospfConfig, ospfNetworkEvaluations])

  const eigrpConfigText = useMemo(() => {
    let config = `! EIGRP Configuration\n`
    config += `router eigrp ${eigrpConfig.asNumber}\n`

    if (eigrpConfig.routerId) {
      config += ` eigrp router-id ${eigrpConfig.routerId}\n`
    }

    eigrpNetworkEvaluations.forEach(({ raw, evaluation }, index) => {
      if (!raw.address) return

      if (!evaluation.isValid || !evaluation.network || !evaluation.wildcard) {
        config += `! Skipped network ${raw.address || `entry ${index + 1}`}: ${evaluation.error || "Invalid definition"}\n`
        return
      }

      evaluation.warnings.forEach((warning) => {
        config += `! Warning [${raw.address || `entry ${index + 1}`}]: ${warning}\n`
      })

      config += ` network ${evaluation.network} ${evaluation.wildcard}\n`
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
  }, [eigrpConfig, eigrpNetworkEvaluations])

  const staticConfigText = useMemo(() => {
    let config = `! Static Routes Configuration\n`

    staticRouteEvaluations.forEach((evaluation, index) => {
      const route = staticRoutes[index]
      if (!route) return

      if (!evaluation.isValid || !evaluation.destination || !evaluation.mask) {
        if (route.destination || route.mask) {
          config += `! Skipped static route ${route.destination || `entry ${index + 1}`}: ${
            evaluation.error || "Invalid definition"
          }\n`
        }
        return
      }

      evaluation.warnings.forEach((warning) => {
        config += `! Warning [${route.destination || `entry ${index + 1}`}]: ${warning}\n`
      })

      let routeCmd = `ip route ${evaluation.destination} ${evaluation.mask}`

      if (evaluation.exitInterface) {
        routeCmd += ` ${evaluation.exitInterface}`
      }

      if (evaluation.nextHop) {
        routeCmd += ` ${evaluation.nextHop}`
      }

      const distance = Number.parseInt(route.adminDistance || "1", 10)
      if (!isNaN(distance) && distance !== 1) {
        routeCmd += ` ${distance}`
      }

      if (route.permanent) {
        routeCmd += " permanent"
      }

      if (route.track) {
        routeCmd += ` track ${route.track}`
      }

      config += `${routeCmd}\n`

      if (route.description) {
        config += `! ${route.description}\n`
      }
    })

    return config
  }, [staticRouteEvaluations, staticRoutes])

  const ospfIssues = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []

    ospfNetworkEvaluations.forEach(({ raw, evaluation }, index) => {
      const label = raw.address || `Entry ${index + 1}`
      if (evaluation.error) {
        errors.push(`${label}: ${evaluation.error}`)
      } else if (evaluation.isValid) {
        evaluation.warnings.forEach((warning) => warnings.push(`${label}: ${warning}`))
      }
    })

    return { errors, warnings }
  }, [ospfNetworkEvaluations])

  const eigrpIssues = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []

    eigrpNetworkEvaluations.forEach(({ raw, evaluation }, index) => {
      const label = raw.address || `Entry ${index + 1}`
      if (evaluation.error) {
        errors.push(`${label}: ${evaluation.error}`)
      } else if (evaluation.isValid) {
        evaluation.warnings.forEach((warning) => warnings.push(`${label}: ${warning}`))
      }
    })

    return { errors, warnings }
  }, [eigrpNetworkEvaluations])

  const staticIssues = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []

    staticRouteEvaluations.forEach((evaluation, index) => {
      const label = staticRoutes[index]?.destination || `Route ${index + 1}`
      if (evaluation.error) {
        errors.push(`${label}: ${evaluation.error}`)
      } else if (evaluation.isValid) {
        evaluation.warnings.forEach((warning) => warnings.push(`${label}: ${warning}`))
      }
    })

    return { errors, warnings }
  }, [staticRouteEvaluations, staticRoutes])

  const ospfValidNetworks = ospfNetworkEvaluations.filter(
    (entry) => entry.evaluation.isValid
  ).length
  const eigrpValidNetworks = eigrpNetworkEvaluations.filter(
    (entry) => entry.evaluation.isValid
  ).length
  const validStaticRoutes = staticRouteEvaluations.filter((evaluation) => evaluation.isValid)
  const defaultRouteCount = staticRouteEvaluations.filter(
    (evaluation) =>
      evaluation.isValid && evaluation.destination === "0.0.0.0" && evaluation.mask === "0.0.0.0"
  ).length
  const floatingRouteCount = staticRouteEvaluations.filter((evaluation, index) => {
    if (!evaluation.isValid) return false
    const distance = Number.parseInt(staticRoutes[index].adminDistance || "1", 10)
    return !isNaN(distance) && distance > 1
  }).length

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: "Configuration copied successfully",
    })
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
    {
      protocol: "OSPF",
      distance: 110,
      description: "Open Shortest Path First",
      color: "bg-cyan-100 text-cyan-800",
    },
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
        <Router className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Routing Tools</h1>
          <p className="text-muted-foreground">
            Configure and generate routing protocols, static routes, and understand administrative
            distances
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Router className="h-5 w-5" />
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
                      onChange={(e) =>
                        setOspfConfig((prev) => ({ ...prev, processId: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="ospf-router-id">Router ID</Label>
                    <Input
                      id="ospf-router-id"
                      placeholder="1.1.1.1"
                      value={ospfConfig.routerId}
                      onChange={(e) =>
                        setOspfConfig((prev) => ({ ...prev, routerId: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Network Statements</Label>
                    <Button size="sm" variant="outline" onClick={() => addNetwork("ospf")}>
                      Add Network
                    </Button>
                  </div>
                  {ospfConfig.networks.map((network, index) => (
                    <div key={index} className="mb-2 grid grid-cols-3 gap-2">
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
                      onCheckedChange={(checked) =>
                        setOspfConfig((prev) => ({ ...prev, defaultOriginate: !!checked }))
                      }
                    />
                    <Label>Default Information Originate</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {(ospfIssues.errors.length > 0 || ospfIssues.warnings.length > 0) && (
                <Alert variant={ospfIssues.errors.length ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-1 text-sm">
                    <strong>
                      {ospfIssues.errors.length > 0
                        ? "Resolve the following OSPF validation issues:"
                        : "Review OSPF network warnings:"}
                    </strong>
                    <ul className="list-inside list-disc space-y-1">
                      {(ospfIssues.errors.length > 0 ? ospfIssues.errors : ospfIssues.warnings).map(
                        (item, idx) => (
                          <li key={idx}>{item}</li>
                        )
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <ResultCard
                title="Generated OSPF Configuration"
                data={[
                  { label: "Process ID", value: ospfConfig.processId },
                  { label: "Router ID", value: ospfConfig.routerId || "Auto-selected" },
                  {
                    label: "Valid Networks",
                    value: `${ospfValidNetworks}/${ospfConfig.networks.length}`,
                  },
                ]}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Configuration Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Textarea
                      value={ospfConfigText}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(ospfConfigText)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <Button
                      onClick={() => exportConfig(ospfConfigText, "ospf-config.txt")}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export Config
                    </Button>
                    <SaveToProject
                      itemType="routing"
                      itemName={`OSPF Process ${ospfConfig.processId}`}
                      itemData={{
                        protocol: "ospf",
                        config: ospfConfig,
                        generatedConfig: ospfConfigText,
                      }}
                      toolSource="Routing Tools - OSPF"
                      className="flex-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>OSPF Best Practices:</strong> Use area 0 as backbone, configure router-id
              manually, and use passive-interface for networks that don't need OSPF neighbors.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="eigrp" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  EIGRP Configuration
                </CardTitle>
                <CardDescription>
                  Generate Enhanced Interior Gateway Routing Protocol configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="eigrp-as">AS Number</Label>
                    <Input
                      id="eigrp-as"
                      placeholder="100"
                      value={eigrpConfig.asNumber}
                      onChange={(e) =>
                        setEigrpConfig((prev) => ({ ...prev, asNumber: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="eigrp-router-id">Router ID</Label>
                    <Input
                      id="eigrp-router-id"
                      placeholder="1.1.1.1"
                      value={eigrpConfig.routerId}
                      onChange={(e) =>
                        setEigrpConfig((prev) => ({ ...prev, routerId: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Network Statements</Label>
                    <Button size="sm" variant="outline" onClick={() => addNetwork("eigrp")}>
                      Add Network
                    </Button>
                  </div>
                  {eigrpConfig.networks.map((network, index) => (
                    <div key={index} className="mb-2 grid grid-cols-2 gap-2">
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
                      onValueChange={(value) =>
                        setEigrpConfig((prev) => ({ ...prev, variance: value }))
                      }
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
                      onValueChange={(value) =>
                        setEigrpConfig((prev) => ({ ...prev, maximumPaths: value }))
                      }
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
                      onCheckedChange={(checked) =>
                        setEigrpConfig((prev) => ({ ...prev, autoSummary: !!checked }))
                      }
                    />
                    <Label>Auto-Summary (Not Recommended)</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {(eigrpIssues.errors.length > 0 || eigrpIssues.warnings.length > 0) && (
                <Alert variant={eigrpIssues.errors.length ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-1 text-sm">
                    <strong>
                      {eigrpIssues.errors.length > 0
                        ? "Resolve the following EIGRP validation issues:"
                        : "Review EIGRP network warnings:"}
                    </strong>
                    <ul className="list-inside list-disc space-y-1">
                      {(eigrpIssues.errors.length > 0
                        ? eigrpIssues.errors
                        : eigrpIssues.warnings
                      ).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <ResultCard
                title="Generated EIGRP Configuration"
                data={[
                  { label: "AS Number", value: eigrpConfig.asNumber || "Not set" },
                  { label: "Router ID", value: eigrpConfig.routerId || "Auto-selected" },
                  {
                    label: "Valid Networks",
                    value: `${eigrpValidNetworks}/${eigrpConfig.networks.length}`,
                  },
                ]}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Configuration Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Textarea
                      value={eigrpConfigText}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(eigrpConfigText)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <Button
                      onClick={() => exportConfig(eigrpConfigText, "eigrp-config.txt")}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export Config
                    </Button>
                    <SaveToProject
                      itemType="routing"
                      itemName={`EIGRP AS ${eigrpConfig.asNumber}`}
                      itemData={{
                        protocol: "eigrp",
                        config: eigrpConfig,
                        generatedConfig: eigrpConfigText,
                      }}
                      toolSource="Routing Tools - EIGRP"
                      className="flex-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>EIGRP Best Practices:</strong> Disable auto-summary, use same AS number on all
              routers, and configure authentication for security.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="static" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Static Route Configuration
                </CardTitle>
                <CardDescription>
                  Generate multiple static routes with advanced options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Static Routes</Label>
                  <Button size="sm" variant="outline" onClick={addStaticRoute}>
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
              {(staticIssues.errors.length > 0 || staticIssues.warnings.length > 0) && (
                <Alert variant={staticIssues.errors.length ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-1 text-sm">
                    <strong>
                      {staticIssues.errors.length > 0
                        ? "Resolve the following static route issues before deployment:"
                        : "Static route warnings detected:"}
                    </strong>
                    <ul className="list-inside list-disc space-y-1">
                      {(staticIssues.errors.length > 0
                        ? staticIssues.errors
                        : staticIssues.warnings
                      ).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <ResultCard
                title="Static Routes Summary"
                data={[
                  {
                    label: "Valid Routes",
                    value: `${validStaticRoutes.length}/${staticRoutes.length}`,
                  },
                  { label: "Default Routes", value: defaultRouteCount.toString() },
                  { label: "Floating Static", value: floatingRouteCount.toString() },
                ]}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Generated Commands</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Textarea
                      value={staticConfigText}
                      readOnly
                      className="min-h-[300px] font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(staticConfigText)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <Button
                      onClick={() => exportConfig(staticConfigText, "static-routes.txt")}
                      variant="outline"
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export Routes
                    </Button>
                    <SaveToProject
                      itemType="routing"
                      itemName={`Static Routes (${staticRoutes.length} routes)`}
                      itemData={{
                        protocol: "static",
                        routes: staticRoutes,
                        generatedConfig: staticConfigText,
                      }}
                      toolSource="Routing Tools - Static"
                      className="flex-1"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Static Route Tips:</strong> Use 0.0.0.0 0.0.0.0 for default routes, higher AD
              for backup routes, and track objects for high availability.
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
                    Administrative Distance (AD) determines route preference. Lower values are
                    preferred. When multiple routes to the same destination exist, the route with
                    the lowest AD is installed.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {administrativeDistances.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="px-3 py-1 font-mono text-base">
                          {item.distance}
                        </Badge>
                        <div>
                          <p className="font-medium">{item.protocol}</p>
                          <p className="text-muted-foreground text-sm">{item.description}</p>
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
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <h5 className="mb-2 font-medium">Priority Values</h5>
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
                        <h5 className="mb-2 font-medium">Common Values</h5>
                        <div className="flex flex-wrap gap-1">
                          {[4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768].map(
                            (priority) => (
                              <Badge key={priority} variant="outline" className="text-xs">
                                {priority}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/50 mt-4 rounded-lg p-3">
                      <p className="font-mono text-sm">
                        spanning-tree vlan [vlan-id] priority [priority]
                      </p>
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
