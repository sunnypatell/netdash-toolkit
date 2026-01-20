"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield, Search, AlertCircle, CheckCircle, X, Download, Zap } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { isElectron, electronNetwork } from "@/lib/electron"

interface PortScanResult {
  port: number
  service: string
  status: "open" | "closed" | "filtered"
  responseTime?: number
}

interface ScanSession {
  target: string
  timestamp: number
  results: PortScanResult[]
  completed: boolean
}

const commonPorts = [
  { port: 21, service: "FTP" },
  { port: 22, service: "SSH" },
  { port: 23, service: "Telnet" },
  { port: 25, service: "SMTP" },
  { port: 53, service: "DNS" },
  { port: 80, service: "HTTP" },
  { port: 110, service: "POP3" },
  { port: 143, service: "IMAP" },
  { port: 443, service: "HTTPS" },
  { port: 993, service: "IMAPS" },
  { port: 995, service: "POP3S" },
  { port: 3389, service: "RDP" },
  { port: 5432, service: "PostgreSQL" },
  { port: 3306, service: "MySQL" },
  { port: 1433, service: "MSSQL" },
  { port: 27017, service: "MongoDB" },
]

export function PortScanner() {
  const [target, setTarget] = useState("scanme.nmap.org")
  const [customPorts, setCustomPorts] = useState("80,443,22,21,25")
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [currentScan, setCurrentScan] = useState<ScanSession | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanSession[]>([])
  const [isNative, setIsNative] = useState(false)

  // Check if running in Electron for native networking
  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  const getServiceName = (port: number): string => {
    const service = commonPorts.find((p) => p.port === port)
    return service?.service || "Unknown"
  }

  // Perform real port scanning in Electron, simulated in browser
  const performPortScan = async (ports: number[]) => {
    if (!target.trim()) return

    setIsScanning(true)
    setScanProgress(0)

    const session: ScanSession = {
      target: target.trim(),
      timestamp: Date.now(),
      results: [],
      completed: false,
    }

    setCurrentScan(session)

    try {
      // Use native TCP socket port scanning in Electron
      if (isNative) {
        console.log("[NetDash] Using NATIVE TCP socket port scanning")
        const nativeResults = await electronNetwork.portScan(target.trim(), ports, {
          timeout: 3000,
          concurrent: 100, // More concurrent connections for faster scanning
        })

        if (nativeResults && nativeResults.length > 0) {
          for (let i = 0; i < nativeResults.length; i++) {
            const nativeResult = nativeResults[i]
            const result: PortScanResult = {
              port: nativeResult.port,
              service: nativeResult.service || getServiceName(nativeResult.port),
              status: nativeResult.state,
              responseTime: (nativeResult as any).responseTime, // Include response time from native scan
            }
            session.results.push(result)
            setScanProgress(((i + 1) / nativeResults.length) * 100)
            setCurrentScan({ ...session })
          }
        } else {
          console.error("[NetDash] Native port scan returned no results")
        }
      } else {
        // Fallback to simulated scanning for browser
        for (let i = 0; i < ports.length; i++) {
          const port = ports[i]
          const startTime = performance.now()

          try {
            await fetch(`http://${target}:${port}`, {
              method: "HEAD",
              mode: "no-cors",
              signal: AbortSignal.timeout(2000),
            })

            const endTime = performance.now()
            const responseTime = endTime - startTime

            const result: PortScanResult = {
              port,
              service: getServiceName(port),
              status: "open",
              responseTime,
            }

            session.results.push(result)
          } catch (error) {
            // Most ports will appear closed due to browser limitations
            const result: PortScanResult = {
              port,
              service: getServiceName(port),
              status: Math.random() > 0.8 ? "open" : "closed", // Simulate some open ports
            }

            session.results.push(result)
          }

          setScanProgress(((i + 1) / ports.length) * 100)
          setCurrentScan({ ...session })

          // Small delay to show progress
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
    } finally {
      session.completed = true
      setCurrentScan(session)
      setScanHistory([session, ...scanHistory.slice(0, 4)])
      setIsScanning(false)
    }
  }

  const scanCommonPorts = () => {
    const ports = commonPorts.map((p) => p.port)
    performPortScan(ports)
  }

  const scanCustomPorts = () => {
    const ports = customPorts
      .split(",")
      .map((p) => Number.parseInt(p.trim()))
      .filter((p) => !isNaN(p) && p > 0 && p <= 65535)

    if (ports.length === 0) return
    performPortScan(ports)
  }

  const exportResults = (session: ScanSession) => {
    const data = {
      target: session.target,
      timestamp: new Date(session.timestamp).toISOString(),
      totalPorts: session.results.length,
      openPorts: session.results.filter((r) => r.status === "open").length,
      results: session.results,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `port-scan-${session.target}-${new Date(session.timestamp).toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
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
            <strong>Native Mode:</strong> Running in desktop app with real TCP port scanning
            capabilities.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Browser Limitations:</strong> Due to CORS and browser security policies, this
            tool provides simulated results. Use the desktop app for real port scanning.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scan Configuration</CardTitle>
          <CardDescription>Configure target host and ports to scan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="target-host">Target Host</Label>
            <Input
              id="target-host"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="scanme.nmap.org or 192.168.1.1"
              disabled={isScanning}
            />
          </div>

          <Tabs defaultValue="common" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="common">Common Ports</TabsTrigger>
              <TabsTrigger value="custom">Custom Ports</TabsTrigger>
            </TabsList>

            <TabsContent value="common" className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                {commonPorts.slice(0, 16).map(({ port, service }) => (
                  <div key={port} className="bg-muted/50 flex justify-between rounded p-2">
                    <span className="font-mono">{port}</span>
                    <span className="text-muted-foreground">{service}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={scanCommonPorts}
                disabled={!target.trim() || isScanning}
                className="w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                Scan Common Ports ({commonPorts.length} ports)
              </Button>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div>
                <Label htmlFor="custom-ports">Port List (comma-separated)</Label>
                <Input
                  id="custom-ports"
                  value={customPorts}
                  onChange={(e) => setCustomPorts(e.target.value)}
                  placeholder="80,443,22,21,25,53,110,143"
                  disabled={isScanning}
                />
                <div className="text-muted-foreground mt-1 text-xs">
                  {customPorts.split(",").filter((p) => !isNaN(Number.parseInt(p.trim()))).length}{" "}
                  ports specified
                </div>
              </div>
              <Button
                onClick={scanCustomPorts}
                disabled={!target.trim() || !customPorts.trim() || isScanning}
                className="w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                Scan Custom Ports
              </Button>
            </TabsContent>
          </Tabs>

          {isScanning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Scanning {target}...</span>
                <span>{scanProgress.toFixed(0)}%</span>
              </div>
              <Progress value={scanProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {currentScan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Scan Results - {currentScan.target}</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {currentScan.results.filter((r) => r.status === "open").length} open
                </Badge>
                <Badge variant="secondary">{currentScan.results.length} total</Badge>
                {currentScan.completed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportResults(currentScan)}
                    className="bg-transparent"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Scanned on {new Date(currentScan.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {currentScan.results.map((result, index) => (
                <div
                  key={index}
                  className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                >
                  <div className="flex items-center space-x-3">
                    {result.status === "open" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <div className="font-mono text-sm">Port {result.port}</div>
                      <div className="text-muted-foreground text-xs">{result.service}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={result.status === "open" ? "default" : "secondary"}
                      className={result.status === "open" ? "bg-green-100 text-green-800" : ""}
                    >
                      {result.status}
                    </Badge>
                    {result.responseTime && (
                      <span className="text-muted-foreground text-xs">
                        {result.responseTime.toFixed(1)}ms
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scan History</CardTitle>
            <CardDescription>Previous port scan results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scanHistory.map((session, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">{session.target}</div>
                    <div className="text-muted-foreground text-sm">
                      {new Date(session.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {session.results.filter((r) => r.status === "open").length} open
                    </Badge>
                    <Badge variant="secondary">{session.results.length} scanned</Badge>
                    <Button variant="ghost" size="sm" onClick={() => exportResults(session)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                  • <strong>UDP:</strong> Connectionless (DNS, DHCP)
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Security Considerations</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Only scan systems you own or have permission</li>
                <li>• Unauthorized scanning may violate policies</li>
                <li>• Use firewalls to block unnecessary ports</li>
                <li>• Regular scans help identify security gaps</li>
                <li>• Consider rate limiting and stealth options</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
