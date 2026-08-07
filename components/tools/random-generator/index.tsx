"use client"

import { Suspense, lazy, useState } from "react"
import { parseAsBoolean, parseAsInteger, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shuffle, ShieldCheck } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { randomIPv4, randomIPv6, randomMac } from "@/lib/random-gen"
import type { IPv4Kind, IPv6Kind, MacFormat, MacScope } from "@/lib/random-gen"
import { IPV4_KINDS, IPV6_KINDS, MAC_FORMATS, MAC_SCOPES } from "./kinds"

// one chunk per tab: opening the tool no longer downloads all three generators
const Ipv4Panel = lazy(() => import("./ipv4").then((m) => ({ default: m.Ipv4Panel })))
const MacPanel = lazy(() => import("./mac").then((m) => ({ default: m.MacPanel })))
const Ipv6Panel = lazy(() => import("./ipv6").then((m) => ({ default: m.Ipv6Panel })))

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

const TABS = ["ipv4", "mac", "ipv6"] as const
const IPV4_IDS = IPV4_KINDS.map((k) => k.id) as [IPv4Kind, ...IPv4Kind[]]
const IPV6_IDS = IPV6_KINDS.map((k) => k.id) as [IPv6Kind, ...IPv6Kind[]]
const MAC_SCOPE_IDS = MAC_SCOPES.map((k) => k.id) as [MacScope, ...MacScope[]]
const MAC_FORMAT_IDS = MAC_FORMATS.map((k) => k.id) as [MacFormat, ...MacFormat[]]

const MAX_COUNT = 1000

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 10
  return Math.min(Math.max(Math.floor(value), 1), MAX_COUNT)
}

export function RandomGenerator() {
  // the options go in the url; the drawn values never do, or the draw would not be random
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("ipv4"),
      count: parseAsInteger.withDefault(10),
      ip4: parseAsStringLiteral(IPV4_IDS).withDefault("any"),
      ip6: parseAsStringLiteral(IPV6_IDS).withDefault("global"),
      macScope: parseAsStringLiteral(MAC_SCOPE_IDS).withDefault("unicast-local"),
      macFormat: parseAsStringLiteral(MAC_FORMAT_IDS).withDefault("colon"),
      macUpper: parseAsBoolean.withDefault(true),
    },
    // typing a count should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const count = clampCount(query.count)

  const [ipv4Values, setIpv4Values] = useState<string[]>([])
  const [macValues, setMacValues] = useState<string[]>([])
  const [ipv6Values, setIpv6Values] = useState<string[]>([])

  const draw = (make: () => string) => Array.from({ length: count }, make)

  const exportValues = (values: string[], kind: string) => {
    downloadTextFile(values.join("\n"), `random-${kind}-${dateStamp()}.txt`, "text/plain")
  }

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const toValues = (values: unknown): string[] =>
      Array.isArray(values) ? values.map((value) => String(value)) : []
    setIpv4Values(toValues(data.ipv4))
    setIpv6Values(toValues(data.ipv6))
    setMacValues(toValues(data.mac))
  }

  const total = ipv4Values.length + macValues.length + ipv6Values.length

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shuffle}
        title="Random Generator"
        description="Generate random IPv4, IPv6 and MAC addresses for lab configs and test fixtures"
        actions={
          <>
            <LoadFromProject itemType="random-gen" onLoad={handleLoadFromProject} size="sm" />
            {total > 0 && (
              <SaveToProject
                itemType="random-gen"
                itemName={`${total} generated addresses`}
                itemData={{ ipv4: ipv4Values, ipv6: ipv6Values, mac: macValues }}
                toolSource="Random Generator"
                size="sm"
              />
            )}
          </>
        }
      />

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          Every value comes from <code>crypto.getRandomValues</code> through rejection sampling, so
          each address in the requested range is equally likely. Ranges are also honest: nothing
          here hands you a link-local address and calls it public.
        </AlertDescription>
      </Alert>

      <Tabs
        value={query.tab}
        onValueChange={(value) => void setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ipv4">IPv4</TabsTrigger>
          <TabsTrigger value="mac">MAC</TabsTrigger>
          <TabsTrigger value="ipv6">IPv6</TabsTrigger>
        </TabsList>

        <TabsContent value="ipv4" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <Ipv4Panel
              kind={query.ip4}
              count={count}
              values={ipv4Values}
              onKindChange={(ip4) => void setQuery({ ip4 })}
              onCountChange={(next) => void setQuery({ count: clampCount(next) })}
              onGenerate={() => setIpv4Values(draw(() => randomIPv4(query.ip4)))}
              onExport={() => exportValues(ipv4Values, "ipv4")}
              onClear={() => setIpv4Values([])}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="mac" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <MacPanel
              scope={query.macScope}
              format={query.macFormat}
              uppercase={query.macUpper}
              count={count}
              values={macValues}
              onScopeChange={(macScope) => void setQuery({ macScope })}
              onFormatChange={(macFormat) => void setQuery({ macFormat })}
              onUppercaseChange={(macUpper) => void setQuery({ macUpper })}
              onCountChange={(next) => void setQuery({ count: clampCount(next) })}
              onGenerate={() =>
                setMacValues(
                  draw(() =>
                    randomMac({
                      scope: query.macScope,
                      format: query.macFormat,
                      uppercase: query.macUpper,
                    })
                  )
                )
              }
              onExport={() => exportValues(macValues, "mac")}
              onClear={() => setMacValues([])}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="ipv6" className="space-y-4">
          <Suspense fallback={<PanelFallback />}>
            <Ipv6Panel
              kind={query.ip6}
              count={count}
              values={ipv6Values}
              onKindChange={(ip6) => void setQuery({ ip6 })}
              onCountChange={(next) => void setQuery({ count: clampCount(next) })}
              onGenerate={() => setIpv6Values(draw(() => randomIPv6(query.ip6)))}
              onExport={() => exportValues(ipv6Values, "ipv6")}
              onClear={() => setIpv6Values([])}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RandomGenerator
