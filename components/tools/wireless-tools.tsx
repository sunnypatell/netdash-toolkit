"use client"

import { useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Copy,
  Wifi,
  Radio,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  Shield,
  Download,
  Calculator,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ResultCard } from "@/components/ui/result-card"

interface ChannelInfo {
  channel: number
  frequency: number
  bandwidth: number
  interference: "low" | "medium" | "high"
  recommended: boolean
  dfs: boolean
}

interface WirelessConfig {
  ssid: string
  security: "open" | "wep" | "wpa" | "wpa2" | "wpa3" | "wpa2-enterprise"
  channel: string
  bandwidth: "20" | "40" | "80" | "160"
  power: string
  band: "2.4" | "5" | "6"
  mode: "802.11n" | "802.11ac" | "802.11ax"
  hidden: boolean
  maxClients: string
  beaconInterval: string
  dtimPeriod: string
}

export function WirelessTools() {
  const { toast } = useToast()
  const [wirelessConfig, setWirelessConfig] = useState<WirelessConfig>({
    ssid: "MyNetwork",
    security: "wpa2",
    channel: "auto",
    bandwidth: "80",
    power: "100",
    band: "5",
    mode: "802.11ac",
    hidden: false,
    maxClients: "50",
    beaconInterval: "100",
    dtimPeriod: "2",
  })

  const channels24: ChannelInfo[] = [
    {
      channel: 1,
      frequency: 2412,
      bandwidth: 20,
      interference: "medium",
      recommended: true,
      dfs: false,
    },
    {
      channel: 2,
      frequency: 2417,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 3,
      frequency: 2422,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 4,
      frequency: 2427,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 5,
      frequency: 2432,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 6,
      frequency: 2437,
      bandwidth: 20,
      interference: "medium",
      recommended: true,
      dfs: false,
    },
    {
      channel: 7,
      frequency: 2442,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 8,
      frequency: 2447,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 9,
      frequency: 2452,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 10,
      frequency: 2457,
      bandwidth: 20,
      interference: "high",
      recommended: false,
      dfs: false,
    },
    {
      channel: 11,
      frequency: 2462,
      bandwidth: 20,
      interference: "medium",
      recommended: true,
      dfs: false,
    },
    {
      channel: 12,
      frequency: 2467,
      bandwidth: 20,
      interference: "low",
      recommended: false,
      dfs: false,
    },
    {
      channel: 13,
      frequency: 2472,
      bandwidth: 20,
      interference: "low",
      recommended: false,
      dfs: false,
    },
  ]

  const channels5: ChannelInfo[] = [
    {
      channel: 36,
      frequency: 5180,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 40,
      frequency: 5200,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 44,
      frequency: 5220,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 48,
      frequency: 5240,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 52,
      frequency: 5260,
      bandwidth: 80,
      interference: "medium",
      recommended: false,
      dfs: true,
    },
    {
      channel: 56,
      frequency: 5280,
      bandwidth: 80,
      interference: "medium",
      recommended: false,
      dfs: true,
    },
    {
      channel: 60,
      frequency: 5300,
      bandwidth: 80,
      interference: "medium",
      recommended: false,
      dfs: true,
    },
    {
      channel: 64,
      frequency: 5320,
      bandwidth: 80,
      interference: "medium",
      recommended: false,
      dfs: true,
    },
    {
      channel: 100,
      frequency: 5500,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: true,
    },
    {
      channel: 104,
      frequency: 5520,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: true,
    },
    {
      channel: 108,
      frequency: 5540,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: true,
    },
    {
      channel: 112,
      frequency: 5560,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: true,
    },
    {
      channel: 149,
      frequency: 5745,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 153,
      frequency: 5765,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 157,
      frequency: 5785,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 161,
      frequency: 5805,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
    {
      channel: 165,
      frequency: 5825,
      bandwidth: 80,
      interference: "low",
      recommended: true,
      dfs: false,
    },
  ]

  const calculateWiFiCapacity = () => {
    const currentChannels = wirelessConfig.band === "2.4" ? channels24 : channels5
    const selectedChannel = currentChannels.find(
      (ch) => ch.channel.toString() === wirelessConfig.channel
    )

    let theoreticalSpeed = 0
    let realWorldSpeed = 0

    // Calculate theoretical speeds based on standard and bandwidth
    switch (wirelessConfig.mode) {
      case "802.11n":
        theoreticalSpeed =
          wirelessConfig.band === "2.4"
            ? Number.parseInt(wirelessConfig.bandwidth) === 40
              ? 150
              : 72
            : Number.parseInt(wirelessConfig.bandwidth) === 40
              ? 300
              : 150
        break
      case "802.11ac":
        if (wirelessConfig.band === "5") {
          switch (Number.parseInt(wirelessConfig.bandwidth)) {
            case 20:
              theoreticalSpeed = 173
              break
            case 40:
              theoreticalSpeed = 400
              break
            case 80:
              theoreticalSpeed = 867
              break
            case 160:
              theoreticalSpeed = 1733
              break
          }
        }
        break
      case "802.11ax":
        switch (Number.parseInt(wirelessConfig.bandwidth)) {
          case 20:
            theoreticalSpeed = wirelessConfig.band === "2.4" ? 143 : 287
            break
          case 40:
            theoreticalSpeed = wirelessConfig.band === "2.4" ? 287 : 574
            break
          case 80:
            theoreticalSpeed = 1201
            break
          case 160:
            theoreticalSpeed = 2402
            break
        }
        break
    }

    // Real-world is typically 50-70% of theoretical
    realWorldSpeed = Math.round(theoreticalSpeed * 0.6)

    // Calculate per-client speed
    const maxClients = Number.parseInt(wirelessConfig.maxClients) || 50
    const perClientSpeed = Math.round(realWorldSpeed / maxClients)

    return {
      theoretical: theoreticalSpeed,
      realWorld: realWorldSpeed,
      perClient: perClientSpeed,
      maxClients,
      interference: selectedChannel?.interference || "unknown",
    }
  }

  const generateWirelessConfig = () => {
    let config = `! Wireless Configuration - Generated by Network Toolbox\n`
    config += `! SSID: ${wirelessConfig.ssid}\n`
    config += `! Security: ${wirelessConfig.security.toUpperCase()}\n`
    config += `! Band: ${wirelessConfig.band} GHz\n`
    config += `!\n`

    // Basic SSID configuration
    config += `dot11 ssid ${wirelessConfig.ssid}\n`
    config += `   vlan 1\n`
    if (wirelessConfig.hidden) {
      config += `   guest-mode\n`
    }
    config += `   authentication open\n`

    // Security configuration
    switch (wirelessConfig.security) {
      case "wpa2":
        config += `   authentication key-management wpa version 2\n`
        config += `   wpa-psk ascii 0 [YOUR-PASSWORD-HERE]\n`
        break
      case "wpa3":
        config += `   authentication key-management wpa version 3\n`
        config += `   wpa-psk ascii 0 [YOUR-PASSWORD-HERE]\n`
        break
      case "wpa2-enterprise":
        config += `   authentication key-management wpa version 2\n`
        config += `   radius-server host [RADIUS-SERVER-IP] auth-port 1812 acct-port 1813 key [RADIUS-KEY]\n`
        break
    }

    config += `!\n`

    // Radio configuration
    const radioInterface = wirelessConfig.band === "2.4" ? "Dot11Radio0" : "Dot11Radio1"
    config += `interface ${radioInterface}\n`
    config += `   no shutdown\n`
    config += `   ssid ${wirelessConfig.ssid}\n`

    if (wirelessConfig.channel !== "auto") {
      config += `   channel ${wirelessConfig.channel}\n`
    }

    config += `   power local ${wirelessConfig.power}\n`
    config += `   station-role root\n`

    // 802.11 standard configuration
    switch (wirelessConfig.mode) {
      case "802.11n":
        config += `   dot11 extension aironet\n`
        if (Number.parseInt(wirelessConfig.bandwidth) === 40) {
          config += `   channel width 40-above\n`
        }
        break
      case "802.11ac":
        config += `   dot11 ac enable\n`
        config += `   channel width ${wirelessConfig.bandwidth}\n`
        break
      case "802.11ax":
        config += `   dot11 ax enable\n`
        config += `   channel width ${wirelessConfig.bandwidth}\n`
        break
    }

    // Advanced settings
    config += `   beacon period ${wirelessConfig.beaconInterval}\n`
    config += `   dtim-period ${wirelessConfig.dtimPeriod}\n`
    config += `   rts threshold 2347\n`
    config += `   fragmentation-threshold 2346\n`

    if (wirelessConfig.maxClients !== "50") {
      config += `   max-associations ${wirelessConfig.maxClients}\n`
    }

    config += `!\n`
    config += `! Apply to bridge group\n`
    config += `interface ${radioInterface}.1\n`
    config += `   encapsulation dot1Q 1 native\n`
    config += `   bridge-group 1\n`
    config += `!\n`
    config += `bridge 1 protocol ieee\n`
    config += `bridge 1 route ip\n`

    return config
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied to clipboard",
        description: "Configuration copied successfully",
      })
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const exportConfig = () => {
    const config = generateWirelessConfig()
    const blob = new Blob([config], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `wireless-config-${wirelessConfig.ssid}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentChannels = wirelessConfig.band === "2.4" ? channels24 : channels5
  const recommended = currentChannels.filter((ch) => ch.recommended && ch.interference === "low")
  const acceptable = currentChannels.filter((ch) => ch.interference === "medium")
  const avoid = currentChannels.filter((ch) => ch.interference === "high")
  const capacityData = calculateWiFiCapacity()

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Wifi className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Wireless Tools</h1>
          <p className="text-muted-foreground">
            Plan wireless channels, calculate capacity, and generate WiFi configurations
          </p>
        </div>
      </div>

      <Tabs defaultValue="channel-planning" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="channel-planning">Channel Planning</TabsTrigger>
          <TabsTrigger value="capacity-calculator">Capacity Calculator</TabsTrigger>
          <TabsTrigger value="wifi-config">WiFi Config</TabsTrigger>
          <TabsTrigger value="security">Security Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="channel-planning" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" />
                  Channel Selection
                </CardTitle>
                <CardDescription>Choose optimal channels to minimize interference</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Frequency Band</Label>
                  <Select
                    value={wirelessConfig.band}
                    onValueChange={(value) =>
                      setWirelessConfig((prev) => ({ ...prev, band: value as "2.4" | "5" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2.4">2.4 GHz</SelectItem>
                      <SelectItem value="5">5 GHz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Channel Width</Label>
                  <Select
                    value={wirelessConfig.bandwidth}
                    onValueChange={(value) =>
                      setWirelessConfig((prev) => ({ ...prev, bandwidth: value as any }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 MHz</SelectItem>
                      <SelectItem value="40">40 MHz</SelectItem>
                      {wirelessConfig.band === "5" && <SelectItem value="80">80 MHz</SelectItem>}
                      {wirelessConfig.band === "5" && <SelectItem value="160">160 MHz</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>2.4 GHz:</strong> Use channels 1, 6, 11 to avoid overlap.
                    <strong>5 GHz:</strong> More channels available with less congestion.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Recommendations</CardTitle>
                <CardDescription>Based on interference analysis and best practices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Recommended Channels</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
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
                    <AlertTriangle className="h-4 w-4 text-red-600" />
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
              <CardTitle>Channel Overview - {wirelessConfig.band} GHz Band</CardTitle>
              <CardDescription>
                Visual representation of channel usage and interference
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {currentChannels.map((channel) => (
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
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-foreground font-medium">Channel {channel.channel}</span>
                      <div className="flex gap-1">
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
                      <p>Bandwidth: {channel.bandwidth} MHz</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity-calculator" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  WiFi Capacity Calculator
                </CardTitle>
                <CardDescription>
                  Calculate theoretical and real-world WiFi performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>WiFi Standard</Label>
                    <Select
                      value={wirelessConfig.mode}
                      onValueChange={(value) =>
                        setWirelessConfig((prev) => ({ ...prev, mode: value as any }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="802.11n">802.11n (WiFi 4)</SelectItem>
                        <SelectItem value="802.11ac">802.11ac (WiFi 5)</SelectItem>
                        <SelectItem value="802.11ax">802.11ax (WiFi 6)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequency Band</Label>
                    <Select
                      value={wirelessConfig.band}
                      onValueChange={(value) =>
                        setWirelessConfig((prev) => ({ ...prev, band: value as "2.4" | "5" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2.4">2.4 GHz</SelectItem>
                        <SelectItem value="5">5 GHz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Channel Width</Label>
                    <Select
                      value={wirelessConfig.bandwidth}
                      onValueChange={(value) =>
                        setWirelessConfig((prev) => ({ ...prev, bandwidth: value as any }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="20">20 MHz</SelectItem>
                        <SelectItem value="40">40 MHz</SelectItem>
                        {wirelessConfig.band === "5" && <SelectItem value="80">80 MHz</SelectItem>}
                        {wirelessConfig.band === "5" && (
                          <SelectItem value="160">160 MHz</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Max Concurrent Clients</Label>
                    <Input
                      value={wirelessConfig.maxClients}
                      onChange={(e) =>
                        setWirelessConfig((prev) => ({ ...prev, maxClients: e.target.value }))
                      }
                      placeholder="50"
                    />
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Real-world performance is typically 50-70% of theoretical maximum due to
                    overhead, interference, and protocol limitations.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <ResultCard
                title="WiFi Performance Analysis"
                data={[
                  {
                    label: "Theoretical Speed",
                    value: `${capacityData.theoretical} Mbps`,
                    highlight: true,
                  },
                  { label: "Real-World Speed", value: `${capacityData.realWorld} Mbps` },
                  { label: "Per-Client Speed", value: `${capacityData.perClient} Mbps` },
                  { label: "Max Clients", value: capacityData.maxClients.toString() },
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
                      <Checkbox />
                      <span className="text-sm">Light Usage (Email, Web): 50-100 clients/AP</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Medium Usage (Video, VoIP): 25-50 clients/AP</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">
                        Heavy Usage (Streaming, Gaming): 15-25 clients/AP
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">High Density (Conference): 100+ clients/AP</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 font-semibold">Bandwidth Requirements</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Email/Web Browsing:</span>
                      <span className="font-mono">1-5 Mbps</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Video Conferencing:</span>
                      <span className="font-mono">2-10 Mbps</span>
                    </div>
                    <div className="flex justify-between">
                      <span>HD Video Streaming:</span>
                      <span className="font-mono">5-25 Mbps</span>
                    </div>
                    <div className="flex justify-between">
                      <span>4K Video Streaming:</span>
                      <span className="font-mono">25-50 Mbps</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wifi-config" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  WiFi Configuration
                </CardTitle>
                <CardDescription>Generate wireless access point configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ssid">SSID Name</Label>
                    <Input
                      id="ssid"
                      value={wirelessConfig.ssid}
                      onChange={(e) =>
                        setWirelessConfig((prev) => ({ ...prev, ssid: e.target.value }))
                      }
                      placeholder="MyNetwork"
                    />
                  </div>
                  <div>
                    <Label>Security Type</Label>
                    <Select
                      value={wirelessConfig.security}
                      onValueChange={(value) =>
                        setWirelessConfig((prev) => ({ ...prev, security: value as any }))
                      }
                    >
                      <SelectTrigger>
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
                    <Label>Channel</Label>
                    <Select
                      value={wirelessConfig.channel}
                      onValueChange={(value) =>
                        setWirelessConfig((prev) => ({ ...prev, channel: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        {currentChannels
                          .filter((ch) => ch.recommended)
                          .map((channel) => (
                            <SelectItem key={channel.channel} value={channel.channel.toString()}>
                              Channel {channel.channel} ({channel.frequency} MHz)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Transmit Power (%)</Label>
                    <Select
                      value={wirelessConfig.power}
                      onValueChange={(value) =>
                        setWirelessConfig((prev) => ({ ...prev, power: value }))
                      }
                    >
                      <SelectTrigger>
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
                    <Label>WiFi Standard</Label>
                    <Select
                      value={wirelessConfig.mode}
                      onValueChange={(value) =>
                        setWirelessConfig((prev) => ({ ...prev, mode: value as any }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="802.11n">802.11n (WiFi 4)</SelectItem>
                        <SelectItem value="802.11ac">802.11ac (WiFi 5)</SelectItem>
                        <SelectItem value="802.11ax">802.11ax (WiFi 6)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Max Clients</Label>
                    <Input
                      value={wirelessConfig.maxClients}
                      onChange={(e) =>
                        setWirelessConfig((prev) => ({ ...prev, maxClients: e.target.value }))
                      }
                      placeholder="50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Beacon Interval (ms)</Label>
                    <Input
                      value={wirelessConfig.beaconInterval}
                      onChange={(e) =>
                        setWirelessConfig((prev) => ({ ...prev, beaconInterval: e.target.value }))
                      }
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <Label>DTIM Period</Label>
                    <Input
                      value={wirelessConfig.dtimPeriod}
                      onChange={(e) =>
                        setWirelessConfig((prev) => ({ ...prev, dtimPeriod: e.target.value }))
                      }
                      placeholder="2"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={wirelessConfig.hidden}
                    onCheckedChange={(checked) =>
                      setWirelessConfig((prev) => ({ ...prev, hidden: !!checked }))
                    }
                  />
                  <Label>Hide SSID (Not recommended for security)</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated Configuration</CardTitle>
                <CardDescription>Cisco IOS wireless access point configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={generateWirelessConfig()}
                  readOnly
                  className="min-h-[400px] font-mono text-sm"
                />
                <div className="mt-4 flex space-x-2">
                  <Button
                    onClick={() => copyToClipboard(generateWirelessConfig())}
                    variant="outline"
                    className="flex-1"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Config
                  </Button>
                  <Button onClick={exportConfig} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Wireless Security Best Practices
              </CardTitle>
              <CardDescription>
                Comprehensive guide to securing your wireless network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 font-semibold">Authentication Methods</h4>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">WPA3 (Recommended)</span>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Latest security standard with improved encryption and protection against
                          offline attacks.
                        </p>
                      </div>
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium">WPA2 (Acceptable)</span>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Widely supported and secure when properly configured with strong
                          passwords.
                        </p>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="font-medium">WEP (Avoid)</span>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Deprecated and easily cracked. Should never be used in production
                          environments.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 font-semibold">Password Requirements</h4>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>• Minimum 12 characters (preferably 15+)</li>
                      <li>• Mix of uppercase, lowercase, numbers, symbols</li>
                      <li>• Avoid dictionary words and personal information</li>
                      <li>• Use passphrases for better memorability</li>
                      <li>• Change default passwords immediately</li>
                      <li>• Regular password rotation (quarterly)</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 font-semibold">Network Segmentation</h4>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>• Separate guest and corporate networks</li>
                      <li>• Use VLANs for network isolation</li>
                      <li>• Implement firewall rules between segments</li>
                      <li>• Limit guest network access to internet only</li>
                      <li>• Monitor inter-VLAN traffic</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="mb-2 font-semibold">Additional Security Measures</h4>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>• Enable MAC address filtering (if feasible)</li>
                      <li>• Disable WPS (WiFi Protected Setup)</li>
                      <li>• Use certificate-based authentication (Enterprise)</li>
                      <li>• Enable wireless intrusion detection</li>
                      <li>• Regular firmware updates</li>
                      <li>• Monitor for rogue access points</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="mb-2 font-semibold">Enterprise Features</h4>
                    <ul className="text-muted-foreground space-y-1 text-sm">
                      <li>• 802.1X authentication with RADIUS</li>
                      <li>• Certificate-based device authentication</li>
                      <li>• Dynamic VLAN assignment</li>
                      <li>• Captive portal for guest access</li>
                      <li>• Bandwidth limiting and QoS</li>
                      <li>• Centralized management and monitoring</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="mb-2 font-semibold">Security Checklist</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">WPA3 or WPA2 enabled</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Strong password configured</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Default admin credentials changed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">WPS disabled</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Firmware up to date</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Guest network separated</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Management interface secured</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Logging enabled</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Regular security audits</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox />
                      <span className="text-sm">Rogue AP monitoring</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
