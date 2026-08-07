"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Info, RefreshCw } from "lucide-react"
import { ResultList } from "./result-list"
import type { MacFormat, MacScope } from "@/lib/random-gen"
import { MAC_FORMATS, MAC_SCOPES } from "./kinds"

interface MacPanelProps {
  scope: MacScope
  format: MacFormat
  uppercase: boolean
  count: number
  values: string[]
  onScopeChange: (scope: MacScope) => void
  onFormatChange: (format: MacFormat) => void
  onUppercaseChange: (uppercase: boolean) => void
  onCountChange: (count: number) => void
  onGenerate: () => void
  onExport: () => void
  onClear: () => void
}

export function MacPanel({
  scope,
  format,
  uppercase,
  count,
  values,
  onScopeChange,
  onFormatChange,
  onUppercaseChange,
  onCountChange,
  onGenerate,
  onExport,
  onClear,
}: MacPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Random MAC addresses</CardTitle>
        <CardDescription>
          The first octet carries the I/G and U/L bits described in IEEE Std 802-2014 clause 8.2;
          the remaining 40 bits are drawn from crypto.getRandomValues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mac-count">Count</Label>
            <Input
              id="mac-count"
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => onCountChange(Number.parseInt(e.target.value, 10))}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mac-scope">Address scope</Label>
            <Select value={scope} onValueChange={(v) => onScopeChange(v as MacScope)}>
              <SelectTrigger id="mac-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAC_SCOPES.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mac-format">Notation</Label>
            <Select value={format} onValueChange={(v) => onFormatChange(v as MacFormat)}>
              <SelectTrigger id="mac-format" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAC_FORMATS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end space-x-2 pb-2">
            <Checkbox
              id="mac-uppercase"
              checked={uppercase}
              onCheckedChange={(checked) => onUppercaseChange(checked === true)}
            />
            <Label htmlFor="mac-uppercase" className="cursor-pointer text-sm font-normal">
              Uppercase hex
            </Label>
          </div>
        </div>

        {scope === "universal" && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A universally administered address claims an OUI that belongs to a real manufacturer,
              so it can collide with hardware on the same segment. Prefer a locally administered
              address for anything that touches a live network.
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={onGenerate} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Generate MAC addresses
        </Button>

        <ResultList kind="MAC addresses" values={values} onExport={onExport} onClear={onClear} />
      </CardContent>
    </Card>
  )
}
