"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Activity, AlertCircle, Clock, Download, Navigation } from "lucide-react"
import { electronNetwork } from "@/lib/electron"
import { CopyButton } from "@/components/ui/copy-button"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { toast } from "sonner"

interface TracerouteHop {
  hop: number
  host: string
  responseTime?: number
  timeout: boolean
}

interface TraceroutePanelProps {
  host: string
  onHostChange: (host: string) => void
  isNative: boolean
}

export default function TraceroutePanel({ host, onHostChange, isNative }: TraceroutePanelProps) {
  const [hops, setHops] = useState<TracerouteHop[]>([])
  const [isTracing, setIsTracing] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [activeTarget, setActiveTarget] = useState<string | null>(null)

  const performTraceroute = async () => {
    const target = host
      .trim()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
    if (!target) return

    setUnsupported(false)
    setIsTracing(true)
    setHops([])
    setActiveTarget(target)

    try {
      if (isNative) {
        const native = await electronNetwork.traceroute(target, { maxHops: 30, timeout: 5000 })
        for (const hop of native?.hops ?? []) {
          setHops((prev) => [
            ...prev,
            {
              hop: hop.hop,
              host: hop.hostname || hop.ip,
              responseTime:
                hop.rtt.length > 0
                  ? hop.rtt.reduce((a, b) => a + b, 0) / hop.rtt.length
                  : undefined,
              timeout: hop.timeout,
            },
          ])
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        return
      }

      // a browser cannot set per-packet ttl, so there is no way to discover hops.
      // this used to return 5 hardcoded hops with random jitter.
      setUnsupported(true)
      toast.error("Traceroute needs the desktop app", {
        description: "Browsers cannot set packet TTL, so intermediate hops cannot be discovered.",
      })
    } finally {
      setIsTracing(false)
    }
  }

  const hopsText = hops
    .map((hop) =>
      [hop.hop, hop.host, hop.timeout ? "no reply" : `${hop.responseTime?.toFixed(1)}ms`].join("\t")
    )
    .join("\n")

  const exportResults = () => {
    downloadTextFile(
      JSON.stringify(
        {
          type: "traceroute",
          timestamp: new Date().toISOString(),
          measurement: "system traceroute (desktop app), averaged RTT per hop",
          destination: activeTarget,
          results: hops,
        },
        null,
        2
      ),
      `traceroute-results-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Navigation className="h-5 w-5" />
          <span>Traceroute</span>
        </CardTitle>
        <CardDescription>
          Trace the network path packets take to reach a destination
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isNative && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Not available in a browser.</strong> Traceroute works by sending packets with
              an increasing TTL and reading the ICMP time-exceeded replies. A browser exposes no way
              to set TTL and no way to read ICMP, so hops cannot be discovered at all. The desktop
              app runs the real system traceroute.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-4">
          <div className="flex-1">
            <Label htmlFor="traceroute-host">Hostname or IP Address</Label>
            <Input
              id="traceroute-host"
              value={host}
              onChange={(e) => onHostChange(e.target.value)}
              placeholder="example.com or 8.8.8.8"
              onKeyDown={(e) => e.key === "Enter" && !isTracing && performTraceroute()}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={performTraceroute} disabled={!host.trim() || isTracing}>
              <Navigation className={`mr-2 h-4 w-4 ${isTracing ? "animate-spin" : ""}`} />
              {isTracing ? "Tracing..." : "Traceroute"}
            </Button>
          </div>
        </div>

        {/* set after the attempt resolves, so it needs a role of its own */}
        {unsupported && (
          <Alert role="status">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nothing was sent. There is no browser API that could discover a single hop, so no
              partial or estimated path is shown.
            </AlertDescription>
          </Alert>
        )}

        {/* live region: hops stream in one at a time */}
        <div aria-live="polite" aria-busy={isTracing}>
          {hops.length === 0 && !isTracing && !unsupported && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Enter a host and press Traceroute - each discovered hop appears here.
            </p>
          )}

          {(hops.length > 0 || isTracing) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Route to {activeTarget || host}</h4>
                {hops.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CopyButton value={hopsText} variant="outline" />
                    <Button variant="outline" size="sm" onClick={exportResults}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {hops.map((hop, index) => (
                  <div
                    key={index}
                    className="bg-muted/50 flex items-center space-x-4 rounded-lg p-3"
                  >
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                      <span className="text-primary text-sm font-medium">{hop.hop}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-mono text-sm">{hop.host}</div>
                    </div>
                    <div className="text-right">
                      {hop.timeout ? (
                        <Badge variant="secondary" className="text-xs">
                          No reply
                        </Badge>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-3 w-3 text-blue-600" />
                          <span className="font-mono text-sm">
                            {hop.responseTime?.toFixed(1)}ms
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isTracing && (
                  <div className="bg-muted/30 flex items-center space-x-4 rounded-lg p-3">
                    <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                      <Activity className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="text-muted-foreground flex-1">Discovering next hop...</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
