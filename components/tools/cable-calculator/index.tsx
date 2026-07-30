"use client"

import { Suspense, lazy } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Cable } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

const FiberPanel = lazy(() => import("./fiber"))
const CopperPanel = lazy(() => import("./copper"))

const TABS = ["fiber", "copper"] as const

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

const fallback = <p className="text-muted-foreground py-8 text-center text-sm">Loading panel</p>

export function CableCalculator() {
  const [{ tab }, setQuery] = useQueryStates(
    { tab: parseAsStringLiteral(TABS).withDefault("fiber") },
    { history: "replace" }
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Cable}
        title="Cable Length & Signal Loss Calculator"
        description="Fiber loss budgets and copper channel limits from the TIA and IEEE 802.3 figures"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-6"
      >
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-2 sm:gap-0 sm:p-1 lg:w-[400px]">
          <TabsTrigger value="fiber" className={TRIGGER_CLASS}>
            Fiber Optic
          </TabsTrigger>
          <TabsTrigger value="copper" className={TRIGGER_CLASS}>
            Copper Ethernet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fiber">
          <Suspense fallback={fallback}>
            <FiberPanel embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="copper">
          <Suspense fallback={fallback}>
            <CopperPanel embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default CableCalculator
