"use client"

import { Suspense, lazy, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Info, Shield } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CORS_SAFELISTED_RESPONSE_HEADERS } from "@/lib/browser-limits"
import { normalizeTargetUrl } from "@/lib/http-relay"
import { SECURITY_HEADER_SPECS } from "@/lib/security-header-grade"
import type { GradeInput } from "./grade-report"

// one chunk per acquisition route; only the open tab is fetched and mounted
const GradeReport = lazy(() => import("./grade-report").then((m) => ({ default: m.GradeReport })))
const PastePanel = lazy(() => import("./paste"))
const ObservatoryPanel = lazy(() => import("./observatory"))
const RelayPanel = lazy(() => import("./relay"))

const TABS = ["paste", "observatory", "relay"] as const

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
    <p data-panel-fallback role="status" className="text-muted-foreground p-4 text-sm">
      Loading...
    </p>
  )
}

export function SecurityHeaders() {
  // the target goes in the url, but nothing is scanned until a button is pressed
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("paste"),
      url: parseAsString.withDefault("https://example.com"),
    },
    { history: "replace" }
  )
  const { tab, url } = query

  const [result, setResult] = useState<GradeInput | null>(null)
  const [busy, setBusy] = useState(false)

  const target = normalizeTargetUrl(url, "https")
  const host = hostOf(target)

  const scoredWeights = SECURITY_HEADER_SPECS.filter((spec) => spec.weight > 0)

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shield}
        title="Security Headers Checker"
        description="Grade HTTP security headers from a paste, a relay, or a Mozilla Observatory scan"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Why this tool asks you to paste</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            A page cannot read another site&apos;s security headers. On a cross-origin response the{" "}
            <code className="font-mono text-xs">Headers</code> object exposes only the{" "}
            {CORS_SAFELISTED_RESPONSE_HEADERS.length} CORS-safelisted headers -{" "}
            {CORS_SAFELISTED_RESPONSE_HEADERS.join(", ")} - and every header graded below is outside
            that list. From script they read as absent, which is <strong>not</strong> the same as
            being absent, so a direct fetch would hand you a bogus F. This tool refuses to do that.
          </p>
          <p>
            Instead: paste real <code className="font-mono text-xs">curl</code> output for a grade
            you can trust, ask Mozilla to scan the host, or fetch through the labelled third-party
            relay.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Target</CardTitle>
          <CardDescription>Used to build the curl command and to scan or relay</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sh-url">Website URL</Label>
            <Input
              id="sh-url"
              aria-describedby="sh-url-error sh-observatory-error"
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
            <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
              <TabsTrigger value="paste" className={TRIGGER_CLASS}>
                Paste curl output
              </TabsTrigger>
              <TabsTrigger value="observatory" className={TRIGGER_CLASS}>
                Mozilla Observatory
              </TabsTrigger>
              <TabsTrigger value="relay" className={TRIGGER_CLASS}>
                Third-party relay
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste">
              <Suspense fallback={<PanelFallback />}>
                <PastePanel target={target} hostLabel={host} onGrade={setResult} />
              </Suspense>
            </TabsContent>

            <TabsContent value="observatory">
              <Suspense fallback={<PanelFallback />}>
                <ObservatoryPanel host={host} onBusyChange={setBusy} />
              </Suspense>
            </TabsContent>

            <TabsContent value="relay">
              <Suspense fallback={<PanelFallback />}>
                <RelayPanel
                  target={target}
                  hostLabel={host}
                  onGrade={setResult}
                  onBusyChange={setBusy}
                />
              </Suspense>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* live region: relay and observatory results arrive asynchronously */}
      <div aria-live="polite" aria-busy={busy}>
        {result && (
          <Suspense fallback={<PanelFallback />}>
            <GradeReport input={result} />
          </Suspense>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About security headers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">Why they matter</h4>
              <p className="text-muted-foreground text-sm">
                HTTP security headers defend against XSS, clickjacking, MIME confusion, and protocol
                downgrade. Most are a one-line server or CDN change, which is why their absence is
                treated as a real finding.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">How this score is calculated</h4>
              <p className="text-muted-foreground text-sm">
                Weighted, and only for a header that is actually doing something:{" "}
                {scoredWeights.map((spec) => `${spec.name} ${spec.weight}`).join(", ")}. A header
                whose value is inert earns nothing -{" "}
                <code className="font-mono text-xs">max-age=0</code> switches HSTS off,{" "}
                <code className="font-mono text-xs">x-content-type-options: sniff</code> is not
                nosniff, a report-only CSP blocks nothing, and{" "}
                <code className="font-mono text-xs">ALLOW-FROM</code> is implemented by no current
                browser. Each verdict names the clause it applied.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
