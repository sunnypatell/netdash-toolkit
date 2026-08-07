"use client"

import { useMemo } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RefreshCw } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import {
  SPEED_LABELS,
  SPEED_UNITS,
  convertSpeed,
  formatRate,
  type SpeedUnit,
} from "@/lib/bandwidth"
import type { PanelProps } from "@/lib/tool-panel"
import { SpeedUnitSelect } from "./units"

const BIT_UNITS: SpeedUnit[] = ["bps", "Kbps", "Mbps", "Gbps"]
const BYTE_UNITS: SpeedUnit[] = ["Bps", "KBps", "MBps", "GBps"]

export function SpeedConverterPanel({ embedded }: PanelProps) {
  const [query, setQuery] = useQueryStates(
    {
      value: parseAsString.withDefault("100"),
      unit: parseAsStringLiteral(SPEED_UNITS).withDefault("Mbps"),
    },
    { history: "replace" }
  )

  const { value, unit } = query
  const converted = useMemo(() => convertSpeed(value, unit), [value, unit])

  // the rate keys match the other bandwidth panels, so a saved line rate loads
  // into whichever tab you open next
  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const input = data.input as { transferSpeed?: string; transferSpeedUnit?: string } | undefined
    if (!input) return
    void setQuery({
      ...(input.transferSpeed ? { value: input.transferSpeed } : {}),
      ...(input.transferSpeedUnit && SPEED_UNITS.includes(input.transferSpeedUnit as SpeedUnit)
        ? { unit: input.transferSpeedUnit as SpeedUnit }
        : {}),
    })
  }

  const actions = (
    <>
      <LoadFromProject itemType="bandwidth" onLoad={handleLoadFromProject} size="sm" />
      {converted && (
        <SaveToProject
          itemType="bandwidth"
          itemName={`${value} ${SPEED_LABELS[unit]}`}
          itemData={{
            input: { transferSpeed: value, transferSpeedUnit: unit },
            result: converted,
          }}
          toolSource="Bandwidth Calculator"
          size="sm"
        />
      )}
    </>
  )

  return (
    <div className={embedded ? "space-y-4" : "tool-container"}>
      {embedded ? (
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      ) : (
        <ToolHeader
          icon={RefreshCw}
          title="Bandwidth Unit Converter"
          description="Convert between bit and byte rates using the decimal multiples IEEE 802.3 uses"
          actions={actions}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Rate to Convert
            </CardTitle>
            <CardDescription>
              1 kbit/s is exactly 1000 bit/s. Byte rates are the same ladder divided by 8.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="convert-value">Value</Label>
                <Input
                  id="convert-value"
                  type="number"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(event) => void setQuery({ value: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="convert-unit">Unit</Label>
                <SpeedUnitSelect
                  id="convert-unit"
                  value={unit}
                  onChange={(next) => void setQuery({ unit: next })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversions</CardTitle>
          </CardHeader>
          <CardContent aria-live="polite">
            {converted ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Bits per second</h3>
                  <dl className="space-y-2 text-sm">
                    {BIT_UNITS.map((each) => (
                      <div key={each} className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{SPEED_LABELS[each]}</dt>
                        <dd className="font-mono">{formatRate(converted[each])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Bytes per second</h3>
                  <dl className="space-y-2 text-sm">
                    {BYTE_UNITS.map((each) => (
                      <div key={each} className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{SPEED_LABELS[each]}</dt>
                        <dd className="font-mono">{formatRate(converted[each])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Enter a rate of 0 or more to convert</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SpeedConverterPanel
