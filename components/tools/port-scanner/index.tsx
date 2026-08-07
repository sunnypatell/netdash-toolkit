"use client"

import { Suspense, lazy, useEffect, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Shield, Zap } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { isElectron, electronNetwork } from "@/lib/electron"
import { pageIsHttps } from "@/lib/browser-limits"
import { probePortOverHttp, serviceNameFor, summarizeStates } from "@/lib/port-probe"
import { dateStamp, downloadTextFile } from "@/lib/download"
import type { ScanSession } from "./scan-results"

// one chunk per port-selection mode
const ScanResults = lazy(() => import("./scan-results").then((m) => ({ default: m.ScanResults })))
const ScanHistory = lazy(() => import("./scan-results").then((m) => ({ default: m.ScanHistory })))
const CommonPortsPanel = lazy(() => import("./common"))
const CustomPortsPanel = lazy(() => import("./custom"))

const TABS = ["common", "custom"] as const

function PanelFallback() {
  return (
    <p data-panel-fallback role="status" className="text-muted-foreground p-4 text-sm">
      Loading...
    </p>
  )
}

export function PortScanner() {
  // inputs go in the url, but no scan ever starts from a url parameter
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("common"),
      host: parseAsString.withDefault("example.com"),
      ports: parseAsString.withDefault("80,443,8080"),
    },
    { history: "replace" }
  )
  const { tab, host, ports: customPorts } = query

  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [currentScan, setCurrentScan] = useState<ScanSession | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanSession[]>([])
  const [isNative, setIsNative] = useState(false)

  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  const runScan = async (portList: number[]) => {
    if (!host.trim() || portList.length === 0) return

    setIsScanning(true)
    setScanProgress(0)

    const session: ScanSession = {
      target: host.trim(),
      timestamp: Date.now(),
      results: [],
      completed: false,
      method: isNative ? "tcp-connect" : "http-probe",
    }
    setCurrentScan(session)

    try {
      if (isNative) {
        const nativeResults = await electronNetwork.portScan(host.trim(), portList, {
          timeout: 3000,
          concurrent: 100,
        })
        for (const [i, native] of (nativeResults ?? []).entries()) {
          session.results.push({
            port: native.port,
            service: native.service || serviceNameFor(native.port),
            state: native.state,
            method: "tcp-connect",
            responseTime: native.responseTime,
          })
          setScanProgress(((i + 1) / (nativeResults?.length || 1)) * 100)
          setCurrentScan({ ...session })
        }
      } else {
        const scheme = pageIsHttps() ? "https" : "http"
        for (const [i, port] of portList.entries()) {
          session.results.push(await probePortOverHttp(host.trim(), port, { scheme }))
          setScanProgress(((i + 1) / portList.length) * 100)
          setCurrentScan({ ...session })
        }
      }
    } finally {
      session.completed = true
      setCurrentScan({ ...session })
      setScanHistory((prev) => [session, ...prev.slice(0, 4)])
      setIsScanning(false)
    }
  }

  const exportResults = (session: ScanSession) => {
    const counts = summarizeStates(session.results)
    downloadTextFile(
      JSON.stringify(
        {
          target: session.target,
          timestamp: new Date(session.timestamp).toISOString(),
          method: session.method,
          // stated in the file so nobody mistakes a browser probe for a real scan
          methodNote:
            session.method === "tcp-connect"
              ? "real tcp connect scan (desktop app)"
              : "browser http probe: only 'open' is meaningful. 'unknown' means undeterminable, 'browser-blocked' means the fetch standard refused to send anything to that port.",
          totalPorts: session.results.length,
          counts,
          results: session.results,
        },
        null,
        2
      ),
      `port-scan-${session.target}-${dateStamp(new Date(session.timestamp))}.json`,
      "application/json"
    )
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shield}
        title="Port Scanner"
        description="Scan network hosts for open ports and running services"
      />

      {isNative ? (
        <Alert className="border-green-500/50 bg-green-500/10">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Desktop app:</strong> real TCP connect scanning, so closed and filtered are
            distinguishable and no port is off limits.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Browser mode:</strong> a browser cannot open a raw TCP socket, so this falls
            back to an HTTP probe with three possible outcomes. <strong>open</strong> means
            something genuinely answered an HTTP request there. <strong>unknown</strong> means the
            probe failed and closed, filtered, non-HTTP and content-blocked are indistinguishable.{" "}
            <strong>blocked by browser</strong> means the Fetch Standard&apos;s port blocking list
            refused to send anything at all, so the port&apos;s real state was never tested. Only
            the desktop app does a real TCP connect scan.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scan Configuration</CardTitle>
          <CardDescription>Configure target host and ports to scan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* the shared disclosure is rendered once by ToolShell; this card used to
              repeat the same sentence a second time */}
          <div>
            <Label htmlFor="target-host">Target Host</Label>
            <Input
              id="target-host"
              value={host}
              onChange={(e) => void setQuery({ host: e.target.value })}
              placeholder="example.com or 192.168.1.1"
              disabled={isScanning}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Only scan hosts you own or have written permission to test.
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => void setQuery({ tab: value as (typeof TABS)[number] })}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="common">Common Ports</TabsTrigger>
              <TabsTrigger value="custom">Custom Ports</TabsTrigger>
            </TabsList>

            <TabsContent value="common">
              <Suspense fallback={<PanelFallback />}>
                <CommonPortsPanel
                  disabled={!host.trim() || isScanning}
                  browserMode={!isNative}
                  onScan={runScan}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="custom">
              <Suspense fallback={<PanelFallback />}>
                <CustomPortsPanel
                  value={customPorts}
                  onValueChange={(value) => void setQuery({ ports: value })}
                  disabled={!host.trim() || isScanning}
                  browserMode={!isNative}
                  onScan={runScan}
                />
              </Suspense>
            </TabsContent>
          </Tabs>

          {isScanning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Scanning {host}...</span>
                <span>{scanProgress.toFixed(0)}%</span>
              </div>
              <Progress value={scanProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* live region: probes land one at a time */}
      <div aria-live="polite" aria-busy={isScanning} className="space-y-4 sm:space-y-6">
        {currentScan ? (
          <Suspense fallback={<PanelFallback />}>
            <ScanResults session={currentScan} onExport={exportResults} />
          </Suspense>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Pick ports and start a scan - each port and its state appear here.
          </p>
        )}
      </div>

      {scanHistory.length > 0 && (
        <Suspense fallback={<PanelFallback />}>
          <ScanHistory sessions={scanHistory} onExport={exportResults} />
        </Suspense>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Port Scanning Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold">Common Port Categories</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>
                  • <strong>1-1023:</strong> Well-known/system ports
                </li>
                <li>
                  • <strong>1024-49151:</strong> Registered ports
                </li>
                <li>
                  • <strong>49152-65535:</strong> Dynamic/private ports
                </li>
                <li>
                  • <strong>TCP:</strong> Connection-oriented (most services)
                </li>
                <li>
                  • <strong>UDP:</strong> Connectionless (DNS, DHCP) - not probeable here at all
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">What the service column is</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• A name looked up from a static port table, not a banner read off the wire</li>
                <li>• No service detection or version fingerprinting happens anywhere here</li>
                <li>• An open port may be running something entirely different</li>
                <li>• Only scan systems you own or have permission to test</li>
                <li>• Unauthorized scanning may violate policy or law</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
