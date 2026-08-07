"use client"

import { Suspense, lazy } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Globe } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

const IPv6Calculator = lazy(() => import("./calculator"))
const IPv6ToolsReference = lazy(() => import("./reference"))

const TABS = ["calculator", "reference"] as const

const fallback = (
  <p className="text-muted-foreground py-8 text-center text-sm" data-panel-fallback>
    Loading panel
  </p>
)

export function IPv6Tools() {
  const [{ tab }, setQuery] = useQueryStates(
    { tab: parseAsStringLiteral(TABS).withDefault("calculator") },
    { history: "replace" }
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe}
        title="IPv6 Tools"
        description="IPv6 compression, classification, EUI-64 and solicited-node multicast"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setQuery({ tab: value as (typeof TABS)[number] })}
        className="w-full space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
          <TabsTrigger value="reference">Reference</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator">
          <Suspense fallback={fallback}>
            <IPv6Calculator embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="reference">
          <Suspense fallback={fallback}>
            <IPv6ToolsReference embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default IPv6Tools
