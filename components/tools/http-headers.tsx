"use client"

import { Suspense, lazy, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Info } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CORS_SAFELISTED_RESPONSE_HEADERS } from "@/lib/browser-limits"
import { RELAY_HOST, normalizeTargetUrl } from "@/lib/http-relay"
import type { HeaderAnalysis } from "./http-headers/header-report"
import { HeaderReport } from "./http-headers/header-report"

// one chunk per acquisition method; only the open tab is fetched and mounted
const PastePanel = lazy(() => import("./http-headers/paste"))
const RelayPanel = lazy(() => import("./http-headers/relay"))

const TABS = ["paste", "relay"] as const

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

function hostOf(target: string): string {
  try {
    return new URL(target).hostname
  } catch {
    return ""
  }
}

function PanelFallback() {
  return (
    <p role="status" className="text-muted-foreground p-4 text-sm">
      Loading...
    </p>
  )
}

export function HTTPHeaders() {
  // the target lives in the query string so a lookup is a shareable link. nothing
  // is requested on arrival: the relay only runs when the button is pressed.
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("paste"),
      url: parseAsString.withDefault("https://example.com"),
    },
    { history: "replace" }
  )
  const { tab, url } = query

  const [analysis, setAnalysis] = useState<HeaderAnalysis | null>(null)
  const [blockIndex, setBlockIndex] = useState(0)
  const [busy, setBusy] = useState(false)

  const target = normalizeTargetUrl(url, "https")
  const hostLabel = hostOf(target) || url.trim()

  const applyAnalysis = (next: HeaderAnalysis) => {
    setAnalysis(next)
    // a redirect chain ends on the response that served content, so open there
    setBlockIndex(next.blocks.length - 1)
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileText}
        title="HTTP Headers Analyzer"
        description="Parse, categorize and export HTTP response headers"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Why this tool asks you to paste</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            A page cannot read another site&apos;s response headers. On a cross-origin response the{" "}
            <code className="font-mono text-xs">Headers</code> object exposes only the{" "}
            {CORS_SAFELISTED_RESPONSE_HEADERS.length} CORS-safelisted headers -{" "}
            {CORS_SAFELISTED_RESPONSE_HEADERS.join(", ")} - unless the server opts in with{" "}
            <code className="font-mono text-xs">Access-Control-Expose-Headers</code>. Everything
            else reads as absent from script, which is <strong>not</strong> the same as being absent
            from the response, so a direct fetch would be worse than useless here.
          </p>
          <p>
            Paste real <code className="font-mono text-xs">curl</code> output for the true picture,
            or fetch through <span className="font-mono">{RELAY_HOST}</span>, a labelled third-party
            relay, for a quick look.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Paste headers you captured, or use the relay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="hh-url">Website URL</Label>
              <Input
                id="hh-url"
                aria-describedby="hh-url-error"
                value={url}
                onChange={(e) => void setQuery({ url: e.target.value })}
                placeholder="https://example.com"
                className="font-mono"
              />
            </div>

            <Tabs
              value={tab}
              onValueChange={(value) => void setQuery({ tab: value as (typeof TABS)[number] })}
              className="space-y-4"
            >
              <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-2 sm:gap-0 sm:p-1">
                <TabsTrigger value="paste" className={TRIGGER_CLASS}>
                  Paste curl output
                </TabsTrigger>
                <TabsTrigger value="relay" className={TRIGGER_CLASS}>
                  Third-party relay
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste">
                <Suspense fallback={<PanelFallback />}>
                  <PastePanel target={target} hostLabel={hostLabel} onAnalysis={applyAnalysis} />
                </Suspense>
              </TabsContent>

              <TabsContent value="relay">
                <Suspense fallback={<PanelFallback />}>
                  <RelayPanel
                    target={target}
                    hostLabel={hostLabel}
                    onAnalysis={applyAnalysis}
                    onBusyChange={setBusy}
                  />
                </Suspense>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* live region: the relay result arrives asynchronously */}
        <div aria-live="polite" aria-busy={busy}>
          <HeaderReport
            analysis={analysis}
            blockIndex={blockIndex}
            onBlockIndexChange={setBlockIndex}
          />
        </div>
      </div>
    </div>
  )
}
