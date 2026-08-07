"use client"

import { Suspense, lazy, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Zap } from "lucide-react"
import { isElectron } from "@/lib/electron"
import { ToolHeader } from "@/components/ui/tool-header"

// one chunk per panel: opening the tool no longer pulls in all six
const RTTPanel = lazy(() => import("./rtt-panel").then((m) => ({ default: m.RTTPanel })))
const ThroughputPanel = lazy(() =>
  import("./throughput-panel").then((m) => ({ default: m.ThroughputPanel }))
)
const DNSPanel = lazy(() => import("./dns-panel").then((m) => ({ default: m.DNSPanel })))
const MTUPanel = lazy(() => import("./mtu-panel").then((m) => ({ default: m.MTUPanel })))
const OUIPanel = lazy(() => import("./oui-panel").then((m) => ({ default: m.OUIPanel })))
const IPv6Panel = lazy(() => import("./ipv6-panel").then((m) => ({ default: m.IPv6Panel })))

const TAB_CLASS =
  "data-[state=active]:bg-background border-input bg-muted rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

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

export function NetworkTester() {
  const [isNative, setIsNative] = useState(false)

  // electron detection touches window, so it waits for the client
  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Activity}
        title="Network Testing Tools"
        description="HTTPS round trips, transfer rate, DNS over HTTPS, and offline network utilities"
      />

      {isNative && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <Zap className="h-4 w-4 text-green-600" aria-hidden="true" />
          <AlertDescription>
            <strong>Desktop build:</strong> real ICMP ping is available. Pick &quot;ICMP Ping
            (Native)&quot; in the RTT panel for network-layer latency instead of HTTPS timings.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="rtt" className="space-y-6">
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:h-10 sm:grid-cols-3 sm:gap-0 sm:p-1 lg:grid-cols-6">
          <TabsTrigger value="rtt" className={TAB_CLASS}>
            RTT
          </TabsTrigger>
          <TabsTrigger value="throughput" className={TAB_CLASS}>
            Throughput
          </TabsTrigger>
          <TabsTrigger value="dns" className={TAB_CLASS}>
            DNS
          </TabsTrigger>
          <TabsTrigger value="mtu" className={TAB_CLASS}>
            MTU
          </TabsTrigger>
          <TabsTrigger value="oui" className={TAB_CLASS}>
            OUI
          </TabsTrigger>
          <TabsTrigger value="ipv6" className={TAB_CLASS}>
            IPv6
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rtt" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <RTTPanel isNative={isNative} />
          </Suspense>
        </TabsContent>

        <TabsContent value="throughput" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <ThroughputPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="dns" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <DNSPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="mtu" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <MTUPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="oui" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <OUIPanel />
          </Suspense>
        </TabsContent>

        <TabsContent value="ipv6" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <IPv6Panel />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
