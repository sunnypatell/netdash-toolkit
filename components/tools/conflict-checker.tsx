"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  AlertTriangle,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Network,
  Shield,
  Activity,
  Copy,
  Zap,
  Scan,
} from "lucide-react"
import { PasteParser } from "@/components/ui/paste-parser"
import {
  analyzeConflicts,
  exportConflictsToCSV,
  generateRemediationReport,
} from "@/lib/conflict-utils"
import type { ParsedARPEntry, ParsedDHCPLease, ParsedMACEntry } from "@/lib/parsers"
import type { ConflictAnalysisResult } from "@/lib/conflict-utils"
import { isElectron, electronNetwork } from "@/lib/electron"

export function ConflictChecker() {
  const [parsedData, setParsedData] = useState<
    (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[]
  >([])
  const [analysis, setAnalysis] = useState<ConflictAnalysisResult | null>(null)
  const [sourceTexts, setSourceTexts] = useState<string[]>([])
  const [isNative, setIsNative] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  // Check if running in Electron for native networking
  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  // Native ARP scan function
  const runNativeArpScan = async () => {
    if (!isNative) return

    setIsScanning(true)
    try {
      console.log("[NetDash] Running NATIVE ARP scan")
      const arpEntries = await electronNetwork.arpScan()

      if (arpEntries && arpEntries.length > 0) {
        // Convert ARP entries to parsed format
        const parsedEntries: ParsedARPEntry[] = arpEntries.map((entry) => ({
          ip: entry.ip,
          mac: entry.mac,
          interface: entry.interface,
          source: "Native ARP Scan",
          type: "arp" as const,
        }))

        setParsedData(parsedEntries)
        setSourceTexts(["Native ARP Scan"])

        // Run conflict analysis
        try {
          const analysisResult = analyzeConflicts(parsedEntries, ["Native ARP Scan"])
          setAnalysis(analysisResult)
        } catch (error) {
          console.error("Analysis error:", error)
          // Fallback summary
          const uniqueIPs = new Set(parsedEntries.map((e) => e.ip)).size
          const uniqueMACs = new Set(parsedEntries.map((e) => e.mac)).size
          setAnalysis({
            totalEntries: parsedEntries.length,
            uniqueIPs,
            uniqueMACs,
            conflicts: [],
            sources: ["Native ARP Scan"],
            summary: { high: 0, medium: 0, low: 0 },
          })
        }
      }
    } catch (error) {
      console.error("Native ARP scan failed:", error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleDataParsed = (data: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[]) => {
    setParsedData(data)
    const mockSourceTexts = ["Network data source"]
    setSourceTexts(mockSourceTexts)

    try {
      const analysisResult = analyzeConflicts(data, mockSourceTexts)
      setAnalysis(analysisResult)
    } catch (error) {
      console.error("Analysis error:", error)
      // Create a basic analysis result if the analysis fails
      // Fallback summary using type-safe guards
      const uniqueIPs = new Set(
        data
          .map((d) => ("ip" in d && typeof d.ip === "string" ? d.ip : undefined))
          .filter((ip): ip is string => !!ip)
      ).size
      const uniqueMACs = new Set(
        data
          .map((d) => ("mac" in d && typeof d.mac === "string" ? d.mac : undefined))
          .filter((m): m is string => !!m)
      ).size
      const sources = Array.from(new Set(data.map((d) => d.source)))
      setAnalysis({
        totalEntries: data.length,
        uniqueIPs,
        uniqueMACs,
        conflicts: [],
        sources,
        summary: { high: 0, medium: 0, low: 0 },
      })
    }
  }

  const exportConflicts = (format: "csv" | "report") => {
    if (!analysis || analysis.conflicts.length === 0) return

    let content = ""
    let filename = ""
    let mimeType = ""

    if (format === "csv") {
      content = exportConflictsToCSV(analysis.conflicts)
      filename = "network-conflicts.csv"
      mimeType = "text/csv"
    } else {
      content = generateRemediationReport(analysis.conflicts)
      filename = "remediation-report.txt"
      mimeType = "text/plain"
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy to clipboard:", err)
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "medium":
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      case "low":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
        return "outline"
      default:
        return "default"
    }
  }

  const getConflictTypeIcon = (type: string) => {
    switch (type) {
      case "ip-duplicate":
        return <Network className="h-4 w-4" />
      case "mac-duplicate":
        return <Shield className="h-4 w-4" />
      case "dhcp-static-overlap":
        return <Activity className="h-4 w-4" />
      case "rogue-dhcp":
        return <AlertCircle className="h-4 w-4" />
      case "vlan-hopping":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="text-primary h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">IP Conflict Checker</h1>
            <p className="text-muted-foreground">
              Detect IP and MAC conflicts from multiple data sources
            </p>
          </div>
          {isNative && (
            <Badge variant="outline" className="border-green-600 text-green-600">
              <Zap className="mr-1 h-3 w-3" />
              Native Mode
            </Badge>
          )}
        </div>
        <div className="flex space-x-2">
          {isNative && (
            <Button onClick={runNativeArpScan} disabled={isScanning}>
              {isScanning ? (
                <>
                  <Activity className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Scan className="mr-2 h-4 w-4" />
                  Scan Local Network
                </>
              )}
            </Button>
          )}
          {analysis && analysis.conflicts.length > 0 && (
            <>
              <Button variant="outline" onClick={() => exportConflicts("csv")}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => exportConflicts("report")}>
                <FileText className="mr-2 h-4 w-4" />
                Remediation Report
              </Button>
            </>
          )}
        </div>
      </div>

      {isNative && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Native Mode:</strong> Click "Scan Local Network" to perform a real ARP scan of
            your local network using system tools. You can also paste data from other sources for
            combined analysis.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="input" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="input">Data Input</TabsTrigger>
          <TabsTrigger value="analysis">Conflict Analysis</TabsTrigger>
          <TabsTrigger value="remediation">Remediation</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="space-y-6">
          <PasteParser onDataParsed={handleDataParsed} />

          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Summary</CardTitle>
                <CardDescription>
                  Overview of parsed network data and detected conflicts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <div className="text-primary text-2xl font-bold">{analysis.totalEntries}</div>
                    <div className="text-muted-foreground text-sm">Total Entries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{analysis.uniqueIPs}</div>
                    <div className="text-muted-foreground text-sm">Unique IPs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{analysis.uniqueMACs}</div>
                    <div className="text-muted-foreground text-sm">Unique MACs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {analysis.conflicts.length}
                    </div>
                    <div className="text-muted-foreground text-sm">Conflicts</div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium">Data Sources:</span>
                  {analysis.sources.map((source) => (
                    <Badge key={source} variant="outline">
                      {source}
                    </Badge>
                  ))}
                </div>

                {analysis.conflicts.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>High: {analysis.summary.high}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <span>Medium: {analysis.summary.medium}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span>Low: {analysis.summary.low}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {analysis ? (
            analysis.conflicts.length > 0 ? (
              <div className="space-y-4">
                {analysis.conflicts.map((conflict, index) => (
                  <Card key={index} className="border-l-destructive border-l-4">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {getConflictTypeIcon(conflict.type)}
                          <div>
                            <CardTitle className="text-lg">{conflict.description}</CardTitle>
                            <div className="mt-1 flex items-center space-x-2">
                              <Badge variant={getSeverityColor(conflict.severity) as any}>
                                {conflict.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">{conflict.type}</Badge>
                            </div>
                          </div>
                        </div>
                        {getSeverityIcon(conflict.severity)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h5 className="mb-2 font-medium">Affected Entries:</h5>
                        <div className="space-y-2">
                          {"entries" in conflict ? (
                            conflict.entries.map((entry: any, entryIndex: number) => (
                              <div key={entryIndex} className="bg-muted/50 rounded p-2 text-sm">
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                  {entry.ip && (
                                    <div className="flex items-center space-x-1">
                                      <span className="text-muted-foreground">IP:</span>
                                      <span className="font-mono">{entry.ip}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0"
                                        onClick={() => copyToClipboard(entry.ip!)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  {entry.mac && (
                                    <div className="flex items-center space-x-1">
                                      <span className="text-muted-foreground">MAC:</span>
                                      <span className="font-mono">{entry.mac}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0"
                                        onClick={() => copyToClipboard(entry.mac)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  {entry.hostname && (
                                    <div>
                                      <span className="text-muted-foreground">Host:</span>{" "}
                                      {entry.hostname}
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">Source:</span>{" "}
                                    {entry.source}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="space-y-2">
                              <div className="bg-muted/50 rounded p-2 text-sm">
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                  {conflict.ip && (
                                    <div className="flex items-center space-x-1">
                                      <span className="text-muted-foreground">IP:</span>
                                      <span className="font-mono">{conflict.ip}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0"
                                        onClick={() => copyToClipboard(conflict.ip)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">Static Source:</span>{" "}
                                    {conflict.staticEntry.source}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">DHCP Source:</span>{" "}
                                    {conflict.dhcpEntry.source}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h5 className="mb-2 font-medium">Recommended Actions:</h5>
                        <ul className="list-inside list-disc space-y-1 text-sm">
                          {conflict.remediation.map((action, actionIndex) => (
                            <li key={actionIndex}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>No conflicts detected!</strong> Your network data appears to be clean with
                  no IP or MAC address conflicts.
                </AlertDescription>
              </Alert>
            )
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Parse network data from the Input tab to begin conflict analysis.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="remediation" className="space-y-6">
          {analysis && analysis.conflicts.length > 0 ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Remediation Priority</CardTitle>
                  <CardDescription>
                    Conflicts organized by priority level for systematic resolution
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {analysis.summary.high > 0 && (
                      <div>
                        <h4 className="mb-3 flex items-center space-x-2 font-semibold text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span>High Priority ({analysis.summary.high})</span>
                        </h4>
                        <p className="text-muted-foreground mb-3 text-sm">
                          These conflicts require immediate attention as they can cause network
                          outages or security issues.
                        </p>
                        <div className="space-y-2">
                          {analysis.conflicts
                            .filter((c) => c.severity === "high")
                            .map((conflict, index) => (
                              <div
                                key={index}
                                className="rounded-lg bg-red-50 p-3 dark:bg-red-950/20"
                              >
                                <div className="text-sm font-medium">{conflict.description}</div>
                                <div className="text-muted-foreground mt-1 text-xs">
                                  Primary action: {conflict.remediation[0]}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {analysis.summary.medium > 0 && (
                      <div>
                        <h4 className="mb-3 flex items-center space-x-2 font-semibold text-orange-600">
                          <AlertCircle className="h-4 w-4" />
                          <span>Medium Priority ({analysis.summary.medium})</span>
                        </h4>
                        <p className="text-muted-foreground mb-3 text-sm">
                          These conflicts should be planned for resolution to prevent future issues.
                        </p>
                        <div className="space-y-2">
                          {analysis.conflicts
                            .filter((c) => c.severity === "medium")
                            .map((conflict, index) => (
                              <div
                                key={index}
                                className="rounded-lg bg-orange-50 p-3 dark:bg-orange-950/20"
                              >
                                <div className="text-sm font-medium">{conflict.description}</div>
                                <div className="text-muted-foreground mt-1 text-xs">
                                  Primary action: {conflict.remediation[0]}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {analysis.summary.low > 0 && (
                      <div>
                        <h4 className="mb-3 flex items-center space-x-2 font-semibold text-yellow-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Low Priority ({analysis.summary.low})</span>
                        </h4>
                        <p className="text-muted-foreground mb-3 text-sm">
                          These conflicts should be monitored but don't require immediate action.
                        </p>
                        <div className="space-y-2">
                          {analysis.conflicts
                            .filter((c) => c.severity === "low")
                            .map((conflict, index) => (
                              <div
                                key={index}
                                className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/20"
                              >
                                <div className="text-sm font-medium">{conflict.description}</div>
                                <div className="text-muted-foreground mt-1 text-xs">
                                  Primary action: {conflict.remediation[0]}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>General Best Practices</CardTitle>
                  <CardDescription>Preventive measures to avoid future conflicts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <h5 className="mb-2 font-medium">IP Address Management</h5>
                      <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                        <li>Maintain accurate IP address documentation</li>
                        <li>Use DHCP reservations for servers and printers</li>
                        <li>Separate static and DHCP ranges clearly</li>
                        <li>Regular network scanning and auditing</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="mb-2 font-medium">Network Monitoring</h5>
                      <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                        <li>Monitor ARP tables regularly</li>
                        <li>Set up DHCP conflict detection</li>
                        <li>Use network discovery tools</li>
                        <li>Implement MAC address tracking</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No conflicts detected. Continue monitoring your network and maintain good IP address
                management practices.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
