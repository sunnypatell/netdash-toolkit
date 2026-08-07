"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle, Info, Radio } from "lucide-react"
import { channelsForBand, type ChannelWidth, type WirelessBand } from "@/lib/wireless"

interface ChannelPlanningPanelProps {
  band: WirelessBand
  width: ChannelWidth
  onBandChange: (band: WirelessBand) => void
  onWidthChange: (width: ChannelWidth) => void
}

export function ChannelPlanningPanel({
  band,
  width,
  onBandChange,
  onWidthChange,
}: ChannelPlanningPanelProps) {
  const channels = channelsForBand(band)
  const fitsWidth = channels.filter((ch) => ch.maxWidth >= width)
  const recommended = fitsWidth.filter((ch) => ch.recommended)
  const acceptable = fitsWidth.filter((ch) => !ch.recommended && ch.interference === "medium")
  const avoid = channels.filter((ch) => ch.interference === "high" || ch.maxWidth < width)
  // the band and the width jointly produce the no-clean-plan error, so both carry it
  const widthTooWideForBand = band === "2.4" && width > 20
  const describedBy = widthTooWideForBand ? "wireless-channel-width-error" : undefined

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" aria-hidden="true" />
              Channel Selection
            </CardTitle>
            <CardDescription>Choose optimal channels to minimize interference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="wireless-band">Frequency Band</Label>
              <Select value={band} onValueChange={(value) => onBandChange(value as WirelessBand)}>
                <SelectTrigger
                  id="wireless-band"
                  aria-invalid={widthTooWideForBand}
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

            <div>
              <Label htmlFor="wireless-channel-width">Channel Width</Label>
              <Select
                value={width.toString()}
                onValueChange={(value) => onWidthChange(Number.parseInt(value, 10) as ChannelWidth)}
              >
                <SelectTrigger
                  id="wireless-channel-width"
                  aria-invalid={widthTooWideForBand}
                  aria-describedby={describedBy}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 MHz</SelectItem>
                  <SelectItem value="40">40 MHz</SelectItem>
                  {(band === "5" || band === "6") && <SelectItem value="80">80 MHz</SelectItem>}
                  {(band === "5" || band === "6") && <SelectItem value="160">160 MHz</SelectItem>}
                  {band === "6" && <SelectItem value="320">320 MHz (WiFi 7)</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                <strong>2.4 GHz:</strong> Use channels 1, 6, 11 to avoid overlap.{" "}
                <strong>5 GHz:</strong> More channels available with less congestion.{" "}
                <strong>6 GHz:</strong> 59 clean channels, requires WiFi 6E/7 devices.
              </AlertDescription>
            </Alert>

            {widthTooWideForBand && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription id="wireless-channel-width-error">
                  2.4 GHz only has 83.5 MHz of spectrum, so a {width} MHz channel leaves no
                  non-overlapping plan. Only one AP can use it without colliding with its
                  neighbours.
                </AlertDescription>
              </Alert>
            )}

            {band === "6" && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <Info className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  <strong>6GHz Band Requirements:</strong> Only WiFi 6E (802.11ax) and WiFi 7
                  (802.11be) devices can connect. Legacy devices will not see this network. 320 MHz
                  channels are exclusive to WiFi 7.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel Recommendations</CardTitle>
            <CardDescription>
              Non-overlapping channels that support a {width} MHz carrier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" aria-live="polite">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                <span className="font-medium">Recommended Channels</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recommended.length === 0 && (
                  <span className="text-muted-foreground text-sm">
                    No channel in this band supports {width} MHz without overlap.
                  </span>
                )}
                {recommended.map((channel) => (
                  <Badge
                    key={channel.channel}
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    {channel.channel} ({channel.frequency} MHz)
                    {channel.dfs && " DFS"}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                <span className="font-medium">Acceptable Channels</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {acceptable.map((channel) => (
                  <Badge
                    key={channel.channel}
                    variant="secondary"
                    className="bg-yellow-100 text-yellow-800"
                  >
                    {channel.channel} ({channel.frequency} MHz)
                    {channel.dfs && " DFS"}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
                <span className="font-medium">Avoid These Channels</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {avoid.map((channel) => (
                  <Badge
                    key={channel.channel}
                    variant="destructive"
                    className="bg-red-100 text-red-800"
                  >
                    {channel.channel} ({channel.frequency} MHz)
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel Overview - {band} GHz Band</CardTitle>
          <CardDescription>Visual representation of channel usage and interference</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <div
                key={channel.channel}
                className={`rounded-lg border p-3 ${
                  channel.recommended
                    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
                    : channel.interference === "high"
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                      : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground font-medium">Channel {channel.channel}</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {/* text badge so "recommended" is not carried by the green tint alone */}
                    {channel.recommended && (
                      <Badge variant="outline" className="text-xs">
                        Recommended
                      </Badge>
                    )}
                    <Badge
                      variant={
                        channel.interference === "low"
                          ? "default"
                          : channel.interference === "medium"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {channel.interference}
                    </Badge>
                    {channel.dfs && (
                      <Badge variant="outline" className="text-xs">
                        DFS
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground text-sm">
                  <p>{channel.frequency} MHz</p>
                  <p>Max channel width: {channel.maxWidth} MHz</p>
                  {channel.note && <p>{channel.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ChannelPlanningPanel
