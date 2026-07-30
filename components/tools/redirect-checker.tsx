"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowRight,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Globe,
  Info,
  Terminal,
  Radio,
  ShieldAlert,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { toast } from "sonner"

// verified by curl: this endpoint sends "access-control-allow-origin: *" and returns
// one header block per redirect hop, which is the only way a browser can see a
// cross-origin Location header at all. it is an unaffiliated relay, so label it.
const RELAY_ENDPOINT = "https://api.hackertarget.com/httpheaders/"

interface RedirectHop {
  url: string
  status: number
  statusText: string
  location?: string
  resolved?: string
}

type ChainSource = "pasted" | "relay"

interface RedirectResult {
  source: ChainSource
  originalUrl: string
  finalUrl: string
  hops: RedirectHop[]
  truncated: boolean
  isHttpsUpgrade: boolean
  warnings: string[]
}

interface RawBlock {
  status: number
  statusText: string
  headers: Array<{ name: string; value: string }>
}

// accepts curl -i / curl -D - output with one block per hop
function parseHeaderBlocks(raw: string): RawBlock[] {
  const blocks: RawBlock[] = []
  let current: RawBlock | null = null

  for (const line of raw.split(/\r?\n/)) {
    const statusLine = /^HTTP\/[\d.]+\s+(\d{3})(?:\s+(.*))?$/i.exec(line.trim())
    if (statusLine) {
      current = {
        status: Number(statusLine[1]),
        statusText: (statusLine[2] ?? "").trim(),
        headers: [],
      }
      blocks.push(current)
      continue
    }
    if (!line.trim() || !current) continue
    if (/^[ \t]/.test(line) && current.headers.length > 0) {
      current.headers[current.headers.length - 1].value += ` ${line.trim()}`
      continue
    }
    const split = line.indexOf(":")
    if (split <= 0) continue
    const name = line.slice(0, split).trim()
    if (!name) continue
    current.headers.push({ name, value: line.slice(split + 1).trim() })
  }

  return blocks
}

function headerValue(block: RawBlock, name: string): string | undefined {
  return block.headers.find((h) => h.name.toLowerCase() === name)?.value
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

function buildChain(blocks: RawBlock[], startUrl: string, source: ChainSource): RedirectResult {
  const hops: RedirectHop[] = []
  const warnings: string[] = []
  let currentUrl = startUrl

  for (const block of blocks) {
    const location = headerValue(block, "location")
    const isRedirect = block.status >= 300 && block.status < 400 && !!location

    let resolved: string | undefined
    if (isRedirect && location) {
      try {
        // one resolver for every form of Location: absolute, path-relative,
        // protocol-relative //host/path, and bare relative
        resolved = new URL(location, currentUrl).href
      } catch {
        warnings.push(`Hop ${hops.length + 1} sent an unparsable Location: ${location}`)
      }
    }

    hops.push({
      url: currentUrl,
      status: block.status,
      statusText: block.statusText,
      location: location ?? undefined,
      resolved,
    })

    if (!resolved) break

    if (currentUrl.startsWith("https://") && resolved.startsWith("http://")) {
      warnings.push(`Downgrade at hop ${hops.length}: HTTPS redirected to HTTP (${resolved})`)
    }
    if (hops.some((hop) => hop.url === resolved)) {
      warnings.push(`Redirect loop: ${resolved} appears twice in the chain`)
    }

    currentUrl = resolved
  }

  const last = hops[hops.length - 1]
  const truncated = !!last && last.status >= 300 && last.status < 400 && !!last.location
  if (truncated) {
    warnings.push(
      "The chain still had a redirect when the trace stopped, so the destination shown is not final"
    )
  }
  if (last && last.status >= 400) {
    warnings.push(`The chain ends on an error: ${last.status} ${last.statusText}`.trim())
  }

  const finalUrl = last?.url ?? startUrl
  return {
    source,
    originalUrl: startUrl,
    finalUrl,
    hops,
    truncated,
    isHttpsUpgrade: startUrl.startsWith("http://") && finalUrl.startsWith("https://"),
    warnings,
  }
}

export function RedirectChecker() {
  const [url, setUrl] = useState("http://github.com")
  const [pasted, setPasted] = useState("")
  const [result, setResult] = useState<RedirectResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [relayLoading, setRelayLoading] = useState(false)

  const curlCommand = `curl -sS -o /dev/null -D - -L ${normalizeUrl(url) || "http://example.com"}`

  const tracePasted = () => {
    setError(null)
    if (!pasted.trim()) {
      setError("Paste the output of the curl command above first")
      toast.error("Nothing to trace yet")
      return
    }
    const blocks = parseHeaderBlocks(pasted)
    if (blocks.length === 0) {
      setError(
        "No response blocks found. Each hop must start with a status line like “HTTP/2 301”."
      )
      toast.error("Could not parse a redirect chain")
      return
    }
    setResult(buildChain(blocks, normalizeUrl(url) || "unknown", "pasted"))
    toast.success(`Traced ${blocks.length} hop${blocks.length === 1 ? "" : "s"}`)
  }

  const traceViaRelay = async () => {
    const target = normalizeUrl(url)
    if (!target) {
      setError("Enter a URL first")
      toast.error("Enter a URL first")
      return
    }
    setRelayLoading(true)
    setError(null)
    try {
      const res = await fetch(`${RELAY_ENDPOINT}?q=${encodeURIComponent(target)}`)
      if (!res.ok) throw new Error(`Relay returned HTTP ${res.status}`)
      const text = await res.text()
      if (!/^HTTP\//im.test(text)) {
        // the relay answers plain text on bad input and on daily quota exhaustion
        throw new Error(`Relay could not fetch that URL: ${text.trim().slice(0, 160)}`)
      }
      const blocks = parseHeaderBlocks(text)
      if (blocks.length === 0) throw new Error("Relay returned no parsable response blocks")
      setResult(buildChain(blocks, target, "relay"))
      setPasted(text)
      toast.success("Traced via relay - chain is labelled unverified")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Relay request failed"
      setError(message)
      toast.error(message)
    } finally {
      setRelayLoading(false)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500"
    if (status >= 300 && status < 400) return "bg-blue-500"
    if (status >= 400 && status < 500) return "bg-yellow-500"
    if (status >= 500) return "bg-red-500"
    return "bg-gray-500"
  }

  const getStatusBadgeVariant = (status: number) => {
    if (status >= 200 && status < 300) return "default"
    if (status >= 300 && status < 400) return "secondary"
    return "destructive"
  }

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
            Paste <code className="font-mono text-xs">curl</code> output for a chain you captured
            yourself, or route the trace through a labelled third-party relay.
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
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://example.com"
                className="font-mono"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Use http:// to test HTTPS upgrades
              </p>
            </div>

            <Tabs defaultValue="paste" className="space-y-4">
              <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-2 sm:gap-0 sm:p-1">
                <TabsTrigger
                  value="paste"
                  className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
                >
                  Paste curl output
                </TabsTrigger>
                <TabsTrigger
                  value="relay"
                  className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
                >
                  Third-party relay
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-3">
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Terminal className="h-4 w-4" />
                    Run this, then paste everything it prints
                  </p>
                  <div className="flex items-start gap-2">
                    <pre className="bg-muted/50 flex-1 overflow-x-auto rounded p-3 font-mono text-xs">
                      {curlCommand}
                    </pre>
                    <CopyButton value={curlCommand} variant="outline" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rc-paste">Raw response blocks</Label>
                  <Textarea
                    id="rc-paste"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={
                      "HTTP/1.1 301 Moved Permanently\nlocation: https://example.com/\n\nHTTP/2 200"
                    }
                    className="min-h-40 font-mono text-xs"
                  />
                </div>
                <Button onClick={tracePasted} className="w-full">
                  Trace pasted chain
                </Button>
                <p className="text-muted-foreground text-xs">
                  Fully offline - the paste never leaves your browser.
                </p>
              </TabsContent>

              <TabsContent value="relay" className="space-y-3">
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>The chain comes from an unaffiliated third party</AlertTitle>
                  <AlertDescription className="text-sm">
                    The request goes to <span className="font-mono">api.hackertarget.com</span>. It
                    sees the URL you asked about and can invent, drop, or rewrite any hop. Treat the
                    chain as indicative and confirm with curl before acting on it.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={traceViaRelay}
                  disabled={relayLoading}
                  variant="outline"
                  className="w-full"
                >
                  {relayLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tracing via relay...
                    </>
                  ) : (
                    <>
                      <Radio className="mr-2 h-4 w-4" />
                      Trace via relay
                    </>
                  )}
                </Button>
                <p className="text-muted-foreground text-xs">
                  Rate limited to a small number of free lookups per day per IP. The raw response is
                  copied into the paste box so you can see exactly what came back.
                </p>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Source</span>
                    <Badge variant={result.source === "relay" ? "destructive" : "secondary"}>
                      {result.source === "relay" ? "unverified - via relay" : "your own capture"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Hops</span>
                    <Badge variant="secondary">{result.hops.length}</Badge>
                  </div>
                  {result.isHttpsUpgrade && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">HTTPS upgrade</span>
                      <Badge variant="default" className="bg-green-600">
                        Yes
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    {result.truncated ? "Last URL seen" : "Final URL"}
                  </p>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 font-mono text-xs break-all">{result.finalUrl}</p>
                    <CopyButton value={result.finalUrl} />
                  </div>
                </div>

                {result.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-inside list-disc space-y-1 text-sm">
                        {result.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Redirect chain</CardTitle>
            <CardDescription>
              {result
                ? `${result.hops.length} hop${result.hops.length === 1 ? "" : "s"}${result.source === "relay" ? " - reported by the relay, unverified" : ""}`
                : "Paste or relay a trace to see the chain"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                {result.hops.map((hop, index) => {
                  const isLast = index === result.hops.length - 1
                  return (
                    <div key={`${hop.url}-${index}`} className="relative">
                      {!isLast && <div className="bg-border absolute top-12 left-4 h-full w-0.5" />}
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${getStatusColor(hop.status)} flex-shrink-0 text-sm font-bold text-white`}
                        >
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2 pb-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={getStatusBadgeVariant(hop.status)}>
                              {hop.status} {hop.statusText}
                            </Badge>
                            {isLast &&
                              (result.truncated ? (
                                <Badge variant="outline">Chain truncated - not final</Badge>
                              ) : (
                                <Badge variant="default" className="bg-green-600">
                                  Final
                                </Badge>
                              ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="flex-1 font-mono text-sm break-all">{hop.url}</p>
                            <CopyButton value={hop.url} className="flex-shrink-0" />
                            <a
                              href={hop.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0"
                            >
                              <Button variant="ghost" size="sm" aria-label="Open hop in a new tab">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                          {hop.location && (
                            <div className="text-muted-foreground space-y-1 text-sm">
                              <div className="flex items-start gap-2">
                                <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                <span className="font-mono break-all">
                                  Location: {hop.location}
                                </span>
                              </div>
                              {hop.resolved && hop.resolved !== hop.location && (
                                <p className="pl-6 font-mono text-xs break-all">
                                  resolves to {hop.resolved}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Globe className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">No chain loaded yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                code: 301,
                name: "Moved Permanently",
                desc: "Permanent. Clients may rewrite POST to GET",
              },
              { code: 302, name: "Found", desc: "Temporary. Clients may rewrite POST to GET" },
              { code: 303, name: "See Other", desc: "Redirect to a GET of another resource" },
              { code: 307, name: "Temporary Redirect", desc: "Temporary, method preserved" },
              { code: 308, name: "Permanent Redirect", desc: "Permanent, method preserved" },
              { code: 304, name: "Not Modified", desc: "Not a redirect - use the cached copy" },
            ].map((item) => (
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
