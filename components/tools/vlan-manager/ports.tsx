"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { validateTrunkConfig } from "@/lib/vlan-utils"
import { nextId } from "@/lib/id"
import type { PortRow, VLANRow } from "./types"

interface PortsPanelProps {
  ports: PortRow[]
  vlans: VLANRow[]
  onPortsChange: (ports: PortRow[]) => void
}

export function PortsPanel({ ports, vlans, onPortsChange }: PortsPanelProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [mode, setMode] = useState<"access" | "trunk">("access")
  const [accessVlan, setAccessVlan] = useState("")
  const [allowedVlans, setAllowedVlans] = useState("")
  const [nativeVlan, setNativeVlan] = useState("")

  const addPort = () => {
    if (!name) return

    const candidate: PortRow = {
      rowId: nextId("port"),
      name,
      description: description || undefined,
      mode,
      accessVlan: mode === "access" ? Number.parseInt(accessVlan, 10) || undefined : undefined,
      allowedVlans: mode === "trunk" ? allowedVlans || undefined : undefined,
      nativeVlan: mode === "trunk" ? Number.parseInt(nativeVlan, 10) || undefined : undefined,
    }

    const validation = validateTrunkConfig(candidate, vlans)
    if (!validation.isValid) {
      toast.error("Port validation failed", { description: validation.errors.join(", ") })
      return
    }

    onPortsChange([...ports, candidate])
    setName("")
    setDescription("")
    setAccessVlan("")
    setAllowedVlans("")
    setNativeVlan("")
  }

  return (
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
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            aria-label="New port description"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Select
            value={mode}
            onValueChange={(value: "access" | "trunk") => {
              setMode(value)
              setAccessVlan("")
              setAllowedVlans("")
              setNativeVlan("")
            }}
          >
            <SelectTrigger aria-label="New port mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="access">Access</SelectItem>
              <SelectItem value="trunk">Trunk</SelectItem>
            </SelectContent>
          </Select>

          {mode === "access" ? (
            <Select value={accessVlan} onValueChange={setAccessVlan}>
              <SelectTrigger aria-label="New port access VLAN">
                <SelectValue placeholder="Access VLAN" />
              </SelectTrigger>
              <SelectContent>
                {vlans.map((vlan) => (
                  <SelectItem key={vlan.rowId} value={String(vlan.id)}>
                    {vlan.id} - {vlan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Input
                aria-label="New port allowed VLANs"
                placeholder="Allowed VLANs (e.g. 10,20,30-35)"
                value={allowedVlans}
                onChange={(e) => setAllowedVlans(e.target.value)}
              />
              <Select value={nativeVlan} onValueChange={setNativeVlan}>
                <SelectTrigger aria-label="New port native VLAN">
                  <SelectValue placeholder="Native VLAN" />
                </SelectTrigger>
                <SelectContent>
                  {vlans.map((vlan) => (
                    <SelectItem key={vlan.rowId} value={String(vlan.id)}>
                      {vlan.id} - {vlan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Button onClick={addPort} disabled={!name}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add Port
          </Button>
        </div>

        <div className="space-y-2">
          {ports.map((port) => (
            <div
              key={port.rowId}
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
                  {port.mode === "access" && `Access VLAN: ${port.accessVlan ?? "not set"}`}
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
                onClick={() => onPortsChange(ports.filter((other) => other.rowId !== port.rowId))}
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
  )
}
