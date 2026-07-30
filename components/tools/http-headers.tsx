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
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Terminal,
  Radio,
  ShieldAlert,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { downloadTextFile, dateStamp } from "@/lib/download"
import { toast } from "sonner"

// verified by curl: this endpoint sends "access-control-allow-origin: *" and returns
// the target's real headers, including one block per redirect hop. it is still an
// unaffiliated relay, so everything it returns is labelled as such.
const RELAY_ENDPOINT = "https://api.hackertarget.com/httpheaders/"

interface HeaderInfo {
  name: string
  value: string
  category: "security" | "cache" | "content" | "cors" | "other"
  description?: string
}

interface RawBlock {
  status: number
  statusText: string
  headers: Array<{ name: string; value: string }>
}

type HeaderSource = "pasted" | "relay"

interface AnalysisResult {
  label: string
  source: HeaderSource
  blocks: RawBlock[]
}

const HEADER_CATEGORIES: Record<string, { category: HeaderInfo["category"]; description: string }> =
  {
    "content-type": {
      category: "content",
      description: "Specifies the media type of the resource",
    },
    "content-length": { category: "content", description: "Size of the response body in bytes" },
    "content-encoding": { category: "content", description: "Compression algorithm used" },
    "content-disposition": {
      category: "content",
      description: "Whether the body is shown inline or downloaded",
    },
    "cache-control": { category: "cache", description: "Caching directives for browsers and CDNs" },
    expires: { category: "cache", description: "Date/time after which the response is stale" },
    etag: { category: "cache", description: "Identifier for a specific version of the resource" },
    "last-modified": { category: "cache", description: "Date the resource was last modified" },
    age: { category: "cache", description: "Seconds the response has sat in a cache" },
    vary: { category: "cache", description: "Request headers that change the cached response" },
    "strict-transport-security": { category: "security", description: "Forces HTTPS connections" },
    "content-security-policy": {
      category: "security",
      description: "Controls resources the browser can load",
    },
    "content-security-policy-report-only": {
      category: "security",
      description: "CSP in monitor mode - reports violations without blocking",
    },
    "x-frame-options": { category: "security", description: "Prevents clickjacking attacks" },
    "x-content-type-options": { category: "security", description: "Prevents MIME type sniffing" },
    "x-xss-protection": { category: "security", description: "XSS filter (legacy, deprecated)" },
    "referrer-policy": { category: "security", description: "Controls referrer information" },
    "permissions-policy": { category: "security", description: "Controls browser feature access" },
    "cross-origin-opener-policy": {
      category: "security",
      description: "Isolates the browsing context from other origins",
    },
    "cross-origin-resource-policy": {
      category: "security",
      description: "Restricts which origins may embed this resource",
    },
    "set-cookie": {
      category: "security",
      description: "Sets a cookie - check Secure and HttpOnly",
    },
    "access-control-allow-origin": { category: "cors", description: "Allowed origins for CORS" },
    "access-control-allow-methods": {
      category: "cors",
      description: "Allowed HTTP methods for CORS",
    },
    "access-control-allow-headers": { category: "cors", description: "Allowed headers for CORS" },
    "access-control-expose-headers": {
      category: "cors",
      description: "Response headers scripts are allowed to read",
    },
    "access-control-allow-credentials": {
      category: "cors",
      description: "Whether credentialed CORS requests are allowed",
    },
    location: { category: "other", description: "Target of a redirect" },
    server: { category: "other", description: "Software identified by the origin server" },
  }

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
]

// accepts curl -i / curl -D - output, including multiple blocks from a redirect chain,
// and tolerates a paste that is only "name: value" lines with no status line
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
    if (!line.trim()) continue
    if (!current) {
      current = { status: 0, statusText: "", headers: [] }
      blocks.push(current)
    }
    // obs-fold: a leading space continues the previous header value
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

  return blocks.filter((block) => block.headers.length > 0 || block.status > 0)
}

function categorize(block: RawBlock): HeaderInfo[] {
  return block.headers
    .map(({ name, value }) => {
      const info = HEADER_CATEGORIES[name.toLowerCase()]
      return {
        name,
        value,
        category: info?.category ?? "other",
        description: info?.description,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function hostOf(input: string): string {
  try {
    return new URL(normalizeUrl(input)).hostname
  } catch {
    return input.trim()
  }
}

export function HTTPHeaders() {
  const [url, setUrl] = useState("https://example.com")
  const [pasted, setPasted] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [blockIndex, setBlockIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [relayLoading, setRelayLoading] = useState(false)

  const curlCommand = `curl -sS -o /dev/null -D - -L ${normalizeUrl(url) || "https://example.com"}`

  const applyBlocks = (blocks: RawBlock[], label: string, source: HeaderSource) => {
    setResult({ label, source, blocks })
    setBlockIndex(blocks.length - 1)
  }

  const analyzePasted = () => {
    setError(null)
    if (!pasted.trim()) {
      setError("Paste the output of the curl command above first")
      toast.error("Nothing to analyze yet")
      return
    }
    const blocks = parseHeaderBlocks(pasted)
    if (blocks.length === 0) {
      setError(
        "No headers found in that paste. Expected lines like “content-type: text/html; charset=utf-8”."
      )
      toast.error("Could not parse any headers")
      return
    }
    applyBlocks(blocks, hostOf(url) || "pasted response", "pasted")
    toast.success(`Parsed ${blocks.length} response block${blocks.length === 1 ? "" : "s"}`)
  }

  const fetchViaRelay = async () => {
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
      if (blocks.length === 0) throw new Error("Relay returned no parsable headers")
      applyBlocks(blocks, hostOf(target), "relay")
      setPasted(text)
      toast.success("Fetched via relay - values are labelled unverified")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Relay request failed"
      setError(message)
      toast.error(message)
    } finally {
      setRelayLoading(false)
    }
  }

  const active = result?.blocks[Math.min(blockIndex, result.blocks.length - 1)]
  const headers = active ? categorize(active) : []
  const presentSecurity = SECURITY_HEADERS.filter((key) =>
    headers.some((h) => h.name.toLowerCase() === key)
  )

  const exportHeaders = () => {
    if (!result || !active) return
    downloadTextFile(
      JSON.stringify(
        {
          target: result.label,
          source:
            result.source === "relay"
              ? "api.hackertarget.com relay (unverified third party)"
              : "pasted by the user",
          status: active.status,
          statusText: active.statusText,
          headers: headers.reduce<Record<string, string>>((acc, h) => {
            acc[h.name] = h.value
            return acc
          }, {}),
        },
        null,
        2
      ),
      `headers-${result.label || "response"}-${dateStamp()}.json`,
      "application/json"
    )
  }

  const getCategoryColor = (category: HeaderInfo["category"]) => {
    switch (category) {
      case "security":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "cache":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "content":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20"
      case "cors":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
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
            <code className="font-mono text-xs">Headers</code> object exposes only the seven
            CORS-safelisted headers unless the server opts in with{" "}
            <code className="font-mono text-xs">Access-Control-Expose-Headers</code> - so a direct
            fetch would show almost nothing and imply the rest is absent.
          </p>
          <p>
            Paste real <code className="font-mono text-xs">curl</code> output for the true picture,
            or fetch through a labelled third-party relay for a quick look.
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
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="font-mono"
              />
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
                  <Label htmlFor="hh-paste">Raw response headers</Label>
                  <Textarea
                    id="hh-paste"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={"HTTP/2 200\ncontent-type: text/html; charset=utf-8\n..."}
                    className="min-h-40 font-mono text-xs"
                  />
                </div>
                <Button onClick={analyzePasted} className="w-full">
                  Analyze pasted headers
                </Button>
                <p className="text-muted-foreground text-xs">
                  Fully offline - the paste never leaves your browser.
                </p>
              </TabsContent>

              <TabsContent value="relay" className="space-y-3">
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Values come from an unaffiliated third party</AlertTitle>
                  <AlertDescription className="text-sm">
                    The request goes to <span className="font-mono">api.hackertarget.com</span>. It
                    sees the URL you asked about and can add, drop, or rewrite any header before you
                    see it. Useful for a quick look, not for a security decision - confirm with the
                    curl paste before acting on anything.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={fetchViaRelay}
                  disabled={relayLoading}
                  variant="outline"
                  className="w-full"
                >
                  {relayLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching via relay...
                    </>
                  ) : (
                    <>
                      <Radio className="mr-2 h-4 w-4" />
                      Fetch headers via relay
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

            {result && active && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="font-mono text-lg">
                      {active.status > 0
                        ? `${active.status} ${active.statusText}`.trim()
                        : "no status line"}
                    </p>
                  </div>
                  <Badge variant={result.source === "relay" ? "destructive" : "secondary"}>
                    {result.source === "relay" ? "unverified - via relay" : "from your own request"}
                  </Badge>
                </div>

                {result.blocks.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Redirect chain - {result.blocks.length} responses
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.blocks.map((block, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={i === blockIndex ? "default" : "outline"}
                          onClick={() => setBlockIndex(i)}
                        >
                          {i + 1}. {block.status || "?"}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Security headers on this response: {presentSecurity.length} of{" "}
                    {SECURITY_HEADERS.length}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {result.source === "relay"
                      ? "Counted from relayed values, so this is indicative only - it is not a verified assessment of the server."
                      : "Counted from the headers you captured yourself."}{" "}
                    Presence is not correctness: a weak policy still counts as present.
                  </p>
                </div>

                <Button variant="outline" size="sm" onClick={exportHeaders}>
                  Export JSON
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Response headers</span>
              {active && <Badge variant="secondary">{headers.length} headers</Badge>}
            </CardTitle>
            <CardDescription>
              {result ? `Headers for ${result.label}` : "Paste or fetch headers to see them here"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <div className="max-h-[500px] space-y-2 overflow-y-auto">
                {headers.map((header, index) => (
                  <div key={`${header.name}-${index}`} className="space-y-1 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className={getCategoryColor(header.category)}>
                          {header.category}
                        </Badge>
                        <span className="truncate font-mono text-sm font-medium">
                          {header.name}
                        </span>
                      </div>
                      <CopyButton value={header.value} className="flex-shrink-0" />
                    </div>
                    <p className="text-muted-foreground font-mono text-xs break-all">
                      {header.value}
                    </p>
                    {header.description && (
                      <p className="text-muted-foreground text-xs">{header.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">No headers loaded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security headers reference</CardTitle>
          <CardDescription>
            {result
              ? result.source === "relay"
                ? "Ticks reflect relayed values - unverified"
                : "Ticks reflect the headers you captured"
              : "Load a response to see which of these are set"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SECURITY_HEADERS.map((header) => {
              const hasHeader = headers.some((h) => h.name.toLowerCase() === header)
              return (
                <div key={header} className="flex items-start gap-2 rounded-lg border p-3">
                  {!active ? (
                    <Info className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0" />
                  ) : hasHeader ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="font-mono text-sm font-medium">{header}</p>
                    <p className="text-muted-foreground text-xs">
                      {HEADER_CATEGORIES[header]?.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
