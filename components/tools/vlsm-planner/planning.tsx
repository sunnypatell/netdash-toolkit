"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Plus, Trash2 } from "lucide-react"
import { IPInput } from "@/components/ui/ip-input"
import { nextId } from "@/lib/id"
import type { VLSMRequirement } from "@/lib/vlsm-utils"

interface PlanningPanelProps {
  baseNetwork: string
  basePrefix: string
  requirements: VLSMRequirement[]
  onBaseNetworkChange: (value: string) => void
  onBasePrefixChange: (value: string) => void
  onRequirementsChange: (requirements: VLSMRequirement[]) => void
}

export function PlanningPanel({
  baseNetwork,
  basePrefix,
  requirements,
  onBaseNetworkChange,
  onBasePrefixChange,
  onRequirementsChange,
}: PlanningPanelProps) {
  const [draftName, setDraftName] = useState("")
  const [draftHosts, setDraftHosts] = useState("")
  const [draftDescription, setDraftDescription] = useState("")

  const addRequirement = () => {
    const hosts = Number.parseInt(draftHosts, 10)
    if (!draftName || !Number.isInteger(hosts) || hosts <= 0) return

    onRequirementsChange([
      ...requirements,
      {
        id: nextId("vlsm"),
        name: draftName,
        hostsRequired: hosts,
        description: draftDescription || undefined,
      },
    ])
    setDraftName("")
    setDraftHosts("")
    setDraftDescription("")
  }

  const updateRequirement = (id: string, patch: Partial<VLSMRequirement>) => {
    onRequirementsChange(requirements.map((req) => (req.id === id ? { ...req, ...patch } : req)))
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Base Network Configuration</CardTitle>
          <CardDescription>
            The block VLSM subdivides. Results update as you type, so there is nothing to submit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <IPInput
              label="Base Network"
              placeholder="10.0.0.0"
              value={baseNetwork}
              onChange={onBaseNetworkChange}
              ipVersion="ipv4"
            />
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix Length</Label>
              <Input
                id="prefix"
                placeholder="20"
                value={basePrefix}
                onChange={(e) => onBasePrefixChange(e.target.value)}
              />
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input
              aria-label="New subnet name"
              placeholder="Subnet name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <Input
              type="number"
              aria-label="New subnet hosts needed"
              placeholder="Hosts needed"
              value={draftHosts}
              onChange={(e) => setDraftHosts(e.target.value)}
            />
            <Input
              aria-label="New subnet description"
              placeholder="Description (optional)"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
            />
            <Button onClick={addRequirement} disabled={!draftName || !draftHosts}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {requirements.map((req) => (
              <div key={req.id} className="bg-muted/50 flex items-center space-x-4 rounded-lg p-3">
                <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-3">
                  <Input
                    aria-label={`Name for subnet ${req.name || req.id}`}
                    value={req.name}
                    onChange={(e) => updateRequirement(req.id, { name: e.target.value })}
                    placeholder="Subnet name"
                  />
                  <Input
                    type="number"
                    aria-label={`Hosts needed for subnet ${req.name || req.id}`}
                    value={Number.isFinite(req.hostsRequired) ? req.hostsRequired : ""}
                    onChange={(e) =>
                      updateRequirement(req.id, {
                        hostsRequired: Number.parseInt(e.target.value, 10),
                      })
                    }
                    placeholder="Hosts needed"
                  />
                  <Input
                    aria-label={`Description for subnet ${req.name || req.id}`}
                    value={req.description || ""}
                    onChange={(e) => updateRequirement(req.id, { description: e.target.value })}
                    placeholder="Description"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onRequirementsChange(requirements.filter((other) => other.id !== req.id))
                  }
                  aria-label={`Remove subnet requirement ${req.name || req.id}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
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
    </>
  )
}
