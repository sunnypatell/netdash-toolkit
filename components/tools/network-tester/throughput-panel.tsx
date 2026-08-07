"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Activity, AlertCircle, CheckCircle, Download, Upload } from "lucide-react"
import { testDownloadThroughput, testUploadThroughput } from "@/lib/network-testing"
import type { ThroughputTestResult } from "@/lib/network-testing"
import { formatBytes, formatDuration } from "@/lib/format"
import { ResultActions } from "./result-actions"

const DEFAULT_UPLOAD_BYTES = 1048576
const MIN_UPLOAD_BYTES = 1024
// the body is allocated in memory before the request starts
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024

function formatThroughput(mbps: number): string {
  if (mbps < 1) return `${(mbps * 1000).toFixed(1)} Kbps`
  if (mbps < 1000) return `${mbps.toFixed(2)} Mbps`
  return `${(mbps / 1000).toFixed(2)} Gbps`
}

type ResolvedTarget = { ok: true; url: string } | { ok: false; error: string }

// same guard testRTT applies internally: a bare host is fine, a scheme the browser refuses is not
function resolveTarget(raw: string): ResolvedTarget {
  const trimmed = raw.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    try {
      parsed = new URL(`https://${trimmed}`)
    } catch {
      return { ok: false, error: "Invalid URL. Enter an http:// or https:// URL" }
    }
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only HTTP and HTTPS URLs can be measured from a browser" }
  }

  if (
    parsed.protocol === "http:" &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:"
  ) {
    return {
      ok: false,
      error:
        "This page is served over HTTPS, so the browser blocks http:// requests entirely. Use an HTTPS endpoint.",
    }
  }

  return { ok: true, url: parsed.toString() }
}

export function ThroughputPanel() {
  const [url, setUrl] = useState("")
  const [uploadSize, setUploadSize] = useState(String(DEFAULT_UPLOAD_BYTES))
  const [direction, setDirection] = useState<"download" | "upload" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ThroughputTestResult[]>([])

  const uploadBytes = Math.min(
    Math.max(Number.parseInt(uploadSize, 10) || DEFAULT_UPLOAD_BYTES, MIN_UPLOAD_BYTES),
    MAX_UPLOAD_BYTES
  )

  const runTest = async (nextDirection: "download" | "upload") => {
    const target = resolveTarget(url)
    if (!target.ok) {
      setError(target.error)
      return
    }

    setDirection(nextDirection)
    setError(null)
    try {
      const result =
        nextDirection === "download"
          ? await testDownloadThroughput(target.url)
          : await testUploadThroughput(target.url, uploadBytes)
      setResults((previous) => [result, ...previous.slice(0, 4)])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Throughput test failed")
    } finally {
      setDirection(null)
    }
  }

  const running = direction !== null

  const resultsText = results
    .map((result) =>
      [
        result.url,
        result.direction,
        result.success
          ? `${formatThroughput(result.throughputMbps)}\t${formatBytes(result.bytesTransferred, { decimals: 2 })}\t${formatDuration(result.durationMs)}`
          : (result.error ?? "failed"),
      ].join("\t")
    )
    .join("\n")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" aria-hidden="true" />
          <span>Throughput</span>
        </CardTitle>
        <CardDescription>
          Single-stream transfer rate to an endpoint you provide, timed with fetch()
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <strong>Not a speed test:</strong> one HTTP stream, timed by the browser, including
            connection setup and whatever the far end is willing to serve. Download timing runs
            until the last body byte arrives; upload timing runs until the response headers come
            back, so the server&apos;s processing is inside the number. Read it as a floor for the
            path, not as link capacity, and expect CORS to decide whether the request happens at
            all.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="throughput-url">Test URL</Label>
            <Input
              id="throughput-url"
              placeholder="https://example.com/testfile"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "throughput-url-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="upload-size">Upload Size (bytes)</Label>
            <Input
              id="upload-size"
              type="number"
              min={MIN_UPLOAD_BYTES}
              max={MAX_UPLOAD_BYTES}
              value={uploadSize}
              onChange={(e) => setUploadSize(e.target.value)}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Uploading {formatBytes(uploadBytes, { decimals: 0 })} of generated bytes.
            </p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={() => runTest("download")}
            disabled={!url.trim() || running}
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Download Test
          </Button>
          <Button
            onClick={() => runTest("upload")}
            disabled={!url.trim() || running}
            className="flex-1"
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Upload Test
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription id="throughput-url-error">{error}</AlertDescription>
          </Alert>
        )}

        <div aria-live="polite" aria-busy={running} className="space-y-4">
          {running && (
            <div className="flex items-center space-x-2 text-sm">
              <Activity className="h-4 w-4 animate-spin" aria-hidden="true" />
              {/* no progress bar: a single fetch cannot report how far along it is */}
              <span>Running {direction} test...</span>
            </div>
          )}

          {results.length === 0 && !running && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Enter a test URL, then run a download or upload test - throughput, bytes transferred
              and duration appear here.
            </p>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold">Recent Results</h4>
                <ResultActions
                  kind="throughput"
                  measurement="single-stream HTTP transfer timed by the browser, a floor for the path rather than link capacity"
                  results={results}
                  text={resultsText}
                />
              </div>
              {results.map((result, index) => (
                <Card key={`${result.timestamp}-${index}`} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
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
                    <span className="font-mono text-sm break-all">{result.url}</span>
                    <Badge variant={result.direction === "download" ? "secondary" : "outline"}>
                      {result.direction}
                    </Badge>
                  </div>

                  {result.success ? (
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">Throughput:</span>
                        <div className="font-mono font-semibold">
                          {formatThroughput(result.throughputMbps)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data Transferred:</span>
                        <div className="font-mono">
                          {formatBytes(result.bytesTransferred, { decimals: 2 })}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duration:</span>
                        <div className="font-mono">{formatDuration(result.durationMs)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">{result.error}</div>
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
