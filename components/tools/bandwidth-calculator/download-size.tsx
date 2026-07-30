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
import { formatBytes } from "@/lib/format"
import { SPEED_UNITS, TIME_UNITS, computeDownloadSize, type TimeUnit } from "@/lib/bandwidth"
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

  return (
    <div className={embedded ? "space-y-4" : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={HardDrive}
          title="Download Size Calculator"
          description="How much data a link can carry in a given time"
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
