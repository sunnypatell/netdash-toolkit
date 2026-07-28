"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HardDrive } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { SI_BYTE_UNITS, IEC_BYTE_UNITS } from "@/lib/format"

interface UnitInfo {
  label: string
  fullName: string
  bits: number
}

const BIT_LABELS = ["b", "kb", "Mb", "Gb", "Tb", "Pb"]
const BIT_NAMES = ["Bits", "Kilobits", "Megabits", "Gigabits", "Terabits", "Petabits"]
const SI_BYTE_NAMES = ["Bytes", "Kilobytes", "Megabytes", "Gigabytes", "Terabytes", "Petabytes"]
const IEC_BYTE_NAMES = ["Bytes", "Kibibytes", "Mebibytes", "Gibibytes", "Tebibytes", "Pebibytes"]

// labels come from lib/format so the SI/IEC split stays identical everywhere.
// decimal: bit and byte rungs interleaved so kb/kB sit next to each other.
const DECIMAL_UNITS: UnitInfo[] = SI_BYTE_UNITS.flatMap((byteLabel, i) => [
  { label: BIT_LABELS[i], fullName: BIT_NAMES[i], bits: 1000 ** i },
  { label: byteLabel, fullName: SI_BYTE_NAMES[i], bits: 8 * 1000 ** i },
])

const BINARY_UNITS: UnitInfo[] = IEC_BYTE_UNITS.slice(1).map((label, i) => ({
  label,
  fullName: IEC_BYTE_NAMES[i + 1],
  bits: 8 * 1024 ** (i + 1),
}))

const ALL_UNITS = [...DECIMAL_UNITS, ...BINARY_UNITS]

export function DataUnitConverter() {
  const [value, setValue] = useState("100")
  const [unit, setUnit] = useState("MB")

  const conversions = useMemo(() => {
    const num = parseFloat(value)
    const selected = ALL_UNITS.find((u) => u.label === unit)
    if (isNaN(num) || num < 0 || !selected) return null

    const bits = num * selected.bits

    return new Map(
      ALL_UNITS.map((info) => {
        const converted = bits / info.bits
        return [
          info.label,
          {
            value: converted,
            display:
              converted >= 0.01
                ? converted.toLocaleString(undefined, { maximumFractionDigits: 4 })
                : converted.toExponential(2),
          },
        ]
      })
    )
  }, [value, unit])

  const ResultRow = ({ info }: { info: UnitInfo }) => {
    const result = conversions?.get(info.label)
    if (!result) return null
    return (
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <span className="font-mono font-medium">{result.display}</span>
          <span className="text-muted-foreground ml-2 text-sm">{info.label}</span>
          <p className="text-muted-foreground text-xs">{info.fullName}</p>
        </div>
        <CopyButton value={result.value.toString()} size="sm" />
      </div>
    )
  }

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
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_UNITS.map((info) => (
                    <SelectItem key={info.label} value={info.label}>
                      {info.fullName} ({info.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs">Quick Values</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: "100", u: "MB" },
                  { v: "1", u: "GB" },
                  { v: "4.7", u: "GB" },
                  { v: "100", u: "Mb" },
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
            <CardDescription>Base 10 units (1 kB = 1000 bytes)</CardDescription>
          </CardHeader>
          <CardContent>
            {conversions ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {DECIMAL_UNITS.map((info) => (
                  <ResultRow key={info.label} info={info} />
                ))}
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
              {BINARY_UNITS.map((info) => (
                <ResultRow key={info.label} info={info} />
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
                Used by network speeds and storage manufacturers. 1 kB = 1,000 bytes, 1 MB =
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
