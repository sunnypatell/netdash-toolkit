"use client"

import { useMemo } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { AlertTriangle, HardDrive } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { ResultCard } from "@/components/ui/result-card"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { formatBytes } from "@/lib/format"
import {
  SPEED_LABELS,
  SPEED_UNITS,
  TIME_UNITS,
  computeDownloadSize,
  type SpeedUnit,
  type TimeUnit,
} from "@/lib/bandwidth"
import type { PanelProps } from "@/lib/tool-panel"
import { SpeedUnitSelect } from "./units"

const TIME_LABELS: Record<TimeUnit, string> = {
  seconds: "Seconds",
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
}

export function DownloadSizePanel({ embedded }: PanelProps) {
  const [query, setQuery] = useQueryStates(
    {
      time: parseAsString.withDefault("1"),
      timeUnit: parseAsStringLiteral(TIME_UNITS).withDefault("hours"),
      speed: parseAsString.withDefault("100"),
      speedUnit: parseAsStringLiteral(SPEED_UNITS).withDefault("Mbps"),
    },
    { history: "replace" }
  )

  const { time, timeUnit, speed, speedUnit } = query
  const { result, error } = useMemo(
    () => computeDownloadSize({ time, timeUnit, speed, speedUnit }),
    [time, timeUnit, speed, speedUnit]
  )

  // computeDownloadSize returns one message at a time, so mirror its order to name the field
  const invalidField = error ? (Number(time) > 0 ? "speed" : "time") : null

  // the rate keys match the other bandwidth panels, so a saved line rate loads
  // into whichever tab you open next
  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const input = data.input as
      | { time?: string; timeUnit?: string; transferSpeed?: string; transferSpeedUnit?: string }
      | undefined
    if (!input) return
    void setQuery({
      ...(input.time ? { time: input.time } : {}),
      ...(input.timeUnit && TIME_UNITS.includes(input.timeUnit as TimeUnit)
        ? { timeUnit: input.timeUnit as TimeUnit }
        : {}),
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
          itemName={`${time} ${TIME_LABELS[timeUnit].toLowerCase()} at ${speed} ${SPEED_LABELS[speedUnit]}`}
          itemData={{
            input: {
              time,
              timeUnit,
              transferSpeed: speed,
              transferSpeedUnit: speedUnit,
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
          icon={HardDrive}
          title="Download Size Calculator"
          description="How much data a link can carry in a given time"
          actions={actions}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="download-size-error">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Download Capacity
            </CardTitle>
            <CardDescription>
              Line rate multiplied by time, divided by 8 bits per byte. No overhead is assumed here,
              so this is the theoretical ceiling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="download-time">Time</Label>
                <Input
                  id="download-time"
                  type="number"
                  min="0"
                  step="any"
                  value={time}
                  onChange={(event) => void setQuery({ time: event.target.value })}
                  aria-invalid={invalidField === "time"}
                  aria-describedby={invalidField === "time" ? "download-size-error" : undefined}
                />
              </div>
              <div>
                <Label htmlFor="time-unit">Time Unit</Label>
                <Select
                  value={timeUnit}
                  onValueChange={(next) => void setQuery({ timeUnit: next as TimeUnit })}
                >
                  <SelectTrigger id="time-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {TIME_LABELS[unit]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="download-speed">Line Rate</Label>
                <Input
                  id="download-speed"
                  type="number"
                  min="0"
                  step="any"
                  value={speed}
                  onChange={(event) => void setQuery({ speed: event.target.value })}
                  aria-invalid={invalidField === "speed"}
                  aria-describedby={invalidField === "speed" ? "download-size-error" : undefined}
                />
              </div>
              <div>
                <Label htmlFor="download-speed-unit">Rate Unit</Label>
                <SpeedUnitSelect
                  id="download-speed-unit"
                  value={speedUnit}
                  onChange={(unit) => void setQuery({ speedUnit: unit })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div aria-live="polite">
          {result ? (
            <ResultCard
              title="Download Capacity"
              data={[
                {
                  label: "Maximum Download (decimal)",
                  value: formatBytes(result.totalBytes, { binary: false, decimals: 2 }),
                  highlight: true,
                },
                {
                  label: "Maximum Download (binary)",
                  value: formatBytes(result.totalBytes, { binary: true, decimals: 2 }),
                },
                {
                  label: "In Bytes",
                  value: result.totalBytes.toLocaleString("en-US", { maximumFractionDigits: 0 }),
                },
                {
                  label: "Elapsed Seconds",
                  value: result.seconds.toLocaleString("en-US"),
                },
              ]}
            />
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground text-center">
                  Enter a time and a line rate above 0
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default DownloadSizePanel
