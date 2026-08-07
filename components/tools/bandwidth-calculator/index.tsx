"use client"

import { Suspense, lazy } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Gauge } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

const TransferTimePanel = lazy(() => import("./transfer-time"))
const DownloadSizePanel = lazy(() => import("./download-size"))
const SpeedConverterPanel = lazy(() => import("./converter"))

const TABS = ["transfer-time", "download-size", "converter"] as const

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

const fallback = (
  <p className="text-muted-foreground py-8 text-center text-sm" data-panel-fallback>
    Loading panel
  </p>
)

export function BandwidthCalculator() {
  const [{ tab }, setQuery] = useQueryStates(
    { tab: parseAsStringLiteral(TABS).withDefault("transfer-time") },
    { history: "replace" }
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Gauge}
        title="Bandwidth Calculator"
        description="Transfer times, download capacity and rate conversion in consistent units"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-4"
      >
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
          <TabsTrigger value="transfer-time" className={TRIGGER_CLASS}>
            Transfer Time
          </TabsTrigger>
          <TabsTrigger value="download-size" className={TRIGGER_CLASS}>
            Download Size
          </TabsTrigger>
          <TabsTrigger value="converter" className={TRIGGER_CLASS}>
            Unit Converter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer-time">
          <Suspense fallback={fallback}>
            <TransferTimePanel embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="download-size">
          <Suspense fallback={fallback}>
            <DownloadSizePanel embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="converter">
          <Suspense fallback={fallback}>
            <SpeedConverterPanel embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default BandwidthCalculator
