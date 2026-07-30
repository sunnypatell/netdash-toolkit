"use client"

import { Suspense, lazy, useMemo, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Network } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { downloadTextFile, dateStamp } from "@/lib/download"
import type { DownloadMime } from "@/lib/download"
import { calculateVLSM, exportVLSMPlan } from "@/lib/vlsm-utils"
import type { VLSMPlan, VLSMRequirement } from "@/lib/vlsm-utils"
import { nextId } from "@/lib/id"

// the scalar base network lives in the url so a plan is a shareable link. the
// requirement list does not: it is an arbitrary number of free-text rows, which
// would blow past url length limits and make every keystroke rewrite the query.
const PlanningPanel = lazy(() => import("./planning").then((m) => ({ default: m.PlanningPanel })))
const ResultsPanel = lazy(() => import("./results").then((m) => ({ default: m.ResultsPanel })))
const VisualizationPanel = lazy(() =>
  import("./visualization").then((m) => ({ default: m.VisualizationPanel }))
)

const SAMPLE: ReadonlyArray<Omit<VLSMRequirement, "id">> = [
  { name: "Main Office", hostsRequired: 500, description: "Primary office with 500 users" },
  { name: "Branch A", hostsRequired: 120, description: "Branch office A" },
  { name: "Branch B", hostsRequired: 50, description: "Branch office B" },
  { name: "DMZ", hostsRequired: 10, description: "Web servers and public services" },
  { name: "Management", hostsRequired: 5, description: "Network management devices" },
]

const DEFAULT_REQUIREMENTS: ReadonlyArray<Omit<VLSMRequirement, "id">> = [
  { name: "Main Office", hostsRequired: 120, description: "Primary office network" },
  { name: "Branch Office", hostsRequired: 50, description: "Remote branch office" },
  { name: "DMZ", hostsRequired: 10, description: "Demilitarized zone" },
]

// nextId rather than Date.now(): two rows added inside the same millisecond
// collided on both the react key and the per-row dom ids labels point at
function withIds(rows: ReadonlyArray<Omit<VLSMRequirement, "id">>): VLSMRequirement[] {
  return rows.map((row) => ({ ...row, id: nextId("vlsm") }))
}

function PanelFallback() {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      Loading panel...
    </p>
  )
}

export function VLSMPlanner() {
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(["planning", "results", "visualization"] as const).withDefault(
        "planning"
      ),
      network: parseAsString.withDefault("10.0.0.0"),
      prefix: parseAsString.withDefault("20"),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const [requirements, setRequirements] = useState<VLSMRequirement[]>(() =>
    withIds(DEFAULT_REQUIREMENTS)
  )

  // derived, so an unfittable requirement can never sit beside a stale plan
  const plan = useMemo<VLSMPlan | null>(() => {
    const prefix = Number.parseInt(query.prefix, 10)
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null
    if (requirements.length === 0) return null
    return calculateVLSM(query.network, prefix, requirements)
  }, [query.network, query.prefix, requirements])

  const exportPlan = (format: "csv" | "json" | "text") => {
    if (!plan) return
    const mimeTypes: Record<typeof format, DownloadMime> = {
      csv: "text/csv",
      json: "application/json",
      text: "text/plain",
    }
    downloadTextFile(
      exportVLSMPlan(plan, format),
      `vlsm-plan-${dateStamp()}.${format}`,
      mimeTypes[format]
    )
  }

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const savedNetwork = data.baseNetwork as string | undefined
    const savedPrefix = data.basePrefix as number | undefined
    const savedRequirements = data.requirements as VLSMRequirement[] | undefined

    // only inputs are restored; the plan recomputes from them, so a saved item
    // can never show a figure that no longer matches its own requirements
    if (!savedNetwork || savedPrefix === undefined || !savedRequirements) return
    void setQuery({ network: savedNetwork, prefix: String(savedPrefix) })
    setRequirements(savedRequirements.map((req) => ({ ...req, id: req.id || nextId("vlsm") })))
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Network}
        title="VLSM Planner"
        description="Allocate a block to host requirements, largest first, aligned to boundaries"
        actions={
          <>
            <LoadFromProject itemType="vlsm" onLoad={handleLoadFromProject} size="sm" />
            <Button variant="outline" size="sm" onClick={() => setRequirements(withIds(SAMPLE))}>
              <span className="hidden sm:inline">Load </span>Sample
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportPlan("csv")}
              disabled={!plan?.success}
            >
              <Download className="mr-1 h-4 w-4 sm:mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportPlan("text")}
              disabled={!plan?.success}
            >
              <Download className="mr-1 h-4 w-4 sm:mr-2" />
              Text
            </Button>
            {plan?.success && (
              <SaveToProject
                itemType="vlsm"
                itemName={`VLSM ${query.network}/${query.prefix}`}
                itemData={{
                  baseNetwork: query.network,
                  basePrefix: Number.parseInt(query.prefix, 10),
                  requirements,
                }}
                toolSource="VLSM Planner"
                size="sm"
              />
            )}
          </>
        }
      />

      <Tabs
        value={query.tab}
        onValueChange={(value) => setQuery({ tab: value as typeof query.tab })}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
        </TabsList>

        <TabsContent value="planning" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <PlanningPanel
              baseNetwork={query.network}
              basePrefix={query.prefix}
              requirements={requirements}
              onBaseNetworkChange={(network) => void setQuery({ network })}
              onBasePrefixChange={(prefix) => void setQuery({ prefix })}
              onRequirementsChange={setRequirements}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <ResultsPanel plan={plan} />
          </Suspense>
        </TabsContent>

        <TabsContent value="visualization" className="space-y-6">
          <Suspense fallback={<PanelFallback />}>
            <VisualizationPanel plan={plan} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
