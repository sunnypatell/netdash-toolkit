"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RefreshCw } from "lucide-react"
import { ResultList } from "./result-list"
import type { IPv6Kind } from "@/lib/random-gen"

export const IPV6_KINDS: { id: IPv6Kind; label: string }[] = [
  { id: "global", label: "Global unicast (2000::/3, RFC 4291)" },
  { id: "ula", label: "Unique local (fd00::/8, RFC 4193)" },
  { id: "link-local", label: "Link-local (fe80::/10, RFC 4291)" },
  { id: "documentation", label: "Documentation (2001:db8::/32, RFC 3849)" },
]

interface Ipv6PanelProps {
  kind: IPv6Kind
  count: number
  values: string[]
  onKindChange: (kind: IPv6Kind) => void
  onCountChange: (count: number) => void
  onGenerate: () => void
  onCopy: () => void
  onExport: () => void
  onClear: () => void
}

export function Ipv6Panel({
  kind,
  count,
  values,
  onKindChange,
  onCountChange,
  onGenerate,
  onCopy,
  onExport,
  onClear,
}: Ipv6PanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Random IPv6 addresses</CardTitle>
        <CardDescription>
          Full eight-group form, no compression, so the prefix is always visible. Global unicast
          covers the whole of 2000::/3 rather than only its first eighth.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ipv6-count">Count</Label>
            <Input
              id="ipv6-count"
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => onCountChange(Number.parseInt(e.target.value, 10))}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ipv6-kind">Address type</Label>
            <Select value={kind} onValueChange={(v) => onKindChange(v as IPv6Kind)}>
              <SelectTrigger id="ipv6-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IPV6_KINDS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={onGenerate} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Generate IPv6 addresses
        </Button>

        <ResultList
          kind="IPv6 addresses"
          values={values}
          onCopy={onCopy}
          onExport={onExport}
          onClear={onClear}
        />
      </CardContent>
    </Card>
  )
}
