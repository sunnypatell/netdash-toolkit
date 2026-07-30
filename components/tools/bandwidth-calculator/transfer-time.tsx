"use client"

import { useMemo } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Clock, Gauge } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { ResultCard } from "@/components/ui/result-card"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { formatBytes } from "@/lib/format"
import {
  LEGACY_SIZE_UNITS,
  SIZE_UNITS,
  SPEED_LABELS,
  SPEED_UNITS,
  computeTransferTime,
  formatRate,
  type SizeUnit,
  type SpeedUnit,
} from "@/lib/bandwidth"
import type { PanelProps } from "@/lib/tool-panel"
import { SizeUnitSelect, SpeedUnitSelect } from "./units"

const SIZE_PRESETS = [
  { label: "1 GB", size: "1", unit: "GB" as SizeUnit },
  { label: "4.7 GB (DVD-5)", size: "4.7", unit: "GB" as SizeUnit },
  { label: "25 GB (BD-25)", size: "25", unit: "GB" as SizeUnit },
  { label: "4 GiB (FAT32 limit)", size: "4", unit: "GiB" as SizeUnit },
  { label: "100 GB", size: "100", unit: "GB" as SizeUnit },
]

// nominal line rates, not measured throughput. the ethernet figures are the
// ieee 802.3 signalling rates; the wi-fi figures are peak phy rates.
const COMMON_SPEEDS = [
  { name: "Dial-up (V.90)", speed: "56", unit: "Kbps" as SpeedUnit },
  { name: "ADSL2+", speed: "24", unit: "Mbps" as SpeedUnit },
  { name: "Fast Ethernet", speed: "100", unit: "Mbps" as SpeedUnit },
  { name: "Gigabit Ethernet", speed: "1", unit: "Gbps" as SpeedUnit },
  { name: "2.5GBASE-T", speed: "2.5", unit: "Gbps" as SpeedUnit },
  { name: "10GBASE-T", speed: "10", unit: "Gbps" as SpeedUnit },
  { name: "25 GbE", speed: "25", unit: "Gbps" as SpeedUnit },
  { name: "100 GbE", speed: "100", unit: "Gbps" as SpeedUnit },
  { name: "Wi-Fi 4, 2 SS 40 MHz", speed: "300", unit: "Mbps" as SpeedUnit },
  { name: "Wi-Fi 5, 2 SS 80 MHz", speed: "867", unit: "Mbps" as SpeedUnit },
  { name: "Wi-Fi 6, 2 SS 80 MHz", speed: "2402", unit: "Mbps" as SpeedUnit },
  { name: "Wi-Fi 7, 2 SS 320 MHz", speed: "5765", unit: "Mbps" as SpeedUnit },
]

export function TransferTimePanel({ embedded }: PanelProps) {
  const [query, setQuery] = useQueryStates(
    {
      size: parseAsString.withDefault("1"),
      sizeUnit: parseAsStringLiteral(SIZE_UNITS).withDefault("GB"),
      speed: parseAsString.withDefault("100"),
      speedUnit: parseAsStringLiteral(SPEED_UNITS).withDefault("Mbps"),
      overhead: parseAsString.withDefault("10"),
    },
    { history: "replace" }
  )

  const { size, sizeUnit, speed, speedUnit, overhead } = query
  const { result, error } = useMemo(
    () => computeTransferTime({ size, sizeUnit, speed, speedUnit, overhead }),
    [size, sizeUnit, speed, speedUnit, overhead]
  )

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const input = data.input as
      | {
          fileSize?: string
          fileSizeUnit?: string
          transferSpeed?: string
          transferSpeedUnit?: string
        }
      | undefined
    if (!input) return
    const unit = input.fileSizeUnit
      ? (LEGACY_SIZE_UNITS[input.fileSizeUnit] ?? (input.fileSizeUnit as SizeUnit))
      : undefined
    void setQuery({
      ...(input.fileSize ? { size: input.fileSize } : {}),
      ...(unit && SIZE_UNITS.includes(unit) ? { sizeUnit: unit } : {}),
      ...(input.transferSpeed ? { speed: input.transferSpeed } : {}),
      ...(input.transferSpeedUnit && SPEED_UNITS.includes(input.transferSpeedUnit as SpeedUnit)
        ? { speedUnit: input.transferSpeedUnit as SpeedUnit }
        : {}),
    })
  }

  const actions = (
    <>
      <LoadFromProject itemType="bandwidth" onLoad={handleLoadFromProject} size="sm" />
      {result && (
        <SaveToProject
          itemType="bandwidth"
          itemName={`${size} ${sizeUnit} at ${speed} ${SPEED_LABELS[speedUnit]}`}
          itemData={{
            input: {
              fileSize: size,
              fileSizeUnit: sizeUnit,
              transferSpeed: speed,
              transferSpeedUnit: speedUnit,
              overhead,
            },
            result,
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
          icon={Clock}
          title="Transfer Time Calculator"
          description="How long a file takes to move at a given line rate, after protocol overhead"
          actions={actions}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Transfer Time
            </CardTitle>
            <CardDescription>
              Decimal units are powers of 1000 (kB, MB); binary units are powers of 1024 (KiB, MiB).
              Bit rates are always decimal, as IEEE 802.3 defines them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="file-size">File Size</Label>
                <Input
                  id="file-size"
                  type="number"
                  min="0"
                  step="any"
                  value={size}
                  onChange={(event) => void setQuery({ size: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="size-unit">Size Unit</Label>
                <SizeUnitSelect
                  id="size-unit"
                  value={sizeUnit}
                  onChange={(unit) => void setQuery({ sizeUnit: unit })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="transfer-speed">Line Rate</Label>
                <Input
                  id="transfer-speed"
                  type="number"
                  min="0"
                  step="any"
                  value={speed}
                  onChange={(event) => void setQuery({ speed: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="speed-unit">Rate Unit</Label>
                <SpeedUnitSelect
                  id="speed-unit"
                  value={speedUnit}
                  onChange={(unit) => void setQuery({ speedUnit: unit })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="overhead">Protocol Overhead (%)</Label>
              <Input
                id="overhead"
                type="number"
                min="0"
                max="99"
                step="any"
                value={overhead}
                onChange={(event) => void setQuery({ overhead: event.target.value })}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                TCP over Ethernet with a 1500 byte MTU carries 1460 payload bytes in a 1538 byte
                frame plus 20 bytes of preamble and gap, so about 5% is lost to framing.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">File Size Presets</p>
              <div className="flex flex-wrap gap-2">
                {SIZE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => void setQuery({ size: preset.size, sizeUnit: preset.unit })}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Common Line Rates</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COMMON_SPEEDS.map((item) => (
                  <Button
                    key={item.name}
                    variant="outline"
                    size="sm"
                    className="h-auto flex-col items-start py-2"
                    onClick={() => void setQuery({ speed: item.speed, speedUnit: item.unit })}
                  >
                    <span className="text-xs font-medium">{item.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {item.speed} {SPEED_LABELS[item.unit]}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div aria-live="polite">
          {result ? (
            <ResultCard
              title="Transfer Time"
              description="Derived from the inputs above, with no calculate step"
              data={[
                { label: "Time Required", value: result.formatted, highlight: true },
                {
                  label: "Total Seconds",
                  value: result.totalSeconds.toLocaleString("en-US", {
                    maximumFractionDigits: 3,
                  }),
                },
                { label: "File Size", value: formatBytes(result.sizeBytes, { binary: false }) },
                {
                  label: "Nominal Rate",
                  value: `${formatRate(result.nominalBitsPerSecond)} bit/s`,
                },
                {
                  label: "Effective Rate After Overhead",
                  value: `${formatRate(result.effectiveBitsPerSecond)} bit/s`,
                },
                {
                  label: "Effective Rate in Bytes",
                  value: `${formatRate(result.effectiveBitsPerSecond / 8)} B/s`,
                },
              ]}
            />
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground flex items-center gap-2 text-center">
                  <Gauge className="h-4 w-4" />
                  Enter a file size and a line rate above 0
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default TransferTimePanel
