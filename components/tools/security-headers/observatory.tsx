"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ExternalLink, Info, Loader2 } from "lucide-react"
import { gradeColor } from "./grade-report"

// mdn observatory answers cross-origin requests with "access-control-allow-origin: *"
// (verified by curl). mozilla runs the scan from their own servers, so the result is
// first-party for their methodology and is not relayed through anyone.
const OBSERVATORY_ENDPOINT = "https://observatory-api.mdn.mozilla.net/api/v2/scan"
export const OBSERVATORY_HOST = "observatory-api.mdn.mozilla.net"

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

interface ObservatoryPanelProps {
  host: string
  onBusyChange?: (busy: boolean) => void
}

export default function ObservatoryPanel({ host, onBusyChange }: ObservatoryPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ObservatoryResult | null>(null)

  const setBusy = (busy: boolean) => {
    setLoading(busy)
    onBusyChange?.(busy)
  }

  const run = async () => {
    if (!host) {
      setError("Enter a hostname first")
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`${OBSERVATORY_ENDPOINT}?host=${encodeURIComponent(host)}`, {
        method: "POST",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message ? String(data.message) : `Observatory returned ${res.status}`)
      }
      if (data?.error) throw new Error(String(data.error))
      setResult({
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Observatory scan failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Mozilla scans the host from their own servers, so the grade is theirs and not relayed. The
          request goes to <span className="font-mono">{OBSERVATORY_HOST}</span> and carries the
          hostname. Two things to know: the scan is <strong>publicly recorded</strong> on MDN&apos;s
          Observatory site, and its methodology covers more than headers (redirects, cookies,
          subresource integrity, CORS policy), so its grade will not match the header checklist.
        </AlertDescription>
      </Alert>
      <Button onClick={run} disabled={loading || !host} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Scanning {host}...
          </>
        ) : (
          `Scan ${host || "host"} with Observatory`
        )}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="sh-observatory-error">{error}</AlertDescription>
        </Alert>
      )}
      <div aria-live="polite" aria-busy={loading}>
        {result && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${gradeColor(result.grade)}`}
              >
                {result.grade}
              </div>
              <div>
                <p className="font-medium">
                  {result.host} - score {result.score}
                </p>
                <p className="text-muted-foreground text-sm">
                  {result.testsPassed} of {result.testsQuantity} tests passed, {result.testsFailed}{" "}
                  failed
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Scanned by Mozilla at {result.scannedAt || "unknown time"}.{" "}
              <a
                href={result.detailsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Full per-test breakdown on MDN <ExternalLink className="inline h-3 w-3" />
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
