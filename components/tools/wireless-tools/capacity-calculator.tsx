"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Calculator, Info } from "lucide-react"
import { ResultCard } from "@/components/ui/result-card"
import {
  availableWidths,
  calculateWiFiCapacity,
  type ChannelWidth,
  type WirelessBand,
  type WirelessStandard,
} from "@/lib/wireless"

export interface CapacitySettings {
  standard: WirelessStandard
  band: WirelessBand
  width: ChannelWidth
  maxClients: string
  spatialStreams: number
}

interface CapacityCalculatorPanelProps {
  value: CapacitySettings
  onChange: (next: CapacitySettings) => void
}

// keep the selected width inside what the standard/band pair actually offers
function clampWidth(
  standard: WirelessStandard,
  band: WirelessBand,
  width: ChannelWidth
): ChannelWidth {
  const options = availableWidths(standard, band)
  if (options.length === 0 || options.includes(width)) return width
  return options[options.length - 1]
}

export function CapacityCalculatorPanel({ value, onChange }: CapacityCalculatorPanelProps) {
  const widths = availableWidths(value.standard, value.band)
  const capacity = calculateWiFiCapacity({
    standard: value.standard,
    band: value.band,
    width: value.width,
    maxClients: Number.parseInt(value.maxClients, 10),
    spatialStreams: value.spatialStreams,
  })
  // the reason names the standard, the band and sometimes the width, so all three are at fault
  const unsupported = !capacity.supported && Boolean(capacity.reason)
  const describedBy = unsupported ? "wireless-capacity-error" : undefined

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" aria-hidden="true" />
              WiFi Capacity Calculator
            </CardTitle>
            <CardDescription>Calculate theoretical and real-world WiFi performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wireless-capacity-standard">WiFi Standard</Label>
                <Select
                  value={value.standard}
                  onValueChange={(next) => {
                    const standard = next as WirelessStandard
                    onChange({
                      ...value,
                      standard,
                      width: clampWidth(standard, value.band, value.width),
                    })
                  }}
                >
                  <SelectTrigger
                    id="wireless-capacity-standard"
                    aria-invalid={unsupported}
                    aria-describedby={describedBy}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="802.11n">802.11n (WiFi 4)</SelectItem>
                    <SelectItem value="802.11ac">802.11ac (WiFi 5)</SelectItem>
                    <SelectItem value="802.11ax">802.11ax (WiFi 6/6E)</SelectItem>
                    <SelectItem value="802.11be">802.11be (WiFi 7)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wireless-capacity-band">Frequency Band</Label>
                <Select
                  value={value.band}
                  onValueChange={(next) => {
                    const band = next as WirelessBand
                    onChange({
                      ...value,
                      band,
                      width: clampWidth(value.standard, band, value.width),
                    })
                  }}
                >
                  <SelectTrigger
                    id="wireless-capacity-band"
                    aria-invalid={unsupported}
                    aria-describedby={describedBy}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2.4">2.4 GHz</SelectItem>
                    <SelectItem value="5">5 GHz</SelectItem>
                    <SelectItem value="6">6 GHz (WiFi 6E/7)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wireless-capacity-channel-width">Channel Width</Label>
                <Select
                  value={value.width.toString()}
                  onValueChange={(next) =>
                    onChange({ ...value, width: Number.parseInt(next, 10) as ChannelWidth })
                  }
                >
                  <SelectTrigger
                    id="wireless-capacity-channel-width"
                    aria-invalid={unsupported}
                    aria-describedby={describedBy}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {widths.map((width) => (
                      <SelectItem key={width} value={width.toString()}>
                        {width} MHz
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wireless-capacity-streams">Spatial Streams</Label>
                <Select
                  value={value.spatialStreams.toString()}
                  onValueChange={(next) =>
                    onChange({ ...value, spatialStreams: Number.parseInt(next, 10) })
                  }
                >
                  <SelectTrigger id="wireless-capacity-streams">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (1x1)</SelectItem>
                    <SelectItem value="2">2 (2x2)</SelectItem>
                    <SelectItem value="3">3 (3x3)</SelectItem>
                    <SelectItem value="4">4 (4x4)</SelectItem>
                    <SelectItem value="8">8 (8x8)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="wireless-capacity-max-clients">Max Concurrent Clients</Label>
              <Input
                id="wireless-capacity-max-clients"
                value={value.maxClients}
                onChange={(e) => onChange({ ...value, maxClients: e.target.value })}
                placeholder="50"
              />
            </div>

            {unsupported && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription id="wireless-capacity-error">{capacity.reason}.</AlertDescription>
              </Alert>
            )}

            <Alert>
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Rates are the highest data rate the amendment defines for this width and stream
                count. Real-world throughput is typically 50-70% of that once 802.11 overhead,
                interference and retries are accounted for.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* ResultCard already marks its own content aria-live, so no wrapper here */}
          <ResultCard
            title="WiFi Performance Analysis"
            data={[
              {
                label: "Theoretical Speed",
                value: capacity.supported ? `${capacity.theoretical} Mbps` : "Not supported",
                highlight: true,
              },
              {
                label: "Real-World Speed",
                value: capacity.supported ? `${capacity.realWorld} Mbps` : "Not supported",
              },
              {
                label: "Per-Client Speed",
                value: capacity.supported ? `${capacity.perClient} Mbps` : "Not supported",
              },
              { label: "Spatial Streams", value: capacity.spatialStreams.toString() },
              { label: "Max Clients", value: capacity.maxClients.toString() },
            ]}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Factors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h5 className="font-medium">Signal Quality Impact</h5>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <p>• Excellent (-30 to -50 dBm): 100% speed</p>
                  <p>• Good (-50 to -60 dBm): 75-90% speed</p>
                  <p>• Fair (-60 to -70 dBm): 50-75% speed</p>
                  <p>• Poor (-70+ dBm): Less than 50% speed</p>
                </div>
              </div>
              <div>
                <h5 className="font-medium">Interference Sources</h5>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <p>• Other WiFi networks</p>
                  <p>• Microwave ovens (2.4 GHz)</p>
                  <p>• Bluetooth devices</p>
                  <p>• Physical obstacles</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capacity Planning Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-semibold">Client Density Recommendations</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox aria-labelledby="wireless-density-light" />
                  <span id="wireless-density-light" className="text-sm">
                    Light Usage (Email, Web): 50-100 clients/AP
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox aria-labelledby="wireless-density-medium" />
                  <span id="wireless-density-medium" className="text-sm">
                    Medium Usage (Video, VoIP): 25-50 clients/AP
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox aria-labelledby="wireless-density-heavy" />
                  <span id="wireless-density-heavy" className="text-sm">
                    Heavy Usage (Streaming, Gaming): 15-25 clients/AP
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox aria-labelledby="wireless-density-high" />
                  <span id="wireless-density-high" className="text-sm">
                    High Density (Conference): 100+ clients/AP
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="mb-3 font-semibold">Bandwidth Requirements</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span>Email/Web Browsing:</span>
                  <span className="font-mono break-all">1-5 Mbps</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Video Conferencing:</span>
                  <span className="font-mono break-all">2-10 Mbps</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>HD Video Streaming:</span>
                  <span className="font-mono break-all">5-25 Mbps</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>4K Video Streaming:</span>
                  <span className="font-mono break-all">25-50 Mbps</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CapacityCalculatorPanel
