"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Settings } from "lucide-react"
import { validateTrunkConfig, validateVLAN, VLAN_TAG_BYTES } from "@/lib/vlan-utils"
import type { VLANValidationResult } from "@/lib/vlan-utils"
import type { PortRow, VLANRow } from "./types"

interface ValidationPanelProps {
  vlans: VLANRow[]
  ports: PortRow[]
}

function IssueList({ label, result }: { label: string; result: VLANValidationResult }) {
  const messages = [...result.errors, ...result.warnings]

  return (
    <div className="bg-muted/50 space-y-1 rounded p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm wrap-break-word">{label}</span>
        {/* the icon colour alone carried pass/fail; name it for screen readers */}
        <span className="shrink-0">
          {result.isValid ? (
            <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
          )}
          <span className="sr-only">{result.isValid ? "Valid" : "Has errors"}</span>
        </span>
      </div>
      {messages.length > 0 && (
        <ul className="text-muted-foreground list-inside list-disc text-xs">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ValidationPanel({ vlans, ports }: ValidationPanelProps) {
  const vlanResults = useMemo(
    () =>
      vlans.map((vlan) => ({
        vlan,
        result: validateVLAN(
          vlan,
          vlans.filter((other) => other.rowId !== vlan.rowId)
        ),
      })),
    [vlans]
  )

  const portResults = useMemo(
    () => ports.map((port) => ({ port, result: validateTrunkConfig(port, vlans) })),
    [ports, vlans]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration Validation</CardTitle>
        <CardDescription>Errors and warnings for every VLAN and port</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-3 flex items-center space-x-2 font-semibold">
              <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
              <span>VLAN Validation</span>
            </h4>
            <div className="space-y-2">
              {vlanResults.map(({ vlan, result }) => (
                <IssueList
                  key={vlan.rowId}
                  label={`VLAN ${vlan.id} - ${vlan.name}`}
                  result={result}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 flex items-center space-x-2 font-semibold">
              <Settings className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>Port Validation</span>
            </h4>
            <div className="space-y-2">
              {portResults.map(({ port, result }) => (
                <IssueList key={port.rowId} label={port.name} result={result} />
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="mb-3 font-semibold">Tag Overhead</h4>
          <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border p-3">
              <Badge className="mb-1">802.1Q</Badge>
              <p className="text-sm">
                {VLAN_TAG_BYTES["802.1Q"]} bytes per frame: 2-byte TPID plus 2-byte TCI carrying the
                3-bit PCP, the DEI bit and the 12-bit VID.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <Badge className="mb-1">802.1ad (QinQ)</Badge>
              <p className="text-sm">
                {VLAN_TAG_BYTES["802.1ad"]} bytes per frame: a 4-byte service tag stacked on the
                4-byte customer tag.
              </p>
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
                <li>Leave VLAN 1 unused rather than carrying production traffic on it</li>
                <li>Avoid VLANs 1002-1005, reserved on Cisco for Token Ring and FDDI</li>
                <li>Names must be a single token: IOS rejects a name with spaces</li>
                <li>Document VLAN purposes and owners</li>
              </ul>
            </div>
            <div>
              <h5 className="mb-2 font-medium">Trunk Configuration</h5>
              <ul className="text-muted-foreground list-inside list-disc space-y-1">
                <li>Always set the native VLAN explicitly</li>
                <li>Prune the allowed list to the VLANs the trunk actually needs</li>
                <li>Keep the native VLAN inside the allowed list or untagged traffic drops</li>
                <li>Never leave VLAN 1 as the native VLAN: it invites VLAN hopping</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
