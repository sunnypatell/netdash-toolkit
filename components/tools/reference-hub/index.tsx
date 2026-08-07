"use client"

import { Suspense, lazy, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Search, Network, Globe, Server, Layers, Binary } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

// one chunk per tab: opening the hub no longer downloads all six tables
const PortsPanel = lazy(() => import("./ports-panel").then((m) => ({ default: m.PortsPanel })))
const IPv4RangesPanel = lazy(() =>
  import("./ipv4-ranges-panel").then((m) => ({ default: m.IPv4RangesPanel }))
)
const IPv6RangesPanel = lazy(() =>
  import("./ipv6-ranges-panel").then((m) => ({ default: m.IPv6RangesPanel }))
)
const CIDRPanel = lazy(() => import("./cidr-panel").then((m) => ({ default: m.CIDRPanel })))
const ProtocolsPanel = lazy(() =>
  import("./protocols-panel").then((m) => ({ default: m.ProtocolsPanel }))
)
const SubnetsPanel = lazy(() =>
  import("./subnets-panel").then((m) => ({ default: m.SubnetsPanel }))
)

const TAB_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

function PanelFallback() {
  return (
    <p
      data-panel-fallback
      className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      Loading table...
    </p>
  )
}

export function ReferenceHub() {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="tool-container">
      <ToolHeader
        icon={BookOpen}
        title="Networking Reference"
        description="Quick reference for common ports, IP ranges, CIDR notation, and more"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" aria-hidden="true" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            aria-label="Search across all references"
            placeholder="Search across all references..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="ports" className="space-y-4">
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-6 sm:gap-0 sm:p-1">
          <TabsTrigger value="ports" className={TAB_CLASS}>
            <Server className="mr-1 h-3 w-3 sm:hidden" aria-hidden="true" />
            Ports
          </TabsTrigger>
          <TabsTrigger value="private" className={TAB_CLASS}>
            <Network className="mr-1 h-3 w-3 sm:hidden" aria-hidden="true" />
            IPv4 Ranges
          </TabsTrigger>
          <TabsTrigger value="ipv6" className={TAB_CLASS}>
            <Globe className="mr-1 h-3 w-3 sm:hidden" aria-hidden="true" />
            IPv6 Ranges
          </TabsTrigger>
          <TabsTrigger value="cidr" className={TAB_CLASS}>
            <Binary className="mr-1 h-3 w-3 sm:hidden" aria-hidden="true" />
            CIDR
          </TabsTrigger>
          <TabsTrigger value="protocols" className={TAB_CLASS}>
            <Layers className="mr-1 h-3 w-3 sm:hidden" aria-hidden="true" />
            Protocols
          </TabsTrigger>
          <TabsTrigger value="subnets" className={TAB_CLASS}>
            <Network className="mr-1 h-3 w-3 sm:hidden" aria-hidden="true" />
            Subnets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ports" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <PortsPanel searchTerm={searchTerm} />
          </Suspense>
        </TabsContent>

        <TabsContent value="private" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <IPv4RangesPanel searchTerm={searchTerm} />
          </Suspense>
        </TabsContent>

        <TabsContent value="ipv6" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <IPv6RangesPanel searchTerm={searchTerm} />
          </Suspense>
        </TabsContent>

        <TabsContent value="cidr" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <CIDRPanel searchTerm={searchTerm} />
          </Suspense>
        </TabsContent>

        <TabsContent value="protocols" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <ProtocolsPanel searchTerm={searchTerm} />
          </Suspense>
        </TabsContent>

        <TabsContent value="subnets" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <SubnetsPanel searchTerm={searchTerm} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
