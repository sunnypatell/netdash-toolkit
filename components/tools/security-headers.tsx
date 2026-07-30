"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  ExternalLink,
  Terminal,
  Radio,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { toast } from "sonner"

// mdn observatory answers cross-origin requests with "access-control-allow-origin: *"
// (verified by curl). mozilla runs the scan from their own servers, so the result is
// first-party and authoritative for their methodology - not relayed through anyone.
const OBSERVATORY_ENDPOINT = "https://observatory-api.mdn.mozilla.net/api/v2/scan"

// api.hackertarget.com/httpheaders also sends "access-control-allow-origin: *" and
// returns the TARGET's real headers. it is still a third-party relay: it can see the
// request and rewrite the response, so anything from it is labelled and never graded
// as authoritative.
const RELAY_ENDPOINT = "https://api.hackertarget.com/httpheaders/"

interface HeaderSpec {
  name: string
  key: string
  description: string
  recommendation: string
  learnMore: string
  weight: number
  optional?: boolean
}

const SECURITY_HEADER_SPECS: HeaderSpec[] = [
  {
    name: "Strict-Transport-Security",
    key: "strict-transport-security",
    description: "Enforces HTTPS connections and prevents protocol downgrade attacks",
    recommendation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    learnMore:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    weight: 20,
  },
  {
    name: "Content-Security-Policy",
    key: "content-security-policy",
    description: "Controls which resources can be loaded, preventing XSS and data injection",
    recommendation: "Configure CSP based on your app's needs. Start with: default-src 'self'",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    weight: 25,
  },
  {
    name: "X-Frame-Options",
    key: "x-frame-options",
    description: "Prevents clickjacking by controlling iframe embedding",
    recommendation: "Add: X-Frame-Options: DENY or SAMEORIGIN (or CSP frame-ancestors)",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    weight: 15,
  },
  {
    name: "X-Content-Type-Options",
    key: "x-content-type-options",
    description: "Prevents MIME type sniffing attacks",
    recommendation: "Add: X-Content-Type-Options: nosniff",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
    weight: 10,
  },
  {
    name: "Referrer-Policy",
    key: "referrer-policy",
    description: "Controls how much referrer information is sent with requests",
    recommendation: "Add: Referrer-Policy: strict-origin-when-cross-origin",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
    weight: 10,
  },
  {
    name: "Permissions-Policy",
    key: "permissions-policy",
    description: "Controls which browser features can be used (formerly Feature-Policy)",
    recommendation: "Add: Permissions-Policy: geolocation=(), camera=(), microphone=()",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy",
    weight: 10,
  },
  {
    name: "Cross-Origin-Opener-Policy",
    key: "cross-origin-opener-policy",
    description: "Isolates your browsing context from other origins",
    recommendation: "Add: Cross-Origin-Opener-Policy: same-origin",
    learnMore:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
    weight: 10,
  },
  {
    name: "X-XSS-Protection",
    key: "x-xss-protection",
    description:
      "Legacy XSS filter. Deprecated - modern advice is to omit it or send 0 and rely on CSP, so its absence is not a finding",
    recommendation: "No action needed. Use Content-Security-Policy instead",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection",
    weight: 0,
    optional: true,
  },
]

interface GradedHeader {
  name: string
  present: boolean
  value?: string
  optional: boolean
  description: string
  recommendation?: string
  learnMore: string
}

type HeaderSource = "pasted" | "relay"

interface GradeResult {
  label: string
  source: HeaderSource
  status: number
  statusText: string
  blockCount: number
  score: number
  grade: string
  headers: GradedHeader[]
  totalHeaders: number
}

interface ObservatoryResult {
  grade: string
  score: number
  testsPassed: number
  testsFailed: number
  testsQuantity: number
  scannedAt: string
  detailsUrl: string
  host: string
}

interface RawBlock {
  status: number
  statusText: string
  headers: Array<{ name: string; value: string }>
}

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

function toHeaderMap(block: RawBlock): Map<string, string> {
  const map = new Map<string, string>()
  for (const { name, value } of block.headers) {
    const key = name.toLowerCase()
    const existing = map.get(key)
    map.set(key, existing ? `${existing}, ${value}` : value)
  }
  return map
}

function gradeBlocks(blocks: RawBlock[], label: string, source: HeaderSource): GradeResult {
  // a redirect chain ends at the response that actually serves content, so grade the last block
  const final = blocks[blocks.length - 1]
  const map = toHeaderMap(final)

  const headers: GradedHeader[] = SECURITY_HEADER_SPECS.map((spec) => {
    const value = map.get(spec.key)
    return {
      name: spec.name,
      present: value !== undefined,
      value,
      optional: spec.optional ?? false,
      description: spec.description,
      recommendation: value === undefined ? spec.recommendation : undefined,
      learnMore: spec.learnMore,
    }
  })

  let score = 0
  let maxScore = 0
  for (const spec of SECURITY_HEADER_SPECS) {
    if (spec.optional || spec.weight === 0) continue
    maxScore += spec.weight
    if (map.has(spec.key)) score += spec.weight
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  let grade = "F"
  if (percentage >= 90) grade = "A+"
  else if (percentage >= 80) grade = "A"
  else if (percentage >= 70) grade = "B"
  else if (percentage >= 60) grade = "C"
  else if (percentage >= 50) grade = "D"

  return {
    label,
    source,
    status: final.status,
    statusText: final.statusText,
    blockCount: blocks.length,
    score: percentage,
    grade,
    headers,
    totalHeaders: final.headers.length,
  }
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

export function SecurityHeaders() {
  const [url, setUrl] = useState("https://example.com")
  const [pasted, setPasted] = useState("")
  const [result, setResult] = useState<GradeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [relayLoading, setRelayLoading] = useState(false)
  const [observatory, setObservatory] = useState<ObservatoryResult | null>(null)
  const [observatoryLoading, setObservatoryLoading] = useState(false)
  const [observatoryError, setObservatoryError] = useState<string | null>(null)

  const curlCommand = `curl -sS -o /dev/null -D - -L ${normalizeUrl(url) || "https://example.com"}`

  const gradePasted = () => {
    setError(null)
    if (!pasted.trim()) {
      setError("Paste the output of the curl command above first")
      toast.error("Nothing to grade yet")
      return
    }
    const blocks = parseHeaderBlocks(pasted)
    if (blocks.length === 0) {
      setError(
        "No headers found in that paste. Expected lines like “strict-transport-security: max-age=63072000”."
      )
      toast.error("Could not parse any headers")
      return
    }
    setResult(gradeBlocks(blocks, hostOf(url) || "pasted response", "pasted"))
    toast.success("Graded pasted headers")
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
      setResult(gradeBlocks(blocks, hostOf(target), "relay"))
      setPasted(text)
      toast.success("Fetched via relay - result is labelled unverified")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Relay request failed"
      setError(message)
      toast.error(message)
    } finally {
      setRelayLoading(false)
    }
  }

  const runObservatory = async () => {
    const host = hostOf(url)
    if (!host) {
      setObservatoryError("Enter a hostname first")
      toast.error("Enter a hostname first")
      return
    }
    setObservatoryLoading(true)
    setObservatoryError(null)
    setObservatory(null)
    try {
      const res = await fetch(`${OBSERVATORY_ENDPOINT}?host=${encodeURIComponent(host)}`, {
        method: "POST",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message ? String(data.message) : `Observatory returned ${res.status}`)
      }
      if (data?.error) throw new Error(String(data.error))
      setObservatory({
        grade: String(data?.grade ?? "?"),
        score: Number(data?.score ?? 0),
        testsPassed: Number(data?.tests_passed ?? 0),
        testsFailed: Number(data?.tests_failed ?? 0),
        testsQuantity: Number(data?.tests_quantity ?? 0),
        scannedAt: String(data?.scanned_at ?? ""),
        detailsUrl: String(
          data?.details_url ??
            `https://developer.mozilla.org/en-US/observatory/analyze?host=${host}`
        ),
        host,
      })
      toast.success(`Observatory graded ${host}: ${data?.grade ?? "?"}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Observatory scan failed"
      setObservatoryError(message)
      toast.error(message)
    } finally {
      setObservatoryLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-green-600 bg-green-100"
    if (grade.startsWith("B")) return "text-blue-600 bg-blue-100"
    if (grade.startsWith("C")) return "text-yellow-600 bg-yellow-100"
    if (grade === "?") return "text-gray-600 bg-gray-100"
    return "text-red-600 bg-red-100"
  }

  const scored = result?.headers.filter((h) => !h.optional) ?? []

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
            <code className="font-mono text-xs">Headers</code> object only exposes the seven
            CORS-safelisted headers, and every header graded below is outside that list - so a
            direct fetch would report all of them missing and hand you a bogus F. This tool refuses
            to do that.
          </p>
          <p>
            Instead: paste real <code className="font-mono text-xs">curl</code> output for a grade
            you can trust, ask Mozilla to scan the host, or fetch through a labelled third-party
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
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="font-mono"
            />
          </div>

          <Tabs defaultValue="paste" className="space-y-4">
            <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
              <TabsTrigger
                value="paste"
                className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
              >
                Paste curl output
              </TabsTrigger>
              <TabsTrigger
                value="observatory"
                className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
              >
                Mozilla Observatory
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
                <Label htmlFor="sh-paste">Raw response headers</Label>
                <Textarea
                  id="sh-paste"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={"HTTP/2 200\nstrict-transport-security: max-age=63072000\n..."}
                  className="min-h-40 font-mono text-xs"
                />
              </div>
              <Button onClick={gradePasted} className="w-full">
                Grade pasted headers
              </Button>
              <p className="text-muted-foreground text-xs">
                Fully offline - the paste never leaves your browser, and the grade is trustworthy
                because you obtained the headers yourself.
              </p>
            </TabsContent>

            <TabsContent value="observatory" className="space-y-3">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Mozilla scans the host from their own servers, so the grade is theirs and not
                  relayed. Two things to know: the scan is <strong>publicly recorded</strong> on
                  MDN&apos;s Observatory site, and its methodology covers more than headers
                  (redirects, cookies, subresource integrity, CORS policy), so its grade will not
                  match the header checklist below.
                </AlertDescription>
              </Alert>
              <Button onClick={runObservatory} disabled={observatoryLoading} className="w-full">
                {observatoryLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning {hostOf(url)}...
                  </>
                ) : (
                  `Scan ${hostOf(url) || "host"} with Observatory`
                )}
              </Button>
              {observatoryError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{observatoryError}</AlertDescription>
                </Alert>
              )}
              {observatory && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${getGradeColor(observatory.grade)}`}
                    >
                      {observatory.grade}
                    </div>
                    <div>
                      <p className="font-medium">
                        {observatory.host} - score {observatory.score}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {observatory.testsPassed} of {observatory.testsQuantity} tests passed,{" "}
                        {observatory.testsFailed} failed
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Scanned by Mozilla at {observatory.scannedAt || "unknown time"}.{" "}
                    <a
                      href={observatory.detailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Full per-test breakdown on MDN <ExternalLink className="inline h-3 w-3" />
                    </a>
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="relay" className="space-y-3">
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>This route is not trustworthy for a security verdict</AlertTitle>
                <AlertDescription className="text-sm">
                  The request goes to <span className="font-mono">api.hackertarget.com</span>, an
                  unaffiliated third party. It sees the URL you asked about and it can add, drop, or
                  rewrite any header before you see it - so a security grade computed from its
                  output proves nothing about the real server. Use it to get a quick look, then
                  confirm with the curl paste before you act on it.
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
                The relay is rate limited to a small number of free lookups per day per IP. Its raw
                response is copied into the paste box so you can inspect exactly what came back.
              </p>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Header score</CardTitle>
              <CardDescription className="break-all">{result.label}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.source === "relay" ? (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Unverified - via third-party relay.</strong> These headers were reported
                    by api.hackertarget.com, not read from the server by you. Do not treat this
                    grade as authoritative.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Graded from headers you supplied. Nothing was fetched and nothing was uploaded.
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-center">
                <div
                  className={`inline-flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold ${getGradeColor(result.grade)}`}
                >
                  {result.grade}
                </div>
                <p className="mt-2 text-2xl font-bold">{result.score}%</p>
                <p className="text-muted-foreground text-sm">
                  {result.source === "relay" ? "Unverified header score" : "Header score"}
                </p>
              </div>

              <Progress value={result.score} className="h-3" />

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <p className="text-2xl font-bold text-green-600">
                    {scored.filter((h) => h.present).length}
                  </p>
                  <p className="text-muted-foreground text-xs">Present</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-2xl font-bold text-red-600">
                    {scored.filter((h) => !h.present).length}
                  </p>
                  <p className="text-muted-foreground text-xs">Missing</p>
                </div>
              </div>

              <div className="text-muted-foreground space-y-1 text-xs">
                <p>
                  {result.status > 0
                    ? `Graded the final response: ${result.status} ${result.statusText}`
                    : "No status line in the paste - graded the header block as given"}
                </p>
                <p>
                  {result.blockCount > 1
                    ? `${result.blockCount} response blocks found (redirect chain), graded the last one`
                    : `${result.totalHeaders} headers in the response`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Header analysis</CardTitle>
              <CardDescription>
                {result.source === "relay"
                  ? "Values as reported by the relay - unverified"
                  : "Values from your own request"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.headers.map((header) => {
                  const tone = header.optional
                    ? "border-border"
                    : header.present
                      ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                      : "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                  return (
                    <div key={header.name} className={`rounded-lg border p-4 ${tone}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {header.optional ? (
                            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                          ) : header.present ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                          ) : (
                            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-mono text-sm font-medium">{header.name}</p>
                              <Badge
                                variant={
                                  header.optional
                                    ? "outline"
                                    : header.present
                                      ? "default"
                                      : "destructive"
                                }
                              >
                                {header.present
                                  ? "Present"
                                  : header.optional
                                    ? "Not scored"
                                    : "Missing"}
                              </Badge>
                              {result.source === "relay" && header.present && (
                                <Badge variant="outline" className="text-xs">
                                  via relay
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground mt-1 text-sm">
                              {header.description}
                            </p>
                            {header.value && (
                              <p className="text-muted-foreground bg-muted/50 mt-2 rounded p-2 font-mono text-xs break-all">
                                {header.value}
                              </p>
                            )}
                            {header.recommendation && !header.optional && (
                              <div className="mt-2 flex items-start gap-2 text-sm">
                                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                                <span className="text-muted-foreground">
                                  {header.recommendation}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <a
                          href={header.learnMore}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          aria-label={`MDN documentation for ${header.name}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                Weighted presence only: CSP 25, HSTS 20, X-Frame-Options 15, then 10 each for
                X-Content-Type-Options, Referrer-Policy, Permissions-Policy and
                Cross-Origin-Opener-Policy. It does not judge whether a policy&apos;s <em>value</em>{" "}
                is any good - a CSP of <code className="font-mono text-xs">default-src *</code>{" "}
                still counts as present.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
