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
import type { IPv4Kind } from "@/lib/random-gen"
import { IPV4_KINDS } from "./kinds"

interface Ipv4PanelProps {
  kind: IPv4Kind
  count: number
  values: string[]
  onKindChange: (kind: IPv4Kind) => void
  onCountChange: (count: number) => void
  onGenerate: () => void
  onExport: () => void
  onClear: () => void
}

export function Ipv4Panel({
  kind,
  count,
  values,
  onKindChange,
  onCountChange,
  onGenerate,
  onExport,
  onClear,
}: Ipv4PanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Random IPv4 addresses</CardTitle>
        <CardDescription>
          Drawn from crypto.getRandomValues. &quot;Public only&quot; resamples until the address is
          outside every block in the IANA IPv4 Special-Purpose Address Registry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ipv4-count">Count</Label>
            <Input
              id="ipv4-count"
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => onCountChange(Number.parseInt(e.target.value, 10))}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ipv4-kind">Address type</Label>
            <Select value={kind} onValueChange={(v) => onKindChange(v as IPv4Kind)}>
              <SelectTrigger id="ipv4-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IPV4_KINDS.map((option) => (
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
          Generate IPv4 addresses
        </Button>

        <ResultList kind="IPv4 addresses" values={values} onExport={onExport} onClear={onClear} />
      </CardContent>
    </Card>
  )
}
