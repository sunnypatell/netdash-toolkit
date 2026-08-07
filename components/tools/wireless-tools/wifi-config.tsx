"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Download, Settings } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { dateStamp, downloadTextFile } from "@/lib/download"
import {
  channelsForBand,
  generateWirelessConfig,
  supportsBand,
  type WirelessBand,
  type WirelessConfig,
  type WirelessSecurity,
  type WirelessStandard,
} from "@/lib/wireless"

interface WifiConfigPanelProps {
  config: WirelessConfig
  onConfigChange: (next: WirelessConfig) => void
}

export function WifiConfigPanel({ config, onConfigChange }: WifiConfigPanelProps) {
  const channels = channelsForBand(config.band).filter((channel) => channel.recommended)
  const configText = generateWirelessConfig(config)
  const bandSupported = supportsBand(config.mode, config.band)
  // the mode and the band jointly produce the mismatch, so both carry it
  const bandDescribedBy = bandSupported ? undefined : "wireless-band-support-error"

  const patch = (next: Partial<WirelessConfig>) => onConfigChange({ ...config, ...next })

  const exportConfig = () =>
    downloadTextFile(configText, `wireless-config-${config.ssid || "untitled"}-${dateStamp()}.txt`)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" aria-hidden="true" />
            WiFi Configuration
          </CardTitle>
          <CardDescription>Generate wireless access point configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wireless-ssid">SSID Name</Label>
              <Input
                id="wireless-ssid"
                value={config.ssid}
                onChange={(e) => patch({ ssid: e.target.value })}
                placeholder="MyNetwork"
              />
            </div>
            <div>
              <Label htmlFor="wireless-security">Security Type</Label>
              <Select
                value={config.security}
                onValueChange={(value) => patch({ security: value as WirelessSecurity })}
              >
                <SelectTrigger id="wireless-security">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open (No Security)</SelectItem>
                  <SelectItem value="wep">WEP (Deprecated)</SelectItem>
                  <SelectItem value="wpa">WPA</SelectItem>
                  <SelectItem value="wpa2">WPA2 (Recommended)</SelectItem>
                  <SelectItem value="wpa3">WPA3 (Latest)</SelectItem>
                  <SelectItem value="wpa2-enterprise">WPA2 Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wireless-channel">Channel</Label>
              <Select value={config.channel} onValueChange={(value) => patch({ channel: value })}>
                <SelectTrigger id="wireless-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.channel} value={channel.channel.toString()}>
                      Channel {channel.channel} ({channel.frequency} MHz)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="wireless-power">Transmit Power (%)</Label>
              <Select value={config.power} onValueChange={(value) => patch({ power: value })}>
                <SelectTrigger id="wireless-power">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25% (Low)</SelectItem>
                  <SelectItem value="50">50% (Medium)</SelectItem>
                  <SelectItem value="75">75% (High)</SelectItem>
                  <SelectItem value="100">100% (Maximum)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wireless-band">Frequency Band</Label>
              <Select
                value={config.band}
                onValueChange={(value) => patch({ band: value as WirelessBand, channel: "auto" })}
              >
                <SelectTrigger
                  id="wireless-band"
                  aria-invalid={!bandSupported}
                  aria-describedby={bandDescribedBy}
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
              <Label htmlFor="wireless-mode">WiFi Standard</Label>
              <Select
                value={config.mode}
                onValueChange={(value) => patch({ mode: value as WirelessStandard })}
              >
                <SelectTrigger
                  id="wireless-mode"
                  aria-invalid={!bandSupported}
                  aria-describedby={bandDescribedBy}
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
          </div>

          {!bandSupported && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription id="wireless-band-support-error">
                {config.mode} does not operate in the {config.band} GHz band. Pick a band the
                standard defines.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wireless-config-max-clients">Max Clients</Label>
              <Input
                id="wireless-config-max-clients"
                value={config.maxClients}
                onChange={(e) => patch({ maxClients: e.target.value })}
                placeholder="50"
              />
            </div>
            <div>
              <Label htmlFor="wireless-beacon-interval">Beacon Interval (TU, 1024 us)</Label>
              <Input
                id="wireless-beacon-interval"
                value={config.beaconInterval}
                onChange={(e) => patch({ beaconInterval: e.target.value })}
                placeholder="100"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="wireless-dtim-period">DTIM Period</Label>
            <Input
              id="wireless-dtim-period"
              value={config.dtimPeriod}
              onChange={(e) => patch({ dtimPeriod: e.target.value })}
              placeholder="2"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="wireless-hide-ssid"
              checked={config.hidden}
              onCheckedChange={(checked) => patch({ hidden: !!checked })}
            />
            <Label htmlFor="wireless-hide-ssid">Hide SSID (Not recommended for security)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Configuration</CardTitle>
          <CardDescription>Cisco Aironet autonomous IOS access point configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={configText}
            readOnly
            aria-label="Generated wireless configuration"
            className="min-h-[400px] font-mono text-sm"
          />
          <div className="mt-4 flex space-x-2">
            <CopyButton value={configText} variant="outline" />
            <Button onClick={exportConfig} variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default WifiConfigPanel
