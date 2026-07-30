"use client"

import { useMemo } from "react"
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
import { propagationLatency, type DistanceUnit, type Medium } from "@/lib/network-math"

interface LatencyPanelProps {
  distance: string
  unit: DistanceUnit
  medium: Medium
  onDistanceChange: (value: string) => void
  onUnitChange: (value: DistanceUnit) => void
  onMediumChange: (value: Medium) => void
}

const PRESETS = [
  { km: "100", label: "100 km (metro)" },
  { km: "1000", label: "1000 km" },
  { km: "6000", label: "6000 km (US coast to coast)" },
]

export function LatencyPanel({
  distance,
  unit,
  medium,
  onDistanceChange,
  onUnitChange,
  onMediumChange,
}: LatencyPanelProps) {
  const result = useMemo(
    () => propagationLatency(Number.parseFloat(distance), unit, medium),
    [distance, unit, medium]
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Propagation Delay</CardTitle>
          <CardDescription>
            Signal transit time for a distance, at the medium&apos;s velocity factor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label htmlFor="distance">Distance</Label>
              <Input
                id="distance"
                type="number"
                value={distance}
                onChange={(e) => onDistanceChange(e.target.value)}
                min={0}
              />
            </div>
            <div>
              <Label htmlFor="distance-unit">Unit</Label>
              <Select value={unit} onValueChange={(v) => onUnitChange(v as DistanceUnit)}>
                <SelectTrigger id="distance-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">km</SelectItem>
                  <SelectItem value="mi">miles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="medium">Medium</Label>
            <Select value={medium} onValueChange={(v) => onMediumChange(v as Medium)}>
              <SelectTrigger id="medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fiber">Single-mode fibre (0.67 c)</SelectItem>
                <SelectItem value="copper">Copper (0.77 c)</SelectItem>
                <SelectItem value="wireless">Radio through air (0.9997 c)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {PRESETS.map((preset) => (
              <Badge
                key={preset.km}
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  onUnitChange("km")
                  onDistanceChange(preset.km)
                }}
              >
                {preset.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-muted-foreground text-sm">One-Way Delay</p>
                <p className="text-3xl font-bold">{result.oneWayMs.toFixed(3)} ms</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-muted-foreground text-sm">Round-Trip Time (RTT)</p>
                <p className="text-3xl font-bold">{result.roundTripMs.toFixed(3)} ms</p>
              </div>
              <p className="text-muted-foreground text-center text-xs">
                Signal speed: {(result.speedKmPerSecond / 1000).toFixed(2)} km/ms over{" "}
                {result.distanceKm.toFixed(2)} km. Propagation only, excluding serialisation,
                queuing and switching delay.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              Enter a distance greater than zero
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
