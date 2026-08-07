"use client"

import { Suspense, lazy, useMemo, useState } from "react"
import { parseAsStringLiteral, useQueryState } from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Router } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import {
  buildEigrpConfig,
  buildOspfConfig,
  buildStaticRoutesConfig,
  defaultEigrpConfig,
  defaultOspfConfig,
  emptyStaticRoute,
  evaluateNetworkStatement,
  evaluateStaticRoute,
  type EIGRPConfig,
  type OSPFConfig,
  type StaticRoute,
} from "@/lib/routing"

// one chunk per tab: opening the tool no longer downloads all four generators
const OspfPanel = lazy(() => import("./ospf").then((m) => ({ default: m.OspfPanel })))
const EigrpPanel = lazy(() => import("./eigrp").then((m) => ({ default: m.EigrpPanel })))
const StaticRoutesPanel = lazy(() =>
  import("./static-routes").then((m) => ({ default: m.StaticRoutesPanel }))
)
const AdminDistancePanel = lazy(() =>
  import("./admin-distance").then((m) => ({ default: m.AdminDistancePanel }))
)

const TABS = ["ospf", "eigrp", "static", "admin-distance"] as const
type RoutingTab = (typeof TABS)[number]

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

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

export function RoutingTools() {
  // the panel is deep-linkable; the network statement and route lists are not in
  // the url because a partial restore would silently drop a user's rows
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("ospf")
  )
  const [ospfConfig, setOspfConfig] = useState<OSPFConfig>(defaultOspfConfig)
  const [eigrpConfig, setEigrpConfig] = useState<EIGRPConfig>(defaultEigrpConfig)
  const [staticRoutes, setStaticRoutes] = useState<StaticRoute[]>([{ ...emptyStaticRoute }])

  // one save target per tab so the tool renders a single SaveToProject in the header
  const saveTarget = useMemo(() => {
    if (activeTab === "ospf") {
      const text = buildOspfConfig(
        ospfConfig,
        ospfConfig.networks.map((n) => evaluateNetworkStatement(n.address, n.wildcardMask))
      )
      return {
        name: `OSPF Process ${ospfConfig.processId}`,
        source: "Routing Tools - OSPF",
        data: { protocol: "ospf", config: ospfConfig, generatedConfig: text },
      }
    }
    if (activeTab === "eigrp") {
      const text = buildEigrpConfig(
        eigrpConfig,
        eigrpConfig.networks.map((n) => evaluateNetworkStatement(n.address, n.wildcardMask))
      )
      return {
        name: `EIGRP AS ${eigrpConfig.asNumber}`,
        source: "Routing Tools - EIGRP",
        data: { protocol: "eigrp", config: eigrpConfig, generatedConfig: text },
      }
    }
    if (activeTab === "static") {
      const text = buildStaticRoutesConfig(staticRoutes, staticRoutes.map(evaluateStaticRoute))
      return {
        name: `Static Routes (${staticRoutes.length} routes)`,
        source: "Routing Tools - Static",
        data: { protocol: "static", routes: staticRoutes, generatedConfig: text },
      }
    }
    return null
  }, [activeTab, ospfConfig, eigrpConfig, staticRoutes])

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const protocol = data.protocol as string | undefined

    if (protocol === "ospf") {
      const config = data.config as OSPFConfig | undefined
      if (config) setOspfConfig(config)
    } else if (protocol === "eigrp") {
      const config = data.config as EIGRPConfig | undefined
      if (config) setEigrpConfig(config)
    } else if (protocol === "static") {
      const routes = data.routes as StaticRoute[] | undefined
      if (routes) setStaticRoutes(routes)
    }
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Router}
        title="Routing Tools"
        description="Configure and generate routing protocols, static routes, and understand administrative distances"
        actions={
          <>
            <LoadFromProject itemType="routing" onLoad={handleLoadFromProject} />
            {saveTarget && (
              <SaveToProject
                itemType="routing"
                itemName={saveTarget.name}
                itemData={saveTarget.data}
                toolSource={saveTarget.source}
              />
            )}
          </>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => void setActiveTab(value as RoutingTab)}
        className="space-y-4"
      >
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-4 sm:gap-0 sm:p-1">
          <TabsTrigger value="ospf" className={TRIGGER_CLASS}>
            OSPF
          </TabsTrigger>
          <TabsTrigger value="eigrp" className={TRIGGER_CLASS}>
            EIGRP
          </TabsTrigger>
          <TabsTrigger value="static" className={TRIGGER_CLASS}>
            Static Routes
          </TabsTrigger>
          <TabsTrigger value="admin-distance" className={TRIGGER_CLASS}>
            Admin Distance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ospf" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <OspfPanel config={ospfConfig} onConfigChange={setOspfConfig} />
          </Suspense>
        </TabsContent>

        <TabsContent value="eigrp" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <EigrpPanel config={eigrpConfig} onConfigChange={setEigrpConfig} />
          </Suspense>
        </TabsContent>

        <TabsContent value="static" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <StaticRoutesPanel routes={staticRoutes} onRoutesChange={setStaticRoutes} />
          </Suspense>
        </TabsContent>

        <TabsContent value="admin-distance" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <AdminDistancePanel />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RoutingTools
