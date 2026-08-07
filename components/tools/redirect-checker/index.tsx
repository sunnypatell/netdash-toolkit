"use client"

import { Suspense, lazy, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Globe, Info } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { normalizeTargetUrl } from "@/lib/http-relay"
import type { TracedChain } from "./chain-view"

// one chunk per acquisition method; only the open tab is fetched and mounted
const ChainSummary = lazy(() => import("./chain-view").then((m) => ({ default: m.ChainSummary })))
const ChainView = lazy(() => import("./chain-view").then((m) => ({ default: m.ChainView })))
const PastePanel = lazy(() => import("./paste"))
const RelayPanel = lazy(() => import("./relay"))

const TABS = ["paste", "relay"] as const

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

const REDIRECT_CODES = [
  { code: 301, name: "Moved Permanently", desc: "Permanent. Clients rewrite POST to GET" },
  { code: 302, name: "Found", desc: "Temporary. Clients rewrite POST to GET" },
  { code: 303, name: "See Other", desc: "Always redirect to a GET of another resource" },
  { code: 307, name: "Temporary Redirect", desc: "Temporary, method and body preserved" },
  { code: 308, name: "Permanent Redirect", desc: "Permanent, method and body preserved" },
  {
    code: 304,
    name: "Not Modified",
    desc: "Not a redirect - use the cached copy (RFC 9110 §15.4.5)",
  },
]

function PanelFallback() {
  return (
    <p data-panel-fallback role="status" className="text-muted-foreground p-4 text-sm">
      Loading...
    </p>
  )
}

export function RedirectChecker() {
  // the starting url lives in the query string so a trace is a shareable link.
  // arriving with ?url= set traces nothing until a button is pressed.
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("paste"),
      url: parseAsString.withDefault("http://example.com"),
    },
    { history: "replace" }
  )
  const { tab, url } = query

  const [result, setResult] = useState<TracedChain | null>(null)
  const [busy, setBusy] = useState(false)

  const target = normalizeTargetUrl(url, "http")

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe}
        title="Redirect Checker"
        description="Trace an HTTP redirect chain hop by hop and flag downgrades and loops"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Why a browser cannot trace this by itself</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            Fetching a cross-origin URL with{" "}
            <code className="font-mono text-xs">redirect: &quot;manual&quot;</code> returns an{" "}
            <em>opaque-redirect</em> response: status <code className="font-mono text-xs">0</code>,
            no headers, and no readable <code className="font-mono text-xs">Location</code>. Letting
            the browser follow the chain instead hides every intermediate hop. Either way the chain
            is invisible to JavaScript, so this tool does not pretend to walk it.
          </p>
          <p>
            On top of that, a page served over HTTPS cannot fetch an{" "}
            <code className="font-mono text-xs">http://</code> URL at all - the browser blocks it as
            mixed content before it leaves. An http:// start is exactly what you want when checking
            an HTTPS upgrade, so it has to come from <code className="font-mono text-xs">curl</code>{" "}
            or from the labelled third-party relay.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Start URL and how to obtain the chain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="rc-url">Starting URL</Label>
              <Input
                id="rc-url"
                aria-describedby="rc-url-error"
                value={url}
                onChange={(e) => void setQuery({ url: e.target.value })}
                placeholder="http://example.com"
                className="font-mono"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Use http:// to test HTTPS upgrades
              </p>
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
                  <PastePanel target={target} onTrace={setResult} />
                </Suspense>
              </TabsContent>

              <TabsContent value="relay">
                <Suspense fallback={<PanelFallback />}>
                  <RelayPanel target={target} onTrace={setResult} onBusyChange={setBusy} />
                </Suspense>
              </TabsContent>
            </Tabs>

            {result && (
              <Suspense fallback={<PanelFallback />}>
                <ChainSummary result={result} />
              </Suspense>
            )}
          </CardContent>
        </Card>

        {/* live region: the relay result arrives asynchronously */}
        <div aria-live="polite" aria-busy={busy} className="lg:col-span-2">
          <Suspense fallback={<PanelFallback />}>
            <ChainView result={result} />
          </Suspense>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What this trace does not cover</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            Only HTTP-level redirects appear here. A chain can also continue through an HTML{" "}
            <code className="font-mono text-xs">&lt;meta http-equiv=&quot;refresh&quot;&gt;</code>{" "}
            tag, a JavaScript <code className="font-mono text-xs">location.assign()</code>, or an
            HSTS-driven upgrade that a client applies before any request leaves - none of which emit
            a <code className="font-mono text-xs">Location</code> header.
          </p>
          <p>
            Redirects can also vary by user agent, cookies, and geography, so a chain captured from
            one place is not guaranteed to be the chain your users get.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HTTP redirect status codes</CardTitle>
          <CardDescription>
            RFC 9110 §15.4. Only 300, 301, 302, 303, 307 and 308 carry a Location that a client
            follows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {REDIRECT_CODES.map((item) => (
              <div key={item.code} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.code}</Badge>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
