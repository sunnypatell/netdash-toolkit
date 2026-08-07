"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Textarea } from "@/components/ui/textarea"
import { Download, FileText } from "lucide-react"
import type { ACLPlatform, ACLType } from "@/lib/acl"

const PLATFORM_LABELS: Record<ACLPlatform, string> = {
  "cisco-ios": "Cisco IOS",
  "juniper-junos": "Juniper JunOS",
  "paloalto-panos": "Palo Alto PAN-OS",
}

interface ACLOutputCardProps {
  aclType: ACLType
  platform: ACLPlatform
  config: string
  onExport: () => void
  saveAction?: ReactNode
}

export function ACLOutputCard({
  aclType,
  platform,
  config,
  onExport,
  saveAction,
}: ACLOutputCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" aria-hidden="true" />
          <span>Generated Configuration</span>
        </CardTitle>
        <CardDescription>
          Copy this {aclType} ACL configuration to your {PLATFORM_LABELS[platform]} device
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        <div className="relative">
          <Textarea
            value={config}
            readOnly
            aria-label={`Generated ${aclType} ACL configuration`}
            className="min-h-[400px] font-mono text-sm"
          />
          <CopyButton value={config} variant="outline" className="absolute top-2 right-2" />
        </div>
        <div className="mt-4 flex space-x-2">
          <Button onClick={onExport} variant="outline" className="flex-1">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export
          </Button>
          {saveAction}
        </div>
      </CardContent>
    </Card>
  )
}
