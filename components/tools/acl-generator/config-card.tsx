"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, CheckCircle } from "lucide-react"
import { checkACLName, type ACLPlatform, type ACLType } from "@/lib/acl"

interface ACLConfigCardProps {
  aclType: ACLType
  idPrefix: string
  aclName: string
  platform: ACLPlatform
  onAclNameChange: (value: string) => void
  onPlatformChange: (value: ACLPlatform) => void
  onLoadSample: () => void
  onValidate: () => void
}

export function ACLConfigCard({
  aclType,
  idPrefix,
  aclName,
  platform,
  onAclNameChange,
  onPlatformChange,
  onLoadSample,
  onValidate,
}: ACLConfigCardProps) {
  const nameCheck = checkACLName(aclName, aclType)

  return (
    <Card>
      <CardHeader>
        <CardTitle>ACL Configuration</CardTitle>
        <CardDescription>
          {aclType === "standard"
            ? "Standard ACLs filter based on source IP addresses only (1-99, 1300-1999)"
            : "Extended ACLs filter based on source, destination, protocol, and ports (100-199, 2000-2699)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor={`${idPrefix}-name`}>ACL Name/Number</Label>
            <Input
              id={`${idPrefix}-name`}
              value={aclName}
              onChange={(e) => onAclNameChange(e.target.value)}
              placeholder={aclType === "standard" ? "10" : "101"}
              aria-invalid={nameCheck.errors.length > 0}
              aria-describedby={nameCheck.errors.length > 0 ? "acl-name-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-platform`}>Platform</Label>
            <Select
              value={platform}
              onValueChange={(value) => onPlatformChange(value as ACLPlatform)}
            >
              <SelectTrigger id={`${idPrefix}-platform`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cisco-ios">Cisco IOS</SelectItem>
                <SelectItem value="juniper-junos">Juniper JunOS</SelectItem>
                <SelectItem value="paloalto-panos">Palo Alto PAN-OS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {nameCheck.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {/* literal, not idPrefix-scoped: index.tsx mounts one panel at a time */}
            <AlertDescription id="acl-name-error">{nameCheck.errors.join(", ")}</AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-2">
          <Button onClick={onLoadSample} variant="outline" className="flex-1">
            Load Sample Rules
          </Button>
          <Button onClick={onValidate} variant="outline" className="flex-1">
            <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Validate Rules
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
