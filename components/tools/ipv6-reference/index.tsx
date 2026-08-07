"use client"

import { Suspense, lazy } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Globe2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

const IPv6AddressTypes = lazy(() => import("./types"))
const IPv6SpecialAddresses = lazy(() => import("./special"))
const IPv6FormatRules = lazy(() => import("./format"))

const TABS = ["types", "special", "format"] as const

const fallback = (
  <p className="text-muted-foreground py-8 text-center text-sm" data-panel-fallback>
    Loading reference
  </p>
)

export function IPv6Reference() {
  const [{ tab }, setQuery] = useQueryStates(
    { tab: parseAsStringLiteral(TABS).withDefault("types") },
    { history: "replace" }
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe2}
        title="IPv6 Reference"
        description="Address types, special-purpose prefixes and the RFC 5952 text format"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="types">Address Types</TabsTrigger>
          <TabsTrigger value="special">Special Addresses</TabsTrigger>
          <TabsTrigger value="format">Format Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="types">
          <Suspense fallback={fallback}>
            <IPv6AddressTypes embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="special">
          <Suspense fallback={fallback}>
            <IPv6SpecialAddresses embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="format">
          <Suspense fallback={fallback}>
            <IPv6FormatRules embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default IPv6Reference
