"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Play, StopCircle } from "lucide-react"
import { calculateMedian, calculatePercentile, testRTT } from "@/lib/network-testing"
import type { RTTTestResult } from "@/lib/network-testing"
import { electronNetwork } from "@/lib/electron"
import { formatDuration } from "@/lib/format"

type NativePing = NonNullable<Awaited<ReturnType<typeof electronNetwork.ping>>>

// what actually produced the numbers, which the shared result type cannot say
type Transport = "ICMP echo" | "HTTPS request"

interface RttEntry extends RTTTestResult {
  transport: Transport
}

const MAX_SAMPLES = 50

function fromNativePing(host: string, ping: NativePing): RttEntry {
  const times = ping.times ?? []
  const average = ping.avg
  const jitter =
    times.length > 1
      ? Math.sqrt(times.reduce((sum, t) => sum + Math.pow(t - average, 2), 0) / times.length)
      : 0

  return {
    url: host,
    // the shared result type has no ICMP slot; transport carries the truth
    requestedMethod: "HEAD",
    method: "ICMP",
    mode: "cors",
    samples: times,
    median: calculateMedian(times),
    p95: calculatePercentile(times, 95),
    average,
    min: ping.min,
    max: ping.max,
    jitter,
    packetLoss: ping.packetLoss,
    success: times.length > 0,
    error: times.length === 0 ? (ping.error ?? "No ICMP replies") : undefined,
    timestamp: Date.now(),
    transport: "ICMP echo",
  }
}

export function RTTPanel({ isNative }: { isNative: boolean }) {
  const [url, setUrl] = useState("google.com")
  const [method, setMethod] = useState<"HEAD" | "GET" | "ICMP">("HEAD")
  const [samples, setSamples] = useState("10")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RttEntry[]>([])

  const sampleCount = Math.min(Math.max(Number.parseInt(samples, 10) || 10, 1), MAX_SAMPLES)
  const useICMP = isNative && method === "ICMP"

  const runTest = async () => {
    if (!url.trim()) return

    setRunning(true)
    setError(null)
    try {
      if (useICMP) {
        const host = url
          .trim()
          .replace(/^https?:\/\//, "")
          .split("/")[0]
        const ping = await electronNetwork.ping(host, { count: sampleCount, timeout: 5000 })
        if (!ping) {
          setError("The desktop bridge returned no ping result.")
          return
        }
        setResults((previous) => [fromNativePing(host, ping), ...previous.slice(0, 9)])
      } else {
        const target = url.startsWith("http") ? url : `https://${url.trim()}`
        const result = await testRTT(target, method === "ICMP" ? "HEAD" : method, sampleCount)
        setResults((previous) => [
          { ...result, transport: "HTTPS request" },
          ...previous.slice(0, 9),
        ])
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RTT test failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" aria-hidden="true" />
          <span>Round Trip Time (RTT)</span>
        </CardTitle>
        <CardDescription>
          {useICMP
            ? "ICMP echo requests through the desktop app, with median, jitter and packet loss"
            : "HTTPS request round trips measured with fetch(), with median, jitter and failed-request rate"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            {useICMP ? (
              <>
                <strong>ICMP echo:</strong> the desktop build runs a real ping, so these are
                network-layer round trips with no HTTP involved.
              </>
            ) : (
              <>
                <strong>Not a ping:</strong> an HTTP method is selected, so this is a full HTTPS
                request and response. DNS, TCP, TLS and the server&apos;s own processing are all
                inside the number and it reads higher than ICMP. The endpoint must send CORS
                headers, and a page served over HTTPS cannot measure an http:// endpoint.{" "}
                {isNative
                  ? "This build has real ICMP: pick ICMP Ping (Native) above for network-layer latency."
                  : "Real ICMP needs the desktop app."}
              </>
            )}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="rtt-url">Test URL</Label>
            <Input
              id="rtt-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "rtt-url-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="rtt-method">Method</Label>
            <Select
              value={method}
              onValueChange={(value: "HEAD" | "GET" | "ICMP") => setMethod(value)}
            >
              <SelectTrigger id="rtt-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isNative && <SelectItem value="ICMP">ICMP Ping (Native)</SelectItem>}
                <SelectItem value="HEAD">HTTP HEAD (faster)</SelectItem>
                <SelectItem value="GET">HTTP GET (full request)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rtt-samples">Samples</Label>
            <Input
              id="rtt-samples"
              type="number"
              min="1"
              max={MAX_SAMPLES}
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={runTest} disabled={!url.trim() || running} className="w-full">
          {running ? (
            <>
              <StopCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Testing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" aria-hidden="true" />
              Start RTT Test
            </>
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription id="rtt-url-error">{error}</AlertDescription>
          </Alert>
        )}

        {/* live region so results are announced when the async test lands */}
        <div aria-live="polite" aria-busy={running} className="space-y-4">
          {results.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Enter a URL and start the test - median, jitter and packet loss appear here.
            </p>
          ) : (
            <div className="space-y-4">
              <h4 className="font-semibold">Recent Results</h4>
              {results.map((result, index) => (
                <Card key={`${result.timestamp}-${index}`} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      {result.success ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                          <span className="sr-only">Succeeded. </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                          <span className="sr-only">Failed. </span>
                        </>
                      )}
                      <span className="font-mono text-sm">{result.url}</span>
                      <Badge variant="outline">{result.transport}</Badge>
                      {result.transport === "HTTPS request" && (
                        <>
                          <Badge variant="outline">{result.method}</Badge>
                          {result.requestedMethod !== result.method && (
                            <Badge variant="outline" className="text-xs">
                              Requested {result.requestedMethod}
                            </Badge>
                          )}
                          {result.mode === "no-cors" && (
                            <Badge variant="secondary">no-cors fallback</Badge>
                          )}
                        </>
                      )}
                      {result.packetLoss > 0 && (
                        <Badge variant="destructive">
                          {result.packetLoss.toFixed(1)}%{" "}
                          {result.transport === "ICMP echo" ? "loss" : "failed"}
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {result.success && (
                    <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-6">
                      <div>
                        <span className="text-muted-foreground">Median:</span>
                        <div className="font-mono font-semibold">
                          {formatDuration(result.median)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Average:</span>
                        <div className="font-mono">{formatDuration(result.average)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Jitter:</span>
                        <div className="font-mono">{formatDuration(result.jitter)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Min:</span>
                        <div className="font-mono">{formatDuration(result.min)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max:</span>
                        <div className="font-mono">{formatDuration(result.max)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">P95:</span>
                        <div className="font-mono">{formatDuration(result.p95)}</div>
                      </div>
                    </div>
                  )}

                  {result.success && result.warnings && result.warnings.length > 0 && (
                    <Alert className="mt-3">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-5 text-xs">
                          {result.warnings.map((warning, warningIndex) => (
                            <li key={warningIndex}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {!result.success && (
                    <div className="space-y-2">
                      <div className="text-sm text-red-600">{result.error}</div>
                      {result.errorDetails && result.errorDetails.length > 0 && (
                        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
                          {result.errorDetails.map((detail, detailIndex) => (
                            <li key={detailIndex}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
