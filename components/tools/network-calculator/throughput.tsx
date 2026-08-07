"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { bandwidthDelay, MAX_SCALED_WINDOW_BYTES } from "@/lib/network-math"

interface ThroughputPanelProps {
  bandwidth: string
  rtt: string
  windowSize: string
  onBandwidthChange: (value: string) => void
  onRttChange: (value: string) => void
  onWindowSizeChange: (value: string) => void
}

export function ThroughputPanel({
  bandwidth,
  rtt,
  windowSize,
  onBandwidthChange,
  onRttChange,
  onWindowSizeChange,
}: ThroughputPanelProps) {
  const result = useMemo(
    () =>
      bandwidthDelay(
        Number.parseFloat(bandwidth),
        Number.parseFloat(rtt),
        Number.parseFloat(windowSize)
      ),
    [bandwidth, rtt, windowSize]
  )

  const windowOutOfRange = Boolean(result?.exceedsMaxWindow)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Bandwidth Delay Product</CardTitle>
          <CardDescription>
            The in-flight bytes a path can hold, and the window it needs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bandwidth">Bandwidth (Mbps)</Label>
            <Input
              id="bandwidth"
              type="number"
              value={bandwidth}
              onChange={(e) => onBandwidthChange(e.target.value)}
              min={0}
            />
          </div>
          <div>
            <Label htmlFor="rtt">Round-Trip Time (ms)</Label>
            <Input
              id="rtt"
              type="number"
              value={rtt}
              onChange={(e) => onRttChange(e.target.value)}
              min={0}
            />
          </div>
          <div>
            <Label htmlFor="windowSize">TCP Window Size (bytes)</Label>
            <Input
              id="windowSize"
              type="number"
              value={windowSize}
              onChange={(e) => onWindowSizeChange(e.target.value)}
              min={0}
              aria-invalid={windowOutOfRange}
              aria-describedby={windowOutOfRange ? "throughput-window-error" : undefined}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              65535 without window scaling. RFC 7323 caps the scale shift at 14, so the ceiling is{" "}
              {MAX_SCALED_WINDOW_BYTES.toLocaleString()} bytes.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-3">
              {result.exceedsMaxWindow && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription id="throughput-window-error">
                    A window above {MAX_SCALED_WINDOW_BYTES.toLocaleString()} bytes is not
                    representable: RFC 7323 section 2.2 limits the window scale shift to 14.
                  </AlertDescription>
                </Alert>
              )}
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">Bandwidth Delay Product</p>
                <p className="font-mono font-medium">
                  {Math.round(result.bdpBytes).toLocaleString()} bytes (
                  {(result.bdpBytes / 1024).toFixed(2)} KiB)
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">Max Throughput (current window)</p>
                <p className="font-mono font-medium">{result.maxThroughputMbps.toFixed(2)} Mbps</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">
                  Window Needed to Fill the Pipe (equals the BDP)
                </p>
                <p className="font-mono font-medium">
                  {Math.round(result.optimalWindowBytes).toLocaleString()} bytes (
                  {(result.optimalWindowBytes / 1024).toFixed(2)} KiB)
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-sm">Link Utilisation</p>
                <p className="font-mono font-medium">{result.efficiencyPercent.toFixed(1)}%</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              Enter a bandwidth, RTT and window above zero
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
