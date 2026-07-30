"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Network, Router, Settings } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { generateSwitchConfig } from "@/lib/vlan-utils"
import type { PortRow, Vendor, VLANRow } from "./types"

interface ConfigPanelProps {
  vlans: VLANRow[]
  ports: PortRow[]
  vendor: Vendor
  onVendorChange: (vendor: Vendor) => void
}

export function ConfigPanel({ vlans, ports, vendor, onVendorChange }: ConfigPanelProps) {
  // derived: the config is a pure function of the vendor, the VLANs and the
  // ports, so a Generate button could only ever produce a stale copy
  const config = useMemo(
    () => generateSwitchConfig(ports, vendor, true, vlans),
    [ports, vendor, vlans]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" aria-hidden="true" />
          <span>Switch Configuration</span>
        </CardTitle>
        <CardDescription>
          Updates as you edit the VLANs and ports; there is nothing to generate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="vlan-config-vendor">Vendor:</Label>
          <Select value={vendor} onValueChange={(value: Vendor) => onVendorChange(value)}>
            <SelectTrigger id="vlan-config-vendor" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cisco-ios">
                <span className="flex items-center space-x-2">
                  <Router className="h-4 w-4" aria-hidden="true" />
                  <span>Cisco IOS</span>
                </span>
              </SelectItem>
              <SelectItem value="aruba-cx">
                <span className="flex items-center space-x-2">
                  <Network className="h-4 w-4" aria-hidden="true" />
                  <span>Aruba CX</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <CopyButton value={config} variant="outline" size="default" />
        </div>

        <div className="space-y-2" aria-live="polite">
          <Label htmlFor="vlan-generated-config">Configuration</Label>
          <Textarea
            id="vlan-generated-config"
            value={config}
            readOnly
            className="min-h-[400px] font-mono text-sm"
          />
        </div>
      </CardContent>
    </Card>
  )
}
