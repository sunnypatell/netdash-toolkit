"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Activity, AlertCircle, CheckCircle, Clock, Download } from "lucide-react"
import { HTTP_FROM_HTTPS_EXPLANATION } from "@/lib/browser-limits"
import {
  attemptHttpProbe,
  describeTransport,
  formatProbeError,
  parsePingTarget,
  transportForUrl,
  type ReachabilityResult,
} from "@/lib/browser-ping"
import { electronNetwork } from "@/lib/electron"
import { CopyButton } from "@/components/ui/copy-button"
import { dateStamp, downloadTextFile } from "@/lib/download"

interface PingPanelProps {
  host: string
  onHostChange: (host: string) => void
  isNative: boolean
}

export default function PingPanel({ host, onHostChange, isNative }: PingPanelProps) {
  const [results, setResults] = useState<ReachabilityResult[]>([])
  const [isPinging, setIsPinging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const record = (result: ReachabilityResult) => setResults((prev) => [result, ...prev.slice(0, 9)])

  const performPing = async () => {
    if (!host.trim()) return
    setValidationError(null)
    setNotice(null)
    setIsPinging(true)

    try {
      if (isNative) {
        const bare = host
          .trim()
          .replace(/^https?:\/\//, "")
          .split("/")[0]
        const native = await electronNetwork.ping(bare, { count: 4, timeout: 5000 })
        if (!native) {
          setValidationError("The desktop pinger did not answer")
          return
        }
        record({
          host: bare,
          timestamp: Date.now(),
          success: native.alive,
          // the one place in this app where a latency figure really is icmp rtt
          transport: "icmp",
          roundTripMs: native.avg,
          minMs: native.min,
          maxMs: native.max,
          packetsSent: native.times?.length || 4,
          packetLossPercent: native.packetLoss,
          error: native.error,
        })
        return
      }

      const target = parsePingTarget(host)
      if (!target) {
        setValidationError("Invalid hostname or IP address")
        return
      }
      if (target.insecureDropped) {
        setNotice(
          `${HTTP_FROM_HTTPS_EXPLANATION} The http:// probe you asked for was not sent; what follows is an https:// probe of the same host.`
        )
      }
      if (target.urls.length === 0) {
        setValidationError(HTTP_FROM_HTTPS_EXPLANATION)
        return
      }

      let schemeFallback = false
      let lastError: unknown = null

      for (const url of target.urls) {
        const attempt = await attemptHttpProbe(url)
        if (attempt.success) {
          record({
            host: target.displayHost,
            timestamp: Date.now(),
            success: true,
            transport: transportForUrl(url),
            roundTripMs: attempt.roundTripMs,
            methodUsed: attempt.methodUsed,
            schemeFallback: schemeFallback || attempt.methodFallback,
          })
          return
        }
        schemeFallback = true
        lastError = attempt.error
      }

      const lastUrl = target.urls[target.urls.length - 1]
      record({
        host: target.displayHost,
        timestamp: Date.now(),
        success: false,
        transport: transportForUrl(lastUrl),
        schemeFallback,
        error: formatProbeError(lastError),
      })
    } finally {
      setIsPinging(false)
    }
  }

  // each line names the transport, so a paste cannot be read as an ICMP figure
  const resultsText = results
    .map((result) =>
      [
        new Date(result.timestamp).toISOString(),
        result.host,
        describeTransport(result.transport),
        result.success ? `${result.roundTripMs?.toFixed(1)}ms` : (result.error ?? "failed"),
      ].join("\t")
    )
    .join("\n")

  const exportResults = () => {
    downloadTextFile(
      JSON.stringify(
        {
          type: "reachability",
          timestamp: new Date().toISOString(),
          // say what was measured, in the file, so the numbers cannot be misread
          measurement: isNative ? describeTransport("icmp") : describeTransport("https-round-trip"),
          results,
        },
        null,
        2
      ),
      `ping-results-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>{isNative ? "Ping Test" : "Reachability Test"}</span>
        </CardTitle>
        <CardDescription>
          {isNative
            ? "Sends four ICMP echo requests and reports their round-trip time"
            : "Measures one HTTPS round trip: DNS, TCP handshake, TLS handshake, request and response"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <Label htmlFor="ping-host">Hostname or IP Address</Label>
            <Input
              id="ping-host"
              value={host}
              onChange={(e) => {
                onHostChange(e.target.value)
                if (validationError) setValidationError(null)
              }}
              placeholder="example.com or 8.8.8.8"
              onKeyDown={(e) => e.key === "Enter" && !isPinging && performPing()}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? "ping-host-error" : undefined}
            />
            {validationError && (
              <p id="ping-host-error" role="status" className="text-destructive mt-1 text-xs">
                {validationError}
              </p>
            )}
          </div>
          <div className="flex items-end">
            <Button onClick={performPing} disabled={!host.trim() || isPinging}>
              <Activity className={`mr-2 h-4 w-4 ${isPinging ? "animate-spin" : ""}`} />
              {isPinging ? "Testing..." : isNative ? "Ping" : "Test"}
            </Button>
          </div>
        </div>

        {/* set from performPing, so it needs a role of its own: a plain Alert has none */}
        {notice && (
          <Alert role="status">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{notice}</AlertDescription>
          </Alert>
        )}

        {/* live region: each probe resolves asynchronously */}
        <div aria-live="polite" aria-busy={isPinging}>
          {results.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              {isNative
                ? "Enter a host and press Ping - round-trip time and packet loss appear here."
                : "Enter a host and press Test - the HTTPS round trip appears here."}
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Results</h4>
                <div className="flex items-center gap-2">
                  <CopyButton value={resultsText} variant="outline" />
                  <Button variant="outline" size="sm" onClick={exportResults}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="max-h-96 space-y-2 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className="bg-muted/50 space-y-2 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <div className="font-mono text-sm">{result.host}</div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="mb-1 flex flex-wrap items-center justify-end gap-1">
                          <Badge variant="outline" className="text-[0.625rem]">
                            {result.transport === "icmp" ? "ICMP" : result.transport.split("-")[0]}
                          </Badge>
                          {result.methodUsed && (
                            <Badge variant="outline" className="text-[0.625rem]">
                              {result.methodUsed}
                            </Badge>
                          )}
                          {result.schemeFallback && (
                            <Badge variant="secondary" className="text-[0.625rem]">
                              Fallback
                            </Badge>
                          )}
                        </div>
                        {result.success ? (
                          <div className="flex items-center space-x-2">
                            <Clock className="h-3 w-3 text-blue-600" />
                            <span className="font-mono text-sm">
                              {result.roundTripMs?.toFixed(1)}ms
                            </span>
                          </div>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            {result.error}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {describeTransport(result.transport)}
                      {result.packetLossPercent !== undefined &&
                        `. ${result.packetsSent ?? 4} echoes, ${result.packetLossPercent}% loss, min ${result.minMs?.toFixed(1)}ms / max ${result.maxMs?.toFixed(1)}ms`}
                      {result.transport !== "icmp" &&
                        result.success &&
                        ". A repeat measurement to the same host is usually much faster because the connection is already warm."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
