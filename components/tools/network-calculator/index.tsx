"use client"

import { Suspense, lazy } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calculator } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import type { DistanceUnit, Medium } from "@/lib/network-math"

// one chunk per tab: opening the tool no longer downloads all three panels
const LatencyPanel = lazy(() => import("./latency").then((m) => ({ default: m.LatencyPanel })))
const ThroughputPanel = lazy(() =>
  import("./throughput").then((m) => ({ default: m.ThroughputPanel }))
)
const IPMathPanel = lazy(() => import("./ipmath").then((m) => ({ default: m.IPMathPanel })))

function PanelFallback() {
  return (
    <p
      data-panel-fallback
      className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      Loading panel...
    </p>
  )
}

export function NetworkCalculator() {
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(["latency", "throughput", "ipmath"] as const).withDefault(
        "latency"
      ),
      distance: parseAsString.withDefault("1000"),
      unit: parseAsStringLiteral(["km", "mi"] as const).withDefault("km"),
      medium: parseAsStringLiteral(["fiber", "copper", "wireless"] as const).withDefault("fiber"),
      bandwidth: parseAsString.withDefault("1000"),
      rtt: parseAsString.withDefault("50"),
      window: parseAsString.withDefault("65535"),
      ip1: parseAsString.withDefault("192.168.1.0"),
      ip2: parseAsString.withDefault("192.168.1.255"),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Calculator}
        title="Network Calculator"
        description="Propagation delay, bandwidth delay product, and IPv4 address math"
      />

      <Tabs
        value={query.tab}
        onValueChange={(value) => setQuery({ tab: value as typeof query.tab })}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="latency">Latency</TabsTrigger>
          <TabsTrigger value="throughput">Throughput</TabsTrigger>
          <TabsTrigger value="ipmath">IP Math</TabsTrigger>
        </TabsList>

        <TabsContent value="latency">
          <Suspense fallback={<PanelFallback />}>
            <LatencyPanel
              distance={query.distance}
              unit={query.unit as DistanceUnit}
              medium={query.medium as Medium}
              onDistanceChange={(distance) => void setQuery({ distance })}
              onUnitChange={(unit) => void setQuery({ unit })}
              onMediumChange={(medium) => void setQuery({ medium })}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="throughput">
          <Suspense fallback={<PanelFallback />}>
            <ThroughputPanel
              bandwidth={query.bandwidth}
              rtt={query.rtt}
              windowSize={query.window}
              onBandwidthChange={(bandwidth) => void setQuery({ bandwidth })}
              onRttChange={(rtt) => void setQuery({ rtt })}
              onWindowSizeChange={(window) => void setQuery({ window })}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="ipmath">
          <Suspense fallback={<PanelFallback />}>
            <IPMathPanel
              first={query.ip1}
              second={query.ip2}
              onFirstChange={(ip1) => void setQuery({ ip1 })}
              onSecondChange={(ip2) => void setQuery({ ip2 })}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
