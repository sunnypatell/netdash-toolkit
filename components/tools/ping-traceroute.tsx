"use client"

import { Suspense, lazy, useEffect, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, AlertCircle, Zap } from "lucide-react"
import { isElectron } from "@/lib/electron"
import { describeTransport } from "@/lib/browser-ping"
import { ToolHeader } from "@/components/ui/tool-header"
import { RuntimeDisclosure } from "@/components/ui/runtime-badge"
import { getToolBySlug } from "@/lib/tool-registry"

// one chunk per panel; the interfaces panel never loads on the web build
const PingPanel = lazy(() => import("./ping-traceroute/ping"))
const TraceroutePanel = lazy(() => import("./ping-traceroute/traceroute"))
const InterfacesPanel = lazy(() => import("./ping-traceroute/interfaces"))

const TABS = ["ping", "traceroute", "interfaces"] as const

function PanelFallback() {
  return (
    <p role="status" className="text-muted-foreground p-4 text-sm">
      Loading...
    </p>
  )
}

export function PingTraceroute() {
  // both targets live in the query string so a setup is a shareable link. nothing
  // is sent on arrival: each panel needs its button pressed.
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("ping"),
      host: parseAsString.withDefault("example.com"),
      trace: parseAsString.withDefault("example.com"),
    },
    { history: "replace" }
  )
  const { tab, host, trace } = query

  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  const tool = getToolBySlug("ping-traceroute")
  // the interfaces tab only exists in the desktop app, so a link to it has to fall
  // back rather than select a trigger that was never rendered
  const activeTab = tab === "interfaces" && !isNative ? "ping" : tab

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Activity}
        title="Ping & Traceroute"
        description="Test network connectivity and trace packet paths to destinations"
      />

      {isNative ? (
        <Alert className="border-green-500/50 bg-green-500/10">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Desktop app:</strong> real ICMP ping and the system traceroute, so latency here
            is packet round-trip time and the path is the real path.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>A browser cannot ping.</strong> There is no ICMP API in a web page, so what this
            tool measures is an {describeTransport("https-round-trip")}. That number is always
            larger than an ICMP round trip and is not comparable to one - it includes name
            resolution and two handshakes on a cold connection. Traceroute needs per-packet TTL
            control, which a browser does not have at all, so it is desktop-only rather than
            estimated.
          </AlertDescription>
        </Alert>
      )}

      {tool && (
        <div className="px-1">
          <RuntimeDisclosure tool={tool} />
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => void setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-6"
      >
        <TabsList className={`grid w-full ${isNative ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="ping">{isNative ? "Ping Test" : "Reachability"}</TabsTrigger>
          <TabsTrigger value="traceroute">Traceroute</TabsTrigger>
          {isNative && <TabsTrigger value="interfaces">Network Info</TabsTrigger>}
        </TabsList>

        <TabsContent value="ping" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <PingPanel
              host={host}
              onHostChange={(value) => void setQuery({ host: value })}
              isNative={isNative}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="traceroute" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <TraceroutePanel
              host={trace}
              onHostChange={(value) => void setQuery({ trace: value })}
              isNative={isNative}
            />
          </Suspense>
        </TabsContent>

        {isNative && (
          <TabsContent value="interfaces" className="space-y-6">
            <Suspense fallback={<PanelFallback />}>
              <InterfacesPanel />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Reading these numbers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold">
                {isNative ? "ICMP round-trip time" : "HTTPS round-trip time"}
              </h4>
              {isNative ? (
                <ul className="text-muted-foreground space-y-1">
                  <li>
                    • <strong>&lt;10ms:</strong> same LAN or metro
                  </li>
                  <li>
                    • <strong>10-50ms:</strong> regional
                  </li>
                  <li>
                    • <strong>50-100ms:</strong> national
                  </li>
                  <li>
                    • <strong>&gt;100ms:</strong> intercontinental, or congestion
                  </li>
                  <li>• Packet loss matters more than the average for call quality</li>
                </ul>
              ) : (
                <ul className="text-muted-foreground space-y-1">
                  <li>• The figure covers DNS + TCP + TLS + one request, not packet latency</li>
                  <li>• A first measurement is dominated by the two handshakes</li>
                  <li>• A repeat to the same host reuses the connection and looks far faster</li>
                  <li>• The ICMP thresholds people quote do not apply to it</li>
                  <li>• A failure cannot distinguish DNS, firewall, TLS or a content blocker</li>
                </ul>
              )}
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Traceroute analysis</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Each hop is a router that returned an ICMP time-exceeded message</li>
                <li>• A hop with no reply is usually filtered, not down</li>
                <li>• Latency at one hop only matters if it persists to the next</li>
                <li>• Paths are asymmetric: the return path is not shown</li>
                <li>• Private IPs (10.x, 192.168.x) are inside your own network</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
