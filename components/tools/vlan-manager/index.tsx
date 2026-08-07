"use client"

import { Suspense, lazy, useMemo, useState } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Download, Layers } from "lucide-react"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { ToolHeader } from "@/components/ui/tool-header"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { checkSubnetOverlaps, exportVLANsToCSV } from "@/lib/vlan-utils"
import type { SwitchPort, VLAN } from "@/lib/vlan-utils"
import { nextId } from "@/lib/id"
import type { PortRow, Vendor, VLANRow } from "./types"

// only the vendor and the active tab go in the url. the VLAN and port tables are
// arbitrarily long lists of free text, which do not survive a query string, so
// they stay in state and travel through Save to Project instead.
const VlansPanel = lazy(() => import("./vlans").then((m) => ({ default: m.VlansPanel })))
const PortsPanel = lazy(() => import("./ports").then((m) => ({ default: m.PortsPanel })))
const ConfigPanel = lazy(() => import("./config").then((m) => ({ default: m.ConfigPanel })))
const ValidationPanel = lazy(() =>
  import("./validation").then((m) => ({ default: m.ValidationPanel }))
)

const TAB_CLASS =
  "data-[state=active]:bg-background border-input bg-muted rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

const DEFAULT_VLANS: ReadonlyArray<VLAN> = [
  {
    id: 10,
    name: "Management",
    purpose: "Network Management",
    subnets: ["192.168.10.0/24"],
    description: "Management VLAN for network devices",
  },
  {
    id: 20,
    name: "Users",
    purpose: "User Access",
    subnets: ["192.168.20.0/24"],
    description: "User workstations and devices",
  },
  {
    id: 30,
    name: "Servers",
    purpose: "Server Farm",
    subnets: ["192.168.30.0/24"],
    description: "Production servers",
  },
]

const DEFAULT_PORTS: ReadonlyArray<SwitchPort> = [
  { name: "GigabitEthernet1/0/1", description: "User PC", mode: "access", accessVlan: 20 },
  {
    name: "GigabitEthernet1/0/24",
    description: "Trunk to Core Switch",
    mode: "trunk",
    nativeVlan: 10,
    allowedVlans: "10,20,30",
  },
]

const SAMPLE_VLANS: ReadonlyArray<VLAN> = [
  ...DEFAULT_VLANS,
  {
    id: 40,
    name: "DMZ",
    purpose: "Demilitarized Zone",
    subnets: ["203.0.113.0/24"],
    description: "Public-facing servers",
  },
  {
    id: 50,
    name: "Guest",
    purpose: "Guest Access",
    subnets: ["192.168.50.0/24"],
    description: "Guest wireless access",
  },
]

const SAMPLE_PORTS: ReadonlyArray<SwitchPort> = [
  ...DEFAULT_PORTS,
  {
    name: "GigabitEthernet1/0/10",
    description: "Server - Web",
    mode: "access",
    accessVlan: 30,
  },
  {
    name: "GigabitEthernet1/0/23",
    description: "Trunk to Distribution Switch",
    mode: "trunk",
    nativeVlan: 10,
    allowedVlans: "10,20,30,40,50",
  },
]

function withVlanIds(vlans: ReadonlyArray<VLAN>): VLANRow[] {
  return vlans.map((vlan) => ({ ...vlan, rowId: nextId("vlan") }))
}

function withPortIds(ports: ReadonlyArray<SwitchPort>): PortRow[] {
  return ports.map((port) => ({ ...port, rowId: nextId("port") }))
}

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

export function VLANManager() {
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(["vlans", "ports", "config", "validation"] as const).withDefault(
        "vlans"
      ),
      vendor: parseAsStringLiteral(["cisco-ios", "aruba-cx"] as const).withDefault("cisco-ios"),
    },
    { history: "replace" }
  )

  const [vlans, setVlans] = useState<VLANRow[]>(() => withVlanIds(DEFAULT_VLANS))
  const [ports, setPorts] = useState<PortRow[]>(() => withPortIds(DEFAULT_PORTS))

  const overlaps = useMemo(() => checkSubnetOverlaps(vlans), [vlans])

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const savedVlans = data.vlans as VLAN[] | undefined
    const savedPorts = data.ports as SwitchPort[] | undefined
    const savedVendor = data.vendor as Vendor | undefined

    if (savedVlans) setVlans(withVlanIds(savedVlans))
    if (savedPorts) setPorts(withPortIds(savedPorts))
    if (savedVendor) void setQuery({ vendor: savedVendor })
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Layers}
        title="VLAN Manager"
        description="Design VLANs and switch ports, and generate the config for them"
        actions={
          <>
            <LoadFromProject itemType="vlan" onLoad={handleLoadFromProject} size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVlans(withVlanIds(SAMPLE_VLANS))
                setPorts(withPortIds(SAMPLE_PORTS))
              }}
            >
              <span className="hidden sm:inline">Load </span>Sample
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadTextFile(exportVLANsToCSV(vlans), `vlans-${dateStamp()}.csv`, "text/csv")
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            {vlans.length > 0 && (
              <SaveToProject
                itemType="vlan"
                itemName={`VLAN Config (${vlans.length} VLANs)`}
                itemData={{ vlans, ports, vendor: query.vendor }}
                toolSource="VLAN Manager"
                size="sm"
              />
            )}
          </>
        }
      />

      {overlaps.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Subnet overlaps detected:</strong>{" "}
            {overlaps
              .map(
                (overlap) =>
                  `${overlap.subnet} between ${overlap.vlan1.name} and ${overlap.vlan2.name}`
              )
              .join("; ")}
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={query.tab}
        onValueChange={(value) => setQuery({ tab: value as typeof query.tab })}
        className="space-y-6"
      >
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:h-10 sm:grid-cols-4 sm:gap-0 sm:p-1">
          <TabsTrigger value="vlans" className={TAB_CLASS}>
            VLANs
          </TabsTrigger>
          <TabsTrigger value="ports" className={TAB_CLASS}>
            Ports
          </TabsTrigger>
          <TabsTrigger value="config" className={TAB_CLASS}>
            Config
          </TabsTrigger>
          <TabsTrigger value="validation" className={TAB_CLASS}>
            Validation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vlans" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <VlansPanel vlans={vlans} onVlansChange={setVlans} />
          </Suspense>
        </TabsContent>

        <TabsContent value="ports" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <PortsPanel ports={ports} vlans={vlans} onPortsChange={setPorts} />
          </Suspense>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <ConfigPanel
              vlans={vlans}
              ports={ports}
              vendor={query.vendor as Vendor}
              onVendorChange={(vendor) => void setQuery({ vendor })}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <ValidationPanel vlans={vlans} ports={ports} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
