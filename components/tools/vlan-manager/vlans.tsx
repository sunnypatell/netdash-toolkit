"use client"

import { useState } from "react"
import { anchorFocus } from "@/lib/focus"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { isReservedVLAN, validateVLAN, VLAN_ID_MAX, VLAN_ID_MIN } from "@/lib/vlan-utils"
import { nextId } from "@/lib/id"
import type { VLANRow } from "./types"

interface VlansPanelProps {
  vlans: VLANRow[]
  onVlansChange: (vlans: VLANRow[]) => void
}

export function VlansPanel({ vlans, onVlansChange }: VlansPanelProps) {
  const [draftId, setDraftId] = useState("")
  const [draftName, setDraftName] = useState("")
  const [draftPurpose, setDraftPurpose] = useState("")
  const [draftDescription, setDraftDescription] = useState("")
  const [subnetDrafts, setSubnetDrafts] = useState<Record<string, string>>({})

  const addVLAN = () => {
    const id = Number.parseInt(draftId, 10)
    const candidate: VLANRow = {
      rowId: nextId("vlan"),
      id,
      name: draftName,
      purpose: draftPurpose || undefined,
      subnets: [],
      description: draftDescription || undefined,
    }

    const validation = validateVLAN(candidate, vlans)
    if (!validation.isValid) {
      toast.error("VLAN validation failed", { description: validation.errors.join(", ") })
      return
    }

    onVlansChange([...vlans, candidate])
    setDraftId("")
    setDraftName("")
    setDraftPurpose("")
    setDraftDescription("")
  }

  const addSubnet = (rowId: string) => {
    const subnet = (subnetDrafts[rowId] ?? "").trim()
    if (!subnet) return
    onVlansChange(
      vlans.map((vlan) =>
        vlan.rowId === rowId ? { ...vlan, subnets: [...vlan.subnets, subnet] } : vlan
      )
    )
    setSubnetDrafts({ ...subnetDrafts, [rowId]: "" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>VLAN Database</CardTitle>
        <CardDescription>
          VLAN IDs {VLAN_ID_MIN} to {VLAN_ID_MAX} are assignable; 0 and 4095 are reserved by IEEE
          802.1Q
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Input
            type="number"
            aria-label="New VLAN ID"
            placeholder="VLAN ID"
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
          />
          <Input
            aria-label="New VLAN name"
            placeholder="VLAN Name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
          />
          <Input
            aria-label="New VLAN purpose"
            placeholder="Purpose"
            value={draftPurpose}
            onChange={(e) => setDraftPurpose(e.target.value)}
          />
          <Input
            aria-label="New VLAN description"
            placeholder="Description"
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
          />
          <Button onClick={addVLAN} disabled={!draftId || !draftName}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add VLAN
          </Button>
        </div>

        <div className="space-y-4" data-focus-anchor tabIndex={-1}>
          {vlans.map((vlan) => (
            <Card key={vlan.rowId} className="p-4">
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
                      <Label htmlFor={`${vlan.rowId}-subnet`} className="text-sm">
                        Subnets:
                      </Label>
                      <Input
                        id={`${vlan.rowId}-subnet`}
                        placeholder="Add subnet (e.g. 192.168.1.0/24)"
                        className="min-w-0 flex-1"
                        value={subnetDrafts[vlan.rowId] ?? ""}
                        onChange={(e) =>
                          setSubnetDrafts({ ...subnetDrafts, [vlan.rowId]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addSubnet(vlan.rowId)
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addSubnet(vlan.rowId)}
                        disabled={!(subnetDrafts[vlan.rowId] ?? "").trim()}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {vlan.subnets.map((subnet, index) => (
                        <Button
                          key={`${subnet}-${index}`}
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            onVlansChange(
                              vlans.map((other) =>
                                other.rowId === vlan.rowId
                                  ? {
                                      ...other,
                                      subnets: other.subnets.filter((_, i) => i !== index),
                                    }
                                  : other
                              )
                            )
                          }
                          aria-label={`Remove subnet ${subnet} from VLAN ${vlan.id}`}
                        >
                          {subnet}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    anchorFocus(event.currentTarget)
                    onVlansChange(vlans.filter((other) => other.rowId !== vlan.rowId))
                  }}
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
  )
}
