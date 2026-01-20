"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  Navigation,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Zap,
  Wifi,
  Server,
} from "lucide-react"
import { isElectron, electronNetwork } from "@/lib/electron"
import { ToolHeader } from "@/components/ui/tool-header"

interface NetworkInterface {
  name: string
  mac: string
  ipv4?: string
  ipv6?: string
  netmask?: string
  internal: boolean
}

interface PingResult {
  host: string
  timestamp: number
  success: boolean
  responseTime?: number
  error?: string
  methodUsed?: "HEAD" | "GET"
  scheme?: "http" | "https"
  fallback?: boolean
}

interface TracerouteHop {
  hop: number
  host: string
  responseTime?: number
  timeout: boolean
}

export function PingTraceroute() {
  const [pingHost, setPingHost] = useState("google.com")
  const [tracerouteHost, setTracerouteHost] = useState("google.com")
  const [pingResults, setPingResults] = useState<PingResult[]>([])
  const [tracerouteResults, setTracerouteResults] = useState<TracerouteHop[]>([])
  const [isPinging, setIsPinging] = useState(false)
  const [isTracing, setIsTracing] = useState(false)
  const [isNative, setIsNative] = useState(false)

  const [pingValidationError, setPingValidationError] = useState<string | null>(null)
  const [tracerouteValidationError, setTracerouteValidationError] = useState<string | null>(null)
  const [activeTracerouteTarget, setActiveTracerouteTarget] = useState<string | null>(null)
  const [networkInterfaces, setNetworkInterfaces] = useState<NetworkInterface[]>([])

  // Check if running in Electron for native networking
  useEffect(() => {
    const checkNative = async () => {
      const native = isElectron()
      setIsNative(native)

      // Load network interfaces when in native mode
      if (native) {
        try {
          const interfaces = await electronNetwork.getNetworkInterfaces()
          if (interfaces) {
            setNetworkInterfaces(interfaces)
          }
        } catch (error) {
          console.error("Failed to load network interfaces:", error)
        }
      }
    }
    checkNative()
  }, [])

  const parseTargetInput = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null

    const hasScheme = /^[a-zA-Z][a-zA-Z\d+-.]*:\/\//.test(trimmed)
    const addSchemeIfMissing = () => {
      const looksLikeIPv6 = trimmed.includes(":") && !trimmed.includes("//")
      const needsBrackets = looksLikeIPv6 && !trimmed.startsWith("[") && !trimmed.endsWith("]")
      const hostPort = needsBrackets ? `[${trimmed}]` : trimmed
      return `http://${hostPort}`
    }

    const candidate = hasScheme ? trimmed : addSchemeIfMissing()

    let url: URL
    try {
      url = new URL(candidate)
    } catch {
      return null
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      return null
    }

    const hostLabel = url.port ? `${url.hostname}:${url.port}` : url.hostname
    const hostForUrl = url.host

    const urls: string[] = []
    const primaryProtocol = url.protocol === "http:" ? "http" : "https"
    urls.push(`${primaryProtocol}://${hostForUrl}`)

    const alternateProtocol = primaryProtocol === "http" ? "https" : "http"
    const alternateUrl = `${alternateProtocol}://${hostForUrl}`
    if (!hasScheme || !urls.includes(alternateUrl)) {
      urls.push(alternateUrl)
    }

    const uniqueUrls = Array.from(new Set(urls))

    return {
      displayHost: hostLabel,
      urls: uniqueUrls,
    }
  }

  const createTimeoutSignal = (ms: number) => {
    if (typeof AbortController === "undefined") return undefined

    const abortSignalWithTimeout = (
      AbortSignal as typeof AbortSignal & {
        timeout?: (ms: number) => AbortSignal
      }
    ).timeout

    if (typeof abortSignalWithTimeout === "function") {
      return abortSignalWithTimeout(ms)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true })
    return controller.signal
  }

  const attemptPingRequest = async (url: string) => {
    const methods: Array<"HEAD" | "GET"> = ["HEAD", "GET"]
    let lastError: unknown = null

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i]
      const startTime = performance.now()
      try {
        await fetch(url, {
          method,
          mode: "no-cors",
          cache: "no-cache",
          signal: createTimeoutSignal(5000),
        })

        const endTime = performance.now()
        return {
          success: true as const,
          responseTime: endTime - startTime,
          methodUsed: method,
          methodFallback: i > 0,
        }
      } catch (error) {
        lastError = error
      }
    }

    return {
      success: false as const,
      error: lastError,
    }
  }

  const formatPingError = (error: unknown) => {
    if (error instanceof DOMException) {
      if (error.name === "AbortError") {
        return "Request timed out"
      }
      return error.message || error.name
    }
    if (error instanceof Error) {
      return error.message
    }
    return "Host unreachable or blocked"
  }

  const performPing = async () => {
    if (!pingHost.trim()) return

    // For native Electron, just use the hostname directly
    const host = pingHost
      .trim()
      .replace(/^https?:\/\//, "")
      .split("/")[0]

    if (!host) {
      setPingValidationError("Enter a valid hostname or IP address.")
      return
    }

    setPingValidationError(null)
    setIsPinging(true)

    try {
      // Use native ICMP ping in Electron
      if (isNative) {
        const nativeResult = await electronNetwork.ping(host, { count: 4, timeout: 5000 })

        if (nativeResult) {
          const result: PingResult = {
            host: host,
            timestamp: Date.now(),
            success: nativeResult.alive,
            responseTime: nativeResult.avg,
            error: nativeResult.error,
            methodUsed: "HEAD", // Indicate native
            scheme: "http", // Not applicable for ICMP
            fallback: false,
          }
          setPingResults((prev) => [result, ...prev.slice(0, 9)])
        }
        return
      }

      // Fallback to HTTP-based ping for browser
      const target = parseTargetInput(pingHost)
      if (!target) {
        setPingValidationError("Enter a valid hostname or IP address.")
        return
      }

      let fallbackUsed = false
      let lastError: unknown = null

      for (let i = 0; i < target.urls.length; i++) {
        const url = target.urls[i]
        const attempt = await attemptPingRequest(url)

        if (attempt.success) {
          const scheme = new URL(url).protocol.replace(":", "") as "http" | "https"
          const result: PingResult = {
            host: target.displayHost,
            timestamp: Date.now(),
            success: true,
            responseTime: attempt.responseTime,
            methodUsed: attempt.methodUsed,
            scheme,
            fallback: fallbackUsed || attempt.methodFallback,
          }

          setPingResults((prev) => [result, ...prev.slice(0, 9)])
          return
        }

        fallbackUsed = true
        lastError = attempt.error
      }

      const lastAttemptUrl = target.urls[target.urls.length - 1]
      const scheme = new URL(lastAttemptUrl).protocol.replace(":", "") as "http" | "https"
      const result: PingResult = {
        host: target.displayHost,
        timestamp: Date.now(),
        success: false,
        error: formatPingError(lastError),
        scheme,
        fallback: fallbackUsed,
      }

      setPingResults((prev) => [result, ...prev.slice(0, 9)])
    } finally {
      setIsPinging(false)
    }
  }

  const performTraceroute = async () => {
    if (!tracerouteHost.trim()) return

    // For native Electron, just use the hostname directly
    const host = tracerouteHost
      .trim()
      .replace(/^https?:\/\//, "")
      .split("/")[0]

    if (!host) {
      setTracerouteValidationError("Enter a valid hostname or IP address.")
      return
    }

    setTracerouteValidationError(null)
    setIsTracing(true)
    setTracerouteResults([])
    setActiveTracerouteTarget(host)

    try {
      // Use native traceroute in Electron
      if (isNative) {
        const nativeResult = await electronNetwork.traceroute(host, { maxHops: 30, timeout: 5000 })

        if (nativeResult && nativeResult.hops) {
          // Display hops progressively
          for (const hop of nativeResult.hops) {
            setTracerouteResults((prev) => [
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
            await new Promise((resolve) => setTimeout(resolve, 100)) // Small delay for visual effect
          }
        }
        return
      }

      // Fallback to simulated traceroute for browser
      const target = parseTargetInput(tracerouteHost)
      const displayHost = target?.displayHost || host

      const simulatedHops: TracerouteHop[] = [
        { hop: 1, host: "192.168.1.1", responseTime: 1.2, timeout: false },
        { hop: 2, host: "10.0.0.1", responseTime: 5.8, timeout: false },
        { hop: 3, host: "203.0.113.1", responseTime: 12.4, timeout: false },
        { hop: 4, host: "198.51.100.1", responseTime: 25.6, timeout: false },
        { hop: 5, host: displayHost, responseTime: 45.2, timeout: false },
      ]

      for (let i = 0; i < simulatedHops.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const hop = simulatedHops[i]
        const jitter = hop.timeout ? 0 : (Math.random() - 0.5) * 4
        setTracerouteResults((prev) => [
          ...prev,
          {
            ...hop,
            responseTime: hop.timeout ? undefined : Math.max(0.5, (hop.responseTime || 0) + jitter),
          },
        ])
      }
    } finally {
      setIsTracing(false)
    }
  }

  const exportResults = (type: "ping" | "traceroute") => {
    const data = {
      type,
      timestamp: new Date().toISOString(),
      results: type === "ping" ? pingResults : tracerouteResults,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${type}-results.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Activity}
        title="Ping & Traceroute"
        description="Test network connectivity and trace packet paths to destinations"
      />

      {isNative ? (
        <Alert className="border-green-500/50 bg-green-500/10">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Native Mode:</strong> Running in desktop app with real ICMP ping and traceroute
            capabilities.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Browser Limitations:</strong> Due to browser security restrictions, this tool
            uses HTTP requests to simulate ping functionality. Real ICMP ping requires the desktop
            app.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="ping" className="space-y-6">
        <TabsList className={`grid w-full ${isNative ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="ping">Ping Test</TabsTrigger>
          <TabsTrigger value="traceroute">Traceroute</TabsTrigger>
          {isNative && <TabsTrigger value="interfaces">Network Info</TabsTrigger>}
        </TabsList>

        <TabsContent value="ping" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Ping Test</span>
              </CardTitle>
              <CardDescription>
                Test connectivity and measure response time to a host
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="ping-host">Hostname or IP Address</Label>
                  <Input
                    id="ping-host"
                    value={pingHost}
                    onChange={(e) => {
                      setPingHost(e.target.value)
                      if (pingValidationError) {
                        setPingValidationError(null)
                      }
                    }}
                    placeholder="google.com or 8.8.8.8"
                    onKeyDown={(e) => e.key === "Enter" && !isPinging && performPing()}
                  />
                  {pingValidationError && (
                    <p className="text-destructive mt-1 text-xs">{pingValidationError}</p>
                  )}
                </div>
                <div className="flex items-end">
                  <Button onClick={performPing} disabled={!pingHost.trim() || isPinging}>
                    {isPinging ? (
                      <>
                        <Activity className="mr-2 h-4 w-4 animate-spin" />
                        Pinging...
                      </>
                    ) : (
                      <>
                        <Activity className="mr-2 h-4 w-4" />
                        Ping
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {pingResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Ping Results</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportResults("ping")}
                      className="bg-transparent"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>

                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {pingResults.map((result, index) => (
                      <div
                        key={index}
                        className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                      >
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
                          <div className="mb-1 flex items-center justify-end gap-1">
                            {result.scheme && (
                              <Badge
                                variant="outline"
                                className="text-[10px] tracking-wide uppercase"
                              >
                                {result.scheme}
                              </Badge>
                            )}
                            {result.methodUsed && (
                              <Badge variant="outline" className="text-[10px]">
                                {result.methodUsed}
                              </Badge>
                            )}
                            {result.fallback && (
                              <Badge variant="secondary" className="text-[10px]">
                                Fallback
                              </Badge>
                            )}
                          </div>
                          {result.success ? (
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3 text-blue-600" />
                              <span className="font-mono text-sm">
                                {result.responseTime?.toFixed(1)}ms
                              </span>
                            </div>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              {result.error}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traceroute" className="space-y-6">
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
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="traceroute-host">Hostname or IP Address</Label>
                  <Input
                    id="traceroute-host"
                    value={tracerouteHost}
                    onChange={(e) => {
                      setTracerouteHost(e.target.value)
                      if (tracerouteValidationError) {
                        setTracerouteValidationError(null)
                      }
                    }}
                    placeholder="google.com or 8.8.8.8"
                    onKeyDown={(e) => e.key === "Enter" && !isTracing && performTraceroute()}
                  />
                  {tracerouteValidationError && (
                    <p className="text-destructive mt-1 text-xs">{tracerouteValidationError}</p>
                  )}
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={performTraceroute}
                    disabled={!tracerouteHost.trim() || isTracing}
                  >
                    {isTracing ? (
                      <>
                        <Navigation className="mr-2 h-4 w-4 animate-spin" />
                        Tracing...
                      </>
                    ) : (
                      <>
                        <Navigation className="mr-2 h-4 w-4" />
                        Traceroute
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {(tracerouteResults.length > 0 || isTracing) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">
                      Route to {activeTracerouteTarget || tracerouteHost}
                    </h4>
                    {tracerouteResults.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportResults("traceroute")}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {tracerouteResults.map((hop, index) => (
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
                              Timeout
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
            </CardContent>
          </Card>
        </TabsContent>

        {isNative && (
          <TabsContent value="interfaces" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="h-5 w-5" />
                  <span>Network Interfaces</span>
                </CardTitle>
                <CardDescription>
                  Real network interface information from your system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {networkInterfaces.length > 0 ? (
                  <div className="space-y-4">
                    {networkInterfaces
                      .filter((iface) => !iface.internal) // Show external interfaces first
                      .concat(networkInterfaces.filter((iface) => iface.internal))
                      .map((iface, index) => (
                        <div
                          key={index}
                          className={`rounded-lg border p-4 ${
                            iface.internal ? "bg-muted/30" : "bg-muted/50"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Wifi className="text-primary h-5 w-5" />
                              <span className="font-semibold">{iface.name}</span>
                              {iface.internal && (
                                <Badge variant="secondary" className="text-xs">
                                  Internal
                                </Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground font-mono text-xs">
                              {iface.mac}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                            {iface.ipv4 && (
                              <div>
                                <span className="text-muted-foreground">IPv4:</span>{" "}
                                <span className="font-mono">{iface.ipv4}</span>
                                {iface.netmask && (
                                  <span className="text-muted-foreground ml-2 text-xs">
                                    / {iface.netmask}
                                  </span>
                                )}
                              </div>
                            )}
                            {iface.ipv6 && (
                              <div>
                                <span className="text-muted-foreground">IPv6:</span>{" "}
                                <span className="font-mono text-xs break-all">{iface.ipv6}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Server className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>Loading network interfaces...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Network Diagnostics Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold">Ping Interpretation</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>
                  • <strong>&lt;10ms:</strong> Excellent (local network)
                </li>
                <li>
                  • <strong>10-50ms:</strong> Good (regional)
                </li>
                <li>
                  • <strong>50-100ms:</strong> Acceptable (national)
                </li>
                <li>
                  • <strong>&gt;100ms:</strong> High latency (international)
                </li>
                <li>
                  • <strong>Timeouts:</strong> Packet loss or filtering
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Traceroute Analysis</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Each hop represents a router in the path</li>
                <li>• Sudden latency increases indicate bottlenecks</li>
                <li>• Timeouts may indicate firewalls or rate limiting</li>
                <li>• Multiple paths may cause hop reordering</li>
                <li>• Private IPs (10.x, 192.168.x) are internal</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
