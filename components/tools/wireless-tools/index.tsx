"use client"

import {
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wifi } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { defaultWirelessConfig, type ChannelWidth, type WirelessConfig } from "@/lib/wireless"
import { ChannelPlanningPanel } from "./channel-planning"
import { CapacityCalculatorPanel, type CapacitySettings } from "./capacity-calculator"
import { WifiConfigPanel } from "./wifi-config"
import { SecurityGuidePanel } from "./security-guide"

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

const TABS = ["channel-planning", "capacity-calculator", "wifi-config", "security"] as const
const BANDS = ["2.4", "5", "6"] as const
const WIDTHS = ["20", "40", "80", "160", "320"] as const
const STANDARDS = ["802.11n", "802.11ac", "802.11ax", "802.11be"] as const
const SECURITY = ["open", "wep", "wpa", "wpa2", "wpa3", "wpa2-enterprise"] as const

export function WirelessTools() {
  // every input lives in the query string, so any plan or generated config is a
  // shareable link
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("channel-planning"),
      band: parseAsStringLiteral(BANDS).withDefault(defaultWirelessConfig.band),
      width: parseAsStringLiteral(WIDTHS).withDefault(defaultWirelessConfig.bandwidth),
      std: parseAsStringLiteral(STANDARDS).withDefault(defaultWirelessConfig.mode),
      streams: parseAsInteger.withDefault(2),
      clients: parseAsString.withDefault(defaultWirelessConfig.maxClients),
      ssid: parseAsString.withDefault(defaultWirelessConfig.ssid),
      sec: parseAsStringLiteral(SECURITY).withDefault(defaultWirelessConfig.security),
      ch: parseAsString.withDefault(defaultWirelessConfig.channel),
      power: parseAsString.withDefault(defaultWirelessConfig.power),
      hidden: parseAsBoolean.withDefault(defaultWirelessConfig.hidden),
      beacon: parseAsString.withDefault(defaultWirelessConfig.beaconInterval),
      dtim: parseAsString.withDefault(defaultWirelessConfig.dtimPeriod),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const config: WirelessConfig = {
    ssid: query.ssid,
    security: query.sec,
    channel: query.ch,
    bandwidth: query.width,
    power: query.power,
    band: query.band,
    mode: query.std,
    hidden: query.hidden,
    maxClients: query.clients,
    beaconInterval: query.beacon,
    dtimPeriod: query.dtim,
  }

  const setConfig = (next: WirelessConfig) =>
    void setQuery({
      ssid: next.ssid,
      sec: next.security,
      ch: next.channel,
      width: next.bandwidth,
      power: next.power,
      band: next.band,
      std: next.mode,
      hidden: next.hidden,
      clients: next.maxClients,
      beacon: next.beaconInterval,
      dtim: next.dtimPeriod,
    })

  const capacity: CapacitySettings = {
    standard: config.mode,
    band: config.band,
    width: Number.parseInt(config.bandwidth, 10) as ChannelWidth,
    maxClients: config.maxClients,
    spatialStreams: query.streams,
  }

  const applyCapacity = (next: CapacitySettings) =>
    void setQuery({
      std: next.standard,
      band: next.band,
      width: next.width.toString() as (typeof WIDTHS)[number],
      clients: next.maxClients,
      streams: next.spatialStreams,
    })

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Wifi}
        title="Wireless Tools"
        description="Plan wireless channels, calculate capacity, and generate WiFi configurations"
      />

      <Tabs
        value={query.tab}
        onValueChange={(value) => void setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-4"
      >
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-4 sm:gap-0 sm:p-1">
          <TabsTrigger value="channel-planning" className={TRIGGER_CLASS}>
            Channel Planning
          </TabsTrigger>
          <TabsTrigger value="capacity-calculator" className={TRIGGER_CLASS}>
            Capacity
          </TabsTrigger>
          <TabsTrigger value="wifi-config" className={TRIGGER_CLASS}>
            WiFi Config
          </TabsTrigger>
          <TabsTrigger value="security" className={TRIGGER_CLASS}>
            Security Guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channel-planning" className="space-y-4">
          <ChannelPlanningPanel
            band={config.band}
            width={capacity.width}
            onBandChange={(band) => void setQuery({ band, ch: "auto" })}
            onWidthChange={(width) =>
              void setQuery({ width: width.toString() as (typeof WIDTHS)[number] })
            }
          />
        </TabsContent>

        <TabsContent value="capacity-calculator" className="space-y-4">
          <CapacityCalculatorPanel value={capacity} onChange={applyCapacity} />
        </TabsContent>

        <TabsContent value="wifi-config" className="space-y-4">
          <WifiConfigPanel config={config} onConfigChange={setConfig} />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityGuidePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default WirelessTools
