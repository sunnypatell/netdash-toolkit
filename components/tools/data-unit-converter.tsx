"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HardDrive, Copy } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"

type DataUnit = "b" | "B" | "Kb" | "KB" | "Mb" | "MB" | "Gb" | "GB" | "Tb" | "TB" | "Pb" | "PB"
type Base = "binary" | "decimal"

interface UnitInfo {
  label: string
  fullName: string
  bits: number
  base: Base
}

const UNITS: Record<DataUnit, UnitInfo> = {
  b: { label: "b", fullName: "Bits", bits: 1, base: "binary" },
  B: { label: "B", fullName: "Bytes", bits: 8, base: "binary" },
  Kb: { label: "Kb", fullName: "Kilobits", bits: 1000, base: "decimal" },
  KB: { label: "KB", fullName: "Kilobytes", bits: 8000, base: "decimal" },
  Mb: { label: "Mb", fullName: "Megabits", bits: 1000000, base: "decimal" },
  MB: { label: "MB", fullName: "Megabytes", bits: 8000000, base: "decimal" },
  Gb: { label: "Gb", fullName: "Gigabits", bits: 1000000000, base: "decimal" },
  GB: { label: "GB", fullName: "Gigabytes", bits: 8000000000, base: "decimal" },
  Tb: { label: "Tb", fullName: "Terabits", bits: 1000000000000, base: "decimal" },
  TB: { label: "TB", fullName: "Terabytes", bits: 8000000000000, base: "decimal" },
  Pb: { label: "Pb", fullName: "Petabits", bits: 1000000000000000, base: "decimal" },
  PB: { label: "PB", fullName: "Petabytes", bits: 8000000000000000, base: "decimal" },
}

// Binary (IEC) units
const BINARY_UNITS = {
  KiB: { label: "KiB", fullName: "Kibibytes", bits: 8 * 1024 },
  MiB: { label: "MiB", fullName: "Mebibytes", bits: 8 * 1024 * 1024 },
  GiB: { label: "GiB", fullName: "Gibibytes", bits: 8 * 1024 * 1024 * 1024 },
  TiB: { label: "TiB", fullName: "Tebibytes", bits: 8 * 1024 * 1024 * 1024 * 1024 },
  PiB: { label: "PiB", fullName: "Pebibytes", bits: 8 * 1024 * 1024 * 1024 * 1024 * 1024 },
}

export function DataUnitConverter() {
  const { toast } = useToast()
  const [value, setValue] = useState("100")
  const [unit, setUnit] = useState<DataUnit>("MB")

  const conversions = useMemo(() => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return null

    const bits = num * UNITS[unit].bits

    const results: Record<string, { value: number; display: string }> = {}

    // Decimal units
    Object.entries(UNITS).forEach(([key, info]) => {
      const converted = bits / info.bits
      results[key] = {
        value: converted,
        display:
          converted >= 0.01
            ? converted.toLocaleString(undefined, { maximumFractionDigits: 4 })
            : converted.toExponential(2),
      }
    })

    // Binary (IEC) units
    Object.entries(BINARY_UNITS).forEach(([key, info]) => {
      const converted = bits / info.bits
      results[key] = {
        value: converted,
        display:
          converted >= 0.01
            ? converted.toLocaleString(undefined, { maximumFractionDigits: 4 })
            : converted.toExponential(2),
      }
    })

    return results
  }, [value, unit])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Value copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const ResultRow = ({
    label,
    fullName,
    value,
    display,
  }: {
    label: string
    fullName: string
    value: number
    display: string
  }) => (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <span className="font-mono font-medium">{display}</span>
        <span className="text-muted-foreground ml-2 text-sm">{label}</span>
        <p className="text-muted-foreground text-xs">{fullName}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(value.toString())}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={HardDrive}
        title="Data Unit Converter"
        description="Convert between bits, bytes, and all data size units"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter a value to convert</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                min={0}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as DataUnit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b">Bits (b)</SelectItem>
                  <SelectItem value="B">Bytes (B)</SelectItem>
                  <SelectItem value="Kb">Kilobits (Kb)</SelectItem>
                  <SelectItem value="KB">Kilobytes (KB)</SelectItem>
                  <SelectItem value="Mb">Megabits (Mb)</SelectItem>
                  <SelectItem value="MB">Megabytes (MB)</SelectItem>
                  <SelectItem value="Gb">Gigabits (Gb)</SelectItem>
                  <SelectItem value="GB">Gigabytes (GB)</SelectItem>
                  <SelectItem value="Tb">Terabits (Tb)</SelectItem>
                  <SelectItem value="TB">Terabytes (TB)</SelectItem>
                  <SelectItem value="Pb">Petabits (Pb)</SelectItem>
                  <SelectItem value="PB">Petabytes (PB)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs">Quick Values</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: "100", u: "MB" as DataUnit },
                  { v: "1", u: "GB" as DataUnit },
                  { v: "4.7", u: "GB" as DataUnit },
                  { v: "100", u: "Mb" as DataUnit },
                ].map((preset, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => {
                      setValue(preset.v)
                      setUnit(preset.u)
                    }}
                  >
                    {preset.v} {preset.u}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Decimal Units (SI)</CardTitle>
            <CardDescription>Base 10 units (1 KB = 1000 bytes)</CardDescription>
          </CardHeader>
          <CardContent>
            {conversions ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <ResultRow
                  label="b"
                  fullName="Bits"
                  value={conversions.b.value}
                  display={conversions.b.display}
                />
                <ResultRow
                  label="B"
                  fullName="Bytes"
                  value={conversions.B.value}
                  display={conversions.B.display}
                />
                <ResultRow
                  label="Kb"
                  fullName="Kilobits"
                  value={conversions.Kb.value}
                  display={conversions.Kb.display}
                />
                <ResultRow
                  label="KB"
                  fullName="Kilobytes"
                  value={conversions.KB.value}
                  display={conversions.KB.display}
                />
                <ResultRow
                  label="Mb"
                  fullName="Megabits"
                  value={conversions.Mb.value}
                  display={conversions.Mb.display}
                />
                <ResultRow
                  label="MB"
                  fullName="Megabytes"
                  value={conversions.MB.value}
                  display={conversions.MB.display}
                />
                <ResultRow
                  label="Gb"
                  fullName="Gigabits"
                  value={conversions.Gb.value}
                  display={conversions.Gb.display}
                />
                <ResultRow
                  label="GB"
                  fullName="Gigabytes"
                  value={conversions.GB.value}
                  display={conversions.GB.display}
                />
                <ResultRow
                  label="Tb"
                  fullName="Terabits"
                  value={conversions.Tb.value}
                  display={conversions.Tb.display}
                />
                <ResultRow
                  label="TB"
                  fullName="Terabytes"
                  value={conversions.TB.value}
                  display={conversions.TB.display}
                />
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center">Enter a valid value</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Binary Units (IEC)</CardTitle>
          <CardDescription>Base 2 units (1 KiB = 1024 bytes)</CardDescription>
        </CardHeader>
        <CardContent>
          {conversions ? (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-5">
              {Object.entries(BINARY_UNITS).map(([key, info]) => (
                <ResultRow
                  key={key}
                  label={info.label}
                  fullName={info.fullName}
                  value={conversions[key].value}
                  display={conversions[key].display}
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SI vs IEC Units</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">Decimal (SI)</h4>
              <p className="text-muted-foreground text-sm">
                Used by network speeds and storage manufacturers. 1 KB = 1,000 bytes, 1 MB =
                1,000,000 bytes.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Binary (IEC)</h4>
              <p className="text-muted-foreground text-sm">
                Used by operating systems and RAM. 1 KiB = 1,024 bytes, 1 MiB = 1,048,576 bytes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
