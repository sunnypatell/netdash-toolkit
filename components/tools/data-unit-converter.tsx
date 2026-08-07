"use client"

import { useMemo } from "react"
import { parseAsString, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HardDrive, Info } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import {
  BINARY_UNITS,
  DATA_UNITS,
  DECIMAL_UNITS,
  DEFAULT_UNIT_ID,
  convertAll,
  exactString,
  findUnit,
  type Conversion,
  type DataUnit,
} from "@/lib/data-units"

const PRESETS = [
  { value: "100", unit: "MB" },
  { value: "1", unit: "GB" },
  { value: "4.7", unit: "GB" },
  { value: "1", unit: "GiB" },
  { value: "100", unit: "Mbit" },
  { value: "1", unit: "Gbit" },
]

function ResultRow({ result }: { result: Conversion }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <div className="min-w-0">
        <span className="font-mono font-medium break-all">{result.display}</span>
        <span className="text-muted-foreground ml-2 font-mono text-sm">{result.unit.symbol}</span>
        <p className="text-muted-foreground text-xs">{result.unit.name}</p>
      </div>
      <CopyButton value={exactString(result.value)} size="sm" />
    </div>
  )
}

function ResultGrid({
  units,
  results,
  className,
}: {
  units: DataUnit[]
  results: Map<string, Conversion>
  className: string
}) {
  return (
    <div className={className}>
      {units.map((unit) => {
        const result = results.get(unit.id)
        return result ? <ResultRow key={unit.id} result={result} /> : null
      })}
    </div>
  )
}

export function DataUnitConverter() {
  const [query, setQuery] = useQueryStates(
    {
      value: parseAsString.withDefault("100"),
      unit: parseAsString.withDefault(DEFAULT_UNIT_ID),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const { value, unit } = query
  const selected = findUnit(unit)

  // pure function of value and unit, so there is nothing for a Convert button to do
  const conversions = useMemo(() => {
    const results = convertAll(Number.parseFloat(value), unit)
    return results === null ? null : new Map(results.map((r) => [r.unit.id, r]))
  }, [value, unit])

  // split by field so each control only claims the message its own value caused
  const invalidUnit = value.trim() !== "" && selected === null
  const invalidValue = value.trim() !== "" && selected !== null && conversions === null

  const error = invalidUnit
    ? `"${unit}" is not a unit this converter knows`
    : invalidValue
      ? "Enter a value of zero or more"
      : ""

  return (
    <div className="tool-container">
      <ToolHeader
        icon={HardDrive}
        title="Data Unit Converter"
        description="Convert between bits and bytes across decimal (SI) and binary (IEC) multiples"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription id="data-unit-converter-error">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Every other unit follows as you type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data-value">Value</Label>
              <Input
                id="data-value"
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setQuery({ value: e.target.value })}
                min={0}
                step="any"
                className="font-mono"
                aria-invalid={invalidValue}
                aria-describedby={invalidValue ? "data-unit-converter-error" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-unit">Unit</Label>
              <Select value={unit} onValueChange={(v) => setQuery({ unit: v })}>
                <SelectTrigger
                  id="data-unit"
                  className="w-full"
                  aria-invalid={invalidUnit}
                  aria-describedby={invalidUnit ? "data-unit-converter-error" : undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectGroup>
                    <SelectLabel>Decimal (SI, powers of 1000)</SelectLabel>
                    {DECIMAL_UNITS.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Binary (IEC, powers of 1024)</SelectLabel>
                    {BINARY_UNITS.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {selected && (
                <p className="text-muted-foreground text-xs">
                  1 {selected.symbol} ={" "}
                  {selected.bits.toLocaleString("en-US", { maximumFractionDigits: 0 })} bit
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs">Quick values</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={`${preset.value}-${preset.unit}`}
                    variant="outline"
                    size="sm"
                    className="font-mono"
                    onClick={() => setQuery({ value: preset.value, unit: preset.unit })}
                  >
                    {preset.value} {preset.unit}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Decimal multiples (SI)</CardTitle>
            <CardDescription>
              Powers of 1000, per IEC 80000-13. 1 kB = 1000 B, 1 kbit = 1000 bit. Network rates and
              drive capacities are quoted this way.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversions ? (
              <ResultGrid
                units={DECIMAL_UNITS}
                results={conversions}
                className="grid grid-cols-1 gap-2 md:grid-cols-2"
              />
            ) : (
              <p className="text-muted-foreground py-8 text-center">Enter a valid value</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Binary multiples (IEC)</CardTitle>
          <CardDescription>
            Powers of 1024. 1 KiB = 1024 B, 1 Kibit = 1024 bit. RAM sizes and most operating system
            file managers report these.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conversions ? (
            <ResultGrid
              units={BINARY_UNITS}
              results={conversions}
              className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5"
            />
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              Enter a valid value to see binary units
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why MB and MiB are different numbers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              A megabyte is 1,000,000 bytes and a mebibyte is 1,048,576 bytes: a 4.9% gap that
              becomes 12.6% at the tebi scale. The bit units are spelled <code>kbit</code> and{" "}
              <code>Kibit</code> rather than <code>kb</code>, because <code>kb</code> and{" "}
              <code>kB</code> differ only by case and an eight-fold error is easy to miss.
            </AlertDescription>
          </Alert>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-2 text-left font-medium">
                    Prefix
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Decimal (SI)
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Binary (IEC)
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((exp) => {
                  const dec = 1000 ** exp
                  const bin = 1024 ** exp
                  const symbols = ["k", "M", "G", "T", "P"]
                  const iec = ["Ki", "Mi", "Gi", "Ti", "Pi"]
                  return (
                    <tr key={exp} className="border-b">
                      <td className="p-2 font-medium">
                        {symbols[exp - 1]} / {iec[exp - 1]}
                      </td>
                      <td className="p-2 font-mono">
                        1 {symbols[exp - 1]}B = {dec.toLocaleString("en-US")} B
                      </td>
                      <td className="p-2 font-mono">
                        1 {iec[exp - 1]}B = {bin.toLocaleString("en-US")} B
                      </td>
                      <td className="p-2 font-mono">+{(((bin - dec) / dec) * 100).toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-xs">
            {DATA_UNITS.length} units, every factor exact: the largest, PiB, is 2^53 bits, which is
            the last integer a double represents without rounding.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
