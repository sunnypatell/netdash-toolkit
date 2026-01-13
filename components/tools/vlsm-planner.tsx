"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network, Plus, Trash2, Download, BarChart3, AlertCircle, CheckCircle } from "lucide-react"
import { IPInput } from "@/components/ui/ip-input"
import { calculateVLSM, generateVLSMHeatmap, exportVLSMPlan } from "@/lib/vlsm-utils"
import type { VLSMRequirement, VLSMPlan } from "@/lib/vlsm-utils"

export function VLSMPlanner() {
  const [baseNetwork, setBaseNetwork] = useState("10.0.0.0")
  const [basePrefix, setBasePrefix] = useState("20")
  const [requirements, setRequirements] = useState<VLSMRequirement[]>([
    { id: "1", name: "Main Office", hostsRequired: 120, description: "Primary office network" },
    { id: "2", name: "Branch Office", hostsRequired: 50, description: "Remote branch office" },
    { id: "3", name: "DMZ", hostsRequired: 10, description: "Demilitarized zone" },
  ])
  const [plan, setPlan] = useState<VLSMPlan | null>(null)
  const [newReqName, setNewReqName] = useState("")
  const [newReqHosts, setNewReqHosts] = useState("")
  const [newReqDesc, setNewReqDesc] = useState("")

  const addRequirement = () => {
    if (!newReqName || !newReqHosts) return

    const hosts = Number.parseInt(newReqHosts)
    if (isNaN(hosts) || hosts <= 0) return

    const newReq: VLSMRequirement = {
      id: Date.now().toString(),
      name: newReqName,
      hostsRequired: hosts,
      description: newReqDesc || undefined,
    }

    setRequirements([...requirements, newReq])
    setNewReqName("")
    setNewReqHosts("")
    setNewReqDesc("")
  }

  const removeRequirement = (id: string) => {
    setRequirements(requirements.filter((req) => req.id !== id))
  }

  const updateRequirement = (id: string, field: keyof VLSMRequirement, value: string | number) => {
    setRequirements(requirements.map((req) => (req.id === id ? { ...req, [field]: value } : req)))
  }

  const calculatePlan = () => {
    const prefix = Number.parseInt(basePrefix)
    if (isNaN(prefix) || prefix < 1 || prefix > 30) {
      return
    }

    const newPlan = calculateVLSM(baseNetwork, prefix, requirements)
    setPlan(newPlan)
  }

  const exportPlan = (format: "csv" | "json" | "text") => {
    if (!plan) return

    const content = exportVLSMPlan(plan, format)
    const mimeTypes = {
      csv: "text/csv",
      json: "application/json",
      text: "text/plain",
    }

    const blob = new Blob([content], { type: mimeTypes[format] })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vlsm-plan.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadSamplePlan = () => {
    try {
      setBaseNetwork("10.0.0.0")
      setBasePrefix("20")
      setRequirements([
        { id: "1", name: "Main Office", hostsRequired: 500, description: "Primary office with 500 users" },
        { id: "2", name: "Branch A", hostsRequired: 120, description: "Branch office A" },
        { id: "3", name: "Branch B", hostsRequired: 50, description: "Branch office B" },
        { id: "4", name: "DMZ", hostsRequired: 10, description: "Web servers and public services" },
        { id: "5", name: "Management", hostsRequired: 5, description: "Network management devices" },
      ])
    } catch (error) {
      console.error("Error loading VLSM sample plan:", error)
    }
  }

  const heatmapData = plan ? generateVLSMHeatmap(plan) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Network className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">VLSM Planner</h1>
            <p className="text-muted-foreground">Plan Variable Length Subnet Masking with optimal allocation</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadSamplePlan}>
            Load Sample
          </Button>
          {plan && (
            <>
              <Button variant="outline" onClick={() => exportPlan("csv")}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" onClick={() => exportPlan("text")}>
                <Download className="w-4 h-4 mr-2" />
                Text
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="planning" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Base Network Configuration</CardTitle>
              <CardDescription>Define the base network that will be subdivided using VLSM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IPInput
                  label="Base Network"
                  placeholder="10.0.0.0"
                  value={baseNetwork}
                  onChange={setBaseNetwork}
                  ipVersion="ipv4"
                />
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefix Length</Label>
                  <Input
                    id="prefix"
                    placeholder="20"
                    value={basePrefix}
                    onChange={(e) => setBasePrefix(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={calculatePlan} className="w-full">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Calculate VLSM
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subnet Requirements</CardTitle>
              <CardDescription>Define the subnets you need and their host requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input placeholder="Subnet name" value={newReqName} onChange={(e) => setNewReqName(e.target.value)} />
                <Input
                  type="number"
                  placeholder="Hosts needed"
                  value={newReqHosts}
                  onChange={(e) => setNewReqHosts(e.target.value)}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newReqDesc}
                  onChange={(e) => setNewReqDesc(e.target.value)}
                />
                <Button onClick={addRequirement} disabled={!newReqName || !newReqHosts}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {requirements.map((req) => (
                  <div key={req.id} className="flex items-center space-x-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        value={req.name}
                        onChange={(e) => updateRequirement(req.id, "name", e.target.value)}
                        placeholder="Subnet name"
                      />
                      <Input
                        type="number"
                        value={req.hostsRequired}
                        onChange={(e) => updateRequirement(req.id, "hostsRequired", Number.parseInt(e.target.value))}
                        placeholder="Hosts needed"
                      />
                      <Input
                        value={req.description || ""}
                        onChange={(e) => updateRequirement(req.id, "description", e.target.value)}
                        placeholder="Description"
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeRequirement(req.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {requirements.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Add subnet requirements to begin VLSM planning.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {plan ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {plan.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span>VLSM Plan Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {plan.success ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{plan.totalHosts}</div>
                        <div className="text-sm text-muted-foreground">Total Hosts</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{plan.allocatedHosts}</div>
                        <div className="text-sm text-muted-foreground">Allocated</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{plan.wastedHosts}</div>
                        <div className="text-sm text-muted-foreground">Wasted</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{plan.utilizationPercent.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Utilization</div>
                      </div>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{plan.errorMessage}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {plan.success && (
                <Card>
                  <CardHeader>
                    <CardTitle>Subnet Allocations</CardTitle>
                    <CardDescription>Detailed breakdown of each subnet allocation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {plan.allocations.map((allocation, index) => (
                        <div key={allocation.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{allocation.name}</h4>
                              <p className="text-sm text-muted-foreground">{allocation.cidr}</p>
                            </div>
                            <div className="flex space-x-2">
                              <Badge variant="secondary">/{allocation.prefix}</Badge>
                              <Badge variant="outline">{allocation.hostsAllocated} hosts</Badge>
                              {allocation.slackHosts > 0 && (
                                <Badge variant="secondary">+{allocation.slackHosts} slack</Badge>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Network:</span>
                              <div className="font-mono">{allocation.network}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">First Host:</span>
                              <div className="font-mono">{allocation.firstHost}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Host:</span>
                              <div className="font-mono">{allocation.lastHost}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Broadcast:</span>
                              <div className="font-mono">{allocation.broadcast}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Configure your base network and requirements, then calculate the VLSM plan.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="visualization" className="space-y-6">
          {plan && plan.success ? (
            <Card>
              <CardHeader>
                <CardTitle>Network Allocation Heatmap</CardTitle>
                <CardDescription>Visual representation of how the base network is subdivided</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative h-16 bg-muted rounded-lg overflow-hidden">
                    {heatmapData.map((segment, index) => (
                      <div
                        key={index}
                        className="absolute top-0 h-full flex items-center justify-center text-white text-xs font-medium"
                        style={{
                          left: `${segment.start}%`,
                          width: `${segment.end - segment.start}%`,
                          backgroundColor: segment.color,
                        }}
                      >
                        {segment.end - segment.start > 10 && segment.name}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {heatmapData.map((segment, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: segment.color }}></div>
                        <span className="text-sm">{segment.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(segment.end - segment.start).toFixed(1)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Generate a successful VLSM plan to view the network visualization.</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>VLSM Algorithm</CardTitle>
          <CardDescription>How the Variable Length Subnet Masking calculation works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Algorithm Steps</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Sort requirements by host count (descending)</li>
                <li>For each requirement, find smallest prefix that fits</li>
                <li>Align subnet to appropriate binary boundary</li>
                <li>Check if allocation fits within base network</li>
                <li>Calculate subnet parameters and move to next block</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Best Practices</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Always plan for future growth (add 20-30% buffer)</li>
                <li>Use hierarchical addressing for routing efficiency</li>
                <li>Reserve space for point-to-point links (/30 or /31)</li>
                <li>Document subnet purposes and contact information</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
