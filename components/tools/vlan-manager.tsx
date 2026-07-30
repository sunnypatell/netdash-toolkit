"use client"

import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Layers,
  Plus,
  Trash2,
  Download,
  Settings,
  AlertTriangle,
  CheckCircle,
  Network,
  Router,
} from "lucide-react"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { CopyButton } from "@/components/ui/copy-button"
import { ToolHeader } from "@/components/ui/tool-header"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { toast } from "sonner"
import type { ProjectItem } from "@/contexts/project-context"
import {
  validateVLAN,
  checkSubnetOverlaps,
  generateSwitchConfig,
  validateTrunkConfig,
  exportVLANsToCSV,
  isReservedVLAN,
} from "@/lib/vlan-utils"
import type { VLAN, SwitchPort } from "@/lib/vlan-utils"

export function VLANManager() {
  const [vlans, setVlans] = useState<VLAN[]>([
    {
      id: 10,
      name: "Management",
      purpose: "Network Management",
      subnets: ["192.168.10.0/24"],
      description: "Management VLAN for network devices",
    },
    {
      id: 20,
      name: "Users",
      purpose: "User Access",
      subnets: ["192.168.20.0/24"],
      description: "User workstations and devices",
    },
    {
      id: 30,
      name: "Servers",
      purpose: "Server Farm",
      subnets: ["192.168.30.0/24"],
      description: "Production servers",
    },
  ])

  const [ports, setPorts] = useState<SwitchPort[]>([
    {
      name: "GigabitEthernet1/0/1",
      description: "User PC",
      mode: "access",
      accessVlan: 20,
    },
    {
      name: "GigabitEthernet1/0/24",
      description: "Trunk to Core Switch",
      mode: "trunk",
      nativeVlan: 10,
      allowedVlans: "10,20,30",
    },
  ])

  const [newVlan, setNewVlan] = useState<Partial<VLAN>>({
    id: undefined,
    name: "",
    purpose: "",
    subnets: [],
    description: "",
  })

  const [newPort, setNewPort] = useState<Partial<SwitchPort>>({
    name: "",
    description: "",
    mode: "access",
    accessVlan: undefined,
    allowedVlans: "",
    nativeVlan: undefined,
  })

  const [selectedVendor, setSelectedVendor] = useState<"cisco-ios" | "aruba-cx">("cisco-ios")
  const [generatedConfig, setGeneratedConfig] = useState("")

  const addVLAN = () => {
    if (!newVlan.id || !newVlan.name) return

    const vlan: VLAN = {
      id: newVlan.id,
      name: newVlan.name,
      purpose: newVlan.purpose || undefined,
      subnets: newVlan.subnets || [],
      description: newVlan.description || undefined,
    }

    const validation = validateVLAN(vlan, vlans)
    if (!validation.isValid) {
      toast.error("VLAN validation failed", { description: validation.errors.join(", ") })
      return
    }

    setVlans([...vlans, vlan])
    setNewVlan({ id: undefined, name: "", purpose: "", subnets: [], description: "" })
  }

  const removeVLAN = (id: number) => {
    setVlans(vlans.filter((v) => v.id !== id))
  }

  const addSubnetToVLAN = (vlanId: number, subnet: string) => {
    setVlans(vlans.map((v) => (v.id === vlanId ? { ...v, subnets: [...v.subnets, subnet] } : v)))
  }

  const removeSubnetFromVLAN = (vlanId: number, subnetIndex: number) => {
    setVlans(
      vlans.map((v) =>
        v.id === vlanId ? { ...v, subnets: v.subnets.filter((_, i) => i !== subnetIndex) } : v
      )
    )
  }

  const addPort = () => {
    if (!newPort.name) return

    const port: SwitchPort = {
      name: newPort.name,
      description: newPort.description || undefined,
      mode: newPort.mode || "access",
      accessVlan: newPort.mode === "access" ? newPort.accessVlan : undefined,
      allowedVlans: newPort.mode === "trunk" ? newPort.allowedVlans : undefined,
      nativeVlan: newPort.mode === "trunk" ? newPort.nativeVlan : undefined,
    }

    const validation = validateTrunkConfig(port, vlans)
    if (!validation.isValid) {
      toast.error("Port validation failed", { description: validation.errors.join(", ") })
      return
    }

    setPorts([...ports, port])
    setNewPort({
      name: "",
      description: "",
      mode: "access",
      accessVlan: undefined,
      allowedVlans: "",
      nativeVlan: undefined,
    })
  }

  const removePort = (index: number) => {
    setPorts(ports.filter((_, i) => i !== index))
  }

  const generateConfig = () => {
    const config = generateSwitchConfig(ports, selectedVendor, true, vlans)
    setGeneratedConfig(config)
  }

  const exportVLANs = () => {
    downloadTextFile(exportVLANsToCSV(vlans), `vlans-${dateStamp()}.csv`, "text/csv")
  }

  const loadSampleConfig = () => {
    try {
      setVlans([
        {
          id: 1,
          name: "Default",
          purpose: "Default VLAN",
          subnets: [],
          description: "Default VLAN - not recommended for use",
        },
        {
          id: 10,
          name: "Management",
          purpose: "Network Management",
          subnets: ["192.168.10.0/24"],
          description: "Management VLAN for network devices",
        },
        {
          id: 20,
          name: "Users",
          purpose: "User Access",
          subnets: ["192.168.20.0/24", "192.168.21.0/24"],
          description: "User workstations and devices",
        },
        {
          id: 30,
          name: "Servers",
          purpose: "Server Farm",
          subnets: ["192.168.30.0/24"],
          description: "Production servers",
        },
        {
          id: 40,
          name: "DMZ",
          purpose: "Demilitarized Zone",
          subnets: ["203.0.113.0/24"],
          description: "Public-facing servers",
        },
        {
          id: 50,
          name: "Guest",
          purpose: "Guest Access",
          subnets: ["192.168.50.0/24"],
          description: "Guest wireless access",
        },
      ])

      setPorts([
        {
          name: "GigabitEthernet1/0/1",
          description: "User PC - Accounting",
          mode: "access",
          accessVlan: 20,
        },
        {
          name: "GigabitEthernet1/0/2",
          description: "User PC - Sales",
          mode: "access",
          accessVlan: 20,
        },
        {
          name: "GigabitEthernet1/0/10",
          description: "Server - Web",
          mode: "access",
          accessVlan: 30,
        },
        {
          name: "GigabitEthernet1/0/11",
          description: "Server - Database",
          mode: "access",
          accessVlan: 30,
        },
        {
          name: "GigabitEthernet1/0/23",
          description: "Trunk to Distribution Switch",
          mode: "trunk",
          nativeVlan: 10,
          allowedVlans: "10,20,30,40",
        },
        {
          name: "GigabitEthernet1/0/24",
          description: "Trunk to Core Switch",
          mode: "trunk",
          nativeVlan: 10,
          allowedVlans: "10,20,30,40,50",
        },
      ])
    } catch (error) {
      console.error("Error loading VLAN sample config:", error)
    }
  }

  const handleLoadFromProject = (data: Record<string, unknown>, item: ProjectItem) => {
    const savedVlans = data.vlans as VLAN[] | undefined
    const savedPorts = data.ports as SwitchPort[] | undefined
    const savedVendor = data.vendor as "cisco-ios" | "aruba-cx" | undefined

    if (savedVlans) {
      setVlans(savedVlans)
    }
    if (savedPorts) {
      setPorts(savedPorts)
    }
    if (savedVendor) {
      setSelectedVendor(savedVendor)
    }
  }

  const overlaps = checkSubnetOverlaps(vlans)

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Layers}
        title="VLAN Manager"
        description="Design and manage VLANs with switch configuration templates"
        actions={
          <>
            <LoadFromProject itemType="vlan" onLoad={handleLoadFromProject} size="sm" />
            <Button variant="outline" size="sm" onClick={loadSampleConfig}>
              <span className="hidden sm:inline">Load </span>Sample
            </Button>
            <Button variant="outline" size="sm" onClick={exportVLANs}>
              <Download className="mr-1 h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export </span>CSV
            </Button>
            {vlans.length > 0 && (
              <SaveToProject
                itemType="vlan"
                itemName={`VLAN Config (${vlans.length} VLANs)`}
                itemData={{
                  vlans,
                  ports,
                  vendor: selectedVendor,
                }}
                toolSource="VLAN Manager"
                size="sm"
              />
            )}
          </>
        }
      />

      {overlaps.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Subnet Overlaps Detected:</strong>{" "}
            {overlaps.map((overlap, i) => (
              <span key={i}>
                {overlap.subnet} is used in both {overlap.vlan1.name} and {overlap.vlan2.name}
                {i < overlaps.length - 1 ? ", " : ""}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="vlans" className="space-y-6">
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:h-10 sm:grid-cols-4 sm:gap-0 sm:p-1">
          <TabsTrigger
            value="vlans"
            className="data-[state=active]:bg-background border-input bg-muted rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            VLANs
          </TabsTrigger>
          <TabsTrigger
            value="ports"
            className="data-[state=active]:bg-background border-input bg-muted rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            Ports
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="data-[state=active]:bg-background border-input bg-muted rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            Config
          </TabsTrigger>
          <TabsTrigger
            value="validation"
            className="data-[state=active]:bg-background border-input bg-muted rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            Validation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vlans" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>VLAN Database</CardTitle>
              <CardDescription>Manage VLANs and their associated subnets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <Input
                  type="number"
                  aria-label="New VLAN ID"
                  placeholder="VLAN ID"
                  value={newVlan.id || ""}
                  onChange={(e) =>
                    setNewVlan({ ...newVlan, id: Number.parseInt(e.target.value) || undefined })
                  }
                />
                <Input
                  aria-label="New VLAN name"
                  placeholder="VLAN Name"
                  value={newVlan.name}
                  onChange={(e) => setNewVlan({ ...newVlan, name: e.target.value })}
                />
                <Input
                  aria-label="New VLAN purpose"
                  placeholder="Purpose"
                  value={newVlan.purpose}
                  onChange={(e) => setNewVlan({ ...newVlan, purpose: e.target.value })}
                />
                <Input
                  aria-label="New VLAN description"
                  placeholder="Description"
                  value={newVlan.description}
                  onChange={(e) => setNewVlan({ ...newVlan, description: e.target.value })}
                />
                <Button onClick={addVLAN} disabled={!newVlan.id || !newVlan.name}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add VLAN
                </Button>
              </div>

              <div className="space-y-4">
                {vlans.map((vlan) => (
                  <Card key={vlan.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <Badge variant={isReservedVLAN(vlan.id) ? "destructive" : "secondary"}>
                            VLAN {vlan.id}
                          </Badge>
                          <h4 className="font-semibold">{vlan.name}</h4>
                          {vlan.purpose && <Badge variant="outline">{vlan.purpose}</Badge>}
                        </div>
                        {vlan.description && (
                          <p className="text-muted-foreground mb-2 text-sm">{vlan.description}</p>
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`vlan-${vlan.id}-subnet`} className="text-sm">
                              Subnets:
                            </Label>
                            <Input
                              id={`vlan-${vlan.id}-subnet`}
                              placeholder="Add subnet (e.g., 192.168.1.0/24)"
                              className="min-w-0 flex-1"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const input = e.target as HTMLInputElement
                                  if (input.value) {
                                    addSubnetToVLAN(vlan.id, input.value)
                                    input.value = ""
                                  }
                                }
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {vlan.subnets.map((subnet, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="cursor-pointer break-all"
                                onClick={() => removeSubnetFromVLAN(vlan.id, index)}
                              >
                                {subnet} ×
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVLAN(vlan.id)}
                        className="shrink-0"
                        aria-label={`Delete VLAN ${vlan.id} ${vlan.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Switch Port Configuration</CardTitle>
              <CardDescription>Configure access and trunk ports for your switches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <Input
                  aria-label="New port interface name"
                  placeholder="Interface name"
                  value={newPort.name}
                  onChange={(e) => setNewPort({ ...newPort, name: e.target.value })}
                />
                <Input
                  aria-label="New port description"
                  placeholder="Description"
                  value={newPort.description}
                  onChange={(e) => setNewPort({ ...newPort, description: e.target.value })}
                />
                <Select
                  value={newPort.mode}
                  onValueChange={(value: "access" | "trunk") =>
                    setNewPort({
                      ...newPort,
                      mode: value,
                      accessVlan: undefined,
                      allowedVlans: "",
                      nativeVlan: undefined,
                    })
                  }
                >
                  <SelectTrigger aria-label="New port mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="access">Access</SelectItem>
                    <SelectItem value="trunk">Trunk</SelectItem>
                  </SelectContent>
                </Select>

                {newPort.mode === "access" ? (
                  <Select
                    value={newPort.accessVlan?.toString()}
                    onValueChange={(value) =>
                      setNewPort({ ...newPort, accessVlan: Number.parseInt(value) })
                    }
                  >
                    <SelectTrigger aria-label="New port access VLAN">
                      <SelectValue placeholder="Access VLAN" />
                    </SelectTrigger>
                    <SelectContent>
                      {vlans.map((vlan) => (
                        <SelectItem key={vlan.id} value={vlan.id.toString()}>
                          {vlan.id} - {vlan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input
                      aria-label="New port allowed VLANs"
                      placeholder="Allowed VLANs (e.g., 10,20,30-35)"
                      value={newPort.allowedVlans}
                      onChange={(e) => setNewPort({ ...newPort, allowedVlans: e.target.value })}
                    />
                    <Select
                      value={newPort.nativeVlan?.toString()}
                      onValueChange={(value) =>
                        setNewPort({ ...newPort, nativeVlan: Number.parseInt(value) })
                      }
                    >
                      <SelectTrigger aria-label="New port native VLAN">
                        <SelectValue placeholder="Native VLAN" />
                      </SelectTrigger>
                      <SelectContent>
                        {vlans.map((vlan) => (
                          <SelectItem key={vlan.id} value={vlan.id.toString()}>
                            {vlan.id} - {vlan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                <Button onClick={addPort} disabled={!newPort.name}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Add Port
                </Button>
              </div>

              <div className="space-y-2">
                {ports.map((port, index) => (
                  <div
                    key={index}
                    className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Badge variant={port.mode === "trunk" ? "secondary" : "outline"}>
                          {port.mode}
                        </Badge>
                        <span className="font-mono text-sm break-all">{port.name}</span>
                        {port.description && (
                          <span className="text-muted-foreground text-sm wrap-break-word">
                            - {port.description}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs break-all">
                        {port.mode === "access" && `Access VLAN: ${port.accessVlan}`}
                        {port.mode === "trunk" && (
                          <>
                            {port.nativeVlan && `Native: ${port.nativeVlan}`}
                            {port.allowedVlans && ` | Allowed: ${port.allowedVlans}`}
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePort(index)}
                      className="shrink-0"
                      aria-label={`Delete port ${port.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Switch Configuration Generator</span>
              </CardTitle>
              <CardDescription>
                Generate switch configuration for Cisco IOS or Aruba CX
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="vlan-config-vendor">Vendor:</Label>
                <Select
                  value={selectedVendor}
                  onValueChange={(value: "cisco-ios" | "aruba-cx") => setSelectedVendor(value)}
                >
                  <SelectTrigger id="vlan-config-vendor" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cisco-ios">
                      <div className="flex items-center space-x-2">
                        <Router className="h-4 w-4" aria-hidden="true" />
                        <span>Cisco IOS</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="aruba-cx">
                      <div className="flex items-center space-x-2">
                        <Network className="h-4 w-4" aria-hidden="true" />
                        <span>Aruba CX</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={generateConfig}>Generate Configuration</Button>
                {generatedConfig && (
                  <CopyButton value={generatedConfig} variant="outline" size="default" />
                )}
              </div>

              {generatedConfig && (
                <div className="space-y-2" aria-live="polite">
                  <Label htmlFor="vlan-generated-config">Generated Configuration:</Label>
                  <Textarea
                    id="vlan-generated-config"
                    value={generatedConfig}
                    readOnly
                    className="min-h-[400px] font-mono text-sm"
                    placeholder="Click 'Generate Configuration' to create switch config"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Validation</CardTitle>
              <CardDescription>Check for configuration issues and best practices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 flex items-center space-x-2 font-semibold">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>VLAN Validation</span>
                  </h4>
                  <div className="space-y-2">
                    {vlans.map((vlan) => {
                      const validation = validateVLAN(
                        vlan,
                        vlans.filter((v) => v.id !== vlan.id)
                      )
                      return (
                        <div
                          key={vlan.id}
                          className="bg-muted/50 flex items-center justify-between gap-2 rounded p-2"
                        >
                          <span className="min-w-0 text-sm wrap-break-word">
                            VLAN {vlan.id} - {vlan.name}
                          </span>
                          {/* the icon colour alone carried pass/fail; name it for screen readers */}
                          <span className="shrink-0">
                            {validation.isValid ? (
                              <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                            )}
                            <span className="sr-only">
                              {validation.isValid ? "Valid" : "Has issues"}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 flex items-center space-x-2 font-semibold">
                    <Settings className="h-4 w-4 text-blue-600" />
                    <span>Port Validation</span>
                  </h4>
                  <div className="space-y-2">
                    {ports.map((port, index) => {
                      const validation = validateTrunkConfig(port, vlans)
                      return (
                        <div
                          key={index}
                          className="bg-muted/50 flex items-center justify-between gap-2 rounded p-2"
                        >
                          <span className="min-w-0 font-mono text-sm break-all">{port.name}</span>
                          <span className="shrink-0">
                            {validation.isValid ? (
                              <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                            )}
                            <span className="sr-only">
                              {validation.isValid ? "Valid" : "Has issues"}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-3 font-semibold">Best Practices</h4>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div>
                    <h5 className="mb-2 font-medium">VLAN Design</h5>
                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                      <li>Use VLAN 1 only for management (if at all)</li>
                      <li>Avoid VLANs 1002-1005 (legacy Token Ring/FDDI)</li>
                      <li>Use descriptive VLAN names</li>
                      <li>Document VLAN purposes and owners</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="mb-2 font-medium">Trunk Configuration</h5>
                    <ul className="text-muted-foreground list-inside list-disc space-y-1">
                      <li>Always specify native VLAN explicitly</li>
                      <li>Limit allowed VLANs to only what's needed</li>
                      <li>Use management VLAN as native VLAN</li>
                      <li>Avoid VLAN 1 as native VLAN</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
