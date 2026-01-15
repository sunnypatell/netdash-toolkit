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
  Copy,
  Network,
  Router,
} from "lucide-react"
import { SaveToProject } from "@/components/ui/save-to-project"
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
      alert(`VLAN validation failed: ${validation.errors.join(", ")}`)
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
      alert(`Port validation failed: ${validation.errors.join(", ")}`)
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

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(generatedConfig)
    } catch (err) {
      console.error("Failed to copy config:", err)
    }
  }

  const exportVLANs = () => {
    const csv = exportVLANsToCSV(vlans)
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "vlans.csv"
    a.click()
    URL.revokeObjectURL(url)
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

  const overlaps = checkSubnetOverlaps(vlans)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Layers className="text-primary h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">VLAN Manager</h1>
            <p className="text-muted-foreground">
              Design and manage VLANs with switch configuration templates
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadSampleConfig}>
            Load Sample
          </Button>
          <Button variant="outline" onClick={exportVLANs}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
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
            />
          )}
        </div>
      </div>

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vlans">VLANs</TabsTrigger>
          <TabsTrigger value="ports">Switch Ports</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
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
                  placeholder="VLAN ID"
                  value={newVlan.id || ""}
                  onChange={(e) =>
                    setNewVlan({ ...newVlan, id: Number.parseInt(e.target.value) || undefined })
                  }
                />
                <Input
                  placeholder="VLAN Name"
                  value={newVlan.name}
                  onChange={(e) => setNewVlan({ ...newVlan, name: e.target.value })}
                />
                <Input
                  placeholder="Purpose"
                  value={newVlan.purpose}
                  onChange={(e) => setNewVlan({ ...newVlan, purpose: e.target.value })}
                />
                <Input
                  placeholder="Description"
                  value={newVlan.description}
                  onChange={(e) => setNewVlan({ ...newVlan, description: e.target.value })}
                />
                <Button onClick={addVLAN} disabled={!newVlan.id || !newVlan.name}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add VLAN
                </Button>
              </div>

              <div className="space-y-4">
                {vlans.map((vlan) => (
                  <Card key={vlan.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center space-x-3">
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
                            <Label className="text-sm">Subnets:</Label>
                            <Input
                              placeholder="Add subnet (e.g., 192.168.1.0/24)"
                              className="flex-1"
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
                                className="cursor-pointer"
                                onClick={() => removeSubnetFromVLAN(vlan.id, index)}
                              >
                                {subnet} ×
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeVLAN(vlan.id)}>
                        <Trash2 className="h-4 w-4" />
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
                  placeholder="Interface name"
                  value={newPort.name}
                  onChange={(e) => setNewPort({ ...newPort, name: e.target.value })}
                />
                <Input
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
                  <SelectTrigger>
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
                    <SelectTrigger>
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
                      <SelectTrigger>
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
                  <Plus className="mr-2 h-4 w-4" />
                  Add Port
                </Button>
              </div>

              <div className="space-y-2">
                {ports.map((port, index) => (
                  <div
                    key={index}
                    className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Badge variant={port.mode === "trunk" ? "secondary" : "outline"}>
                          {port.mode}
                        </Badge>
                        <span className="font-mono text-sm">{port.name}</span>
                        {port.description && (
                          <span className="text-muted-foreground text-sm">
                            - {port.description}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {port.mode === "access" && `Access VLAN: ${port.accessVlan}`}
                        {port.mode === "trunk" && (
                          <>
                            {port.nativeVlan && `Native: ${port.nativeVlan}`}
                            {port.allowedVlans && ` | Allowed: ${port.allowedVlans}`}
                          </>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removePort(index)}>
                      <Trash2 className="h-4 w-4" />
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
              <div className="flex items-center space-x-4">
                <Label>Vendor:</Label>
                <Select
                  value={selectedVendor}
                  onValueChange={(value: "cisco-ios" | "aruba-cx") => setSelectedVendor(value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cisco-ios">
                      <div className="flex items-center space-x-2">
                        <Router className="h-4 w-4" />
                        <span>Cisco IOS</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="aruba-cx">
                      <div className="flex items-center space-x-2">
                        <Network className="h-4 w-4" />
                        <span>Aruba CX</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={generateConfig}>Generate Configuration</Button>
                {generatedConfig && (
                  <Button variant="outline" onClick={copyConfig}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                )}
              </div>

              {generatedConfig && (
                <div className="space-y-2">
                  <Label>Generated Configuration:</Label>
                  <Textarea
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
                          className="bg-muted/50 flex items-center justify-between rounded p-2"
                        >
                          <span className="text-sm">
                            VLAN {vlan.id} - {vlan.name}
                          </span>
                          {validation.isValid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
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
                          className="bg-muted/50 flex items-center justify-between rounded p-2"
                        >
                          <span className="font-mono text-sm">{port.name}</span>
                          {validation.isValid ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
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
