"use client"

import { useState } from "react"
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
} from "lucide-react"
import { PasteParser } from "@/components/ui/paste-parser"
import { analyzeConflicts, exportConflictsToCSV, generateRemediationReport } from "@/lib/conflict-utils"
import type { ParsedARPEntry, ParsedDHCPLease, ParsedMACEntry } from "@/lib/parsers"
import type { ConflictAnalysisResult } from "@/lib/conflict-utils"

export function ConflictChecker() {
  const [parsedData, setParsedData] = useState<(ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[]>([])
  const [analysis, setAnalysis] = useState<ConflictAnalysisResult | null>(null)
  const [sourceTexts, setSourceTexts] = useState<string[]>([])

  const handleDataParsed = (data: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[]) => {
    console.log("[v0] Parsed data received:", data.length, "entries")
    setParsedData(data)
    const mockSourceTexts = ["Network data source"]
    setSourceTexts(mockSourceTexts)

    try {
      const analysisResult = analyzeConflicts(data, mockSourceTexts)
      console.log("[v0] Analysis completed:", analysisResult.conflicts.length, "conflicts found")
      setAnalysis(analysisResult)
    } catch (error) {
      console.error("[v0] Analysis error:", error)
      // Create a basic analysis result if the analysis fails
      setAnalysis({
        totalEntries: data.length,
        uniqueIPs: new Set(data.filter((d) => d.ip).map((d) => d.ip)).size,
        uniqueMACs: new Set(data.map((d) => d.mac)).size,
        conflicts: [],
        sources: Array.from(new Set(data.map((d) => d.source))),
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
      console.error("[v0] Failed to copy to clipboard:", err)
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <XCircle className="w-4 h-4 text-red-600" />
      case "medium":
        return <AlertCircle className="w-4 h-4 text-orange-600" />
      case "low":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      default:
        return <CheckCircle className="w-4 h-4 text-green-600" />
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
        return <Network className="w-4 h-4" />
      case "mac-duplicate":
        return <Shield className="w-4 h-4" />
      case "dhcp-static-overlap":
        return <Activity className="w-4 h-4" />
      case "rogue-dhcp":
        return <AlertCircle className="w-4 h-4" />
      case "vlan-hopping":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">IP Conflict Checker</h1>
            <p className="text-muted-foreground">Detect IP and MAC conflicts from multiple data sources</p>
          </div>
        </div>
        <div className="flex space-x-2">
          {analysis && analysis.conflicts.length > 0 && (
            <>
              <Button variant="outline" onClick={() => exportConflicts("csv")}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => exportConflicts("report")}>
                <FileText className="w-4 h-4 mr-2" />
                Remediation Report
              </Button>
            </>
          )}
        </div>
      </div>

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
                <CardDescription>Overview of parsed network data and detected conflicts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{analysis.totalEntries}</div>
                    <div className="text-sm text-muted-foreground">Total Entries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{analysis.uniqueIPs}</div>
                    <div className="text-sm text-muted-foreground">Unique IPs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{analysis.uniqueMACs}</div>
                    <div className="text-sm text-muted-foreground">Unique MACs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{analysis.conflicts.length}</div>
                    <div className="text-sm text-muted-foreground">Conflicts</div>
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
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span>High: {analysis.summary.high}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        <span>Medium: {analysis.summary.medium}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
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
                  <Card key={index} className="border-l-4 border-l-destructive">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          {getConflictTypeIcon(conflict.type)}
                          <div>
                            <CardTitle className="text-lg">{conflict.description}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
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
                        <h5 className="font-medium mb-2">Affected Entries:</h5>
                        <div className="space-y-2">
                          {conflict.entries.map((entry, entryIndex) => (
                            <div key={entryIndex} className="p-2 bg-muted/50 rounded text-sm">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                                      <Copy className="w-3 h-3" />
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
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                                {entry.hostname && (
                                  <div>
                                    <span className="text-muted-foreground">Host:</span> {entry.hostname}
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">Source:</span> {entry.source}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium mb-2">Recommended Actions:</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm">
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
                  <strong>No conflicts detected!</strong> Your network data appears to be clean with no IP or MAC
                  address conflicts.
                </AlertDescription>
              </Alert>
            )
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Parse network data from the Input tab to begin conflict analysis.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="remediation" className="space-y-6">
          {analysis && analysis.conflicts.length > 0 ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Remediation Priority</CardTitle>
                  <CardDescription>Conflicts organized by priority level for systematic resolution</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {analysis.summary.high > 0 && (
                      <div>
                        <h4 className="font-semibold text-red-600 mb-3 flex items-center space-x-2">
                          <XCircle className="w-4 h-4" />
                          <span>High Priority ({analysis.summary.high})</span>
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          These conflicts require immediate attention as they can cause network outages or security
                          issues.
                        </p>
                        <div className="space-y-2">
                          {analysis.conflicts
                            .filter((c) => c.severity === "high")
                            .map((conflict, index) => (
                              <div key={index} className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                                <div className="font-medium text-sm">{conflict.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Primary action: {conflict.remediation[0]}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {analysis.summary.medium > 0 && (
                      <div>
                        <h4 className="font-semibold text-orange-600 mb-3 flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>Medium Priority ({analysis.summary.medium})</span>
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          These conflicts should be planned for resolution to prevent future issues.
                        </p>
                        <div className="space-y-2">
                          {analysis.conflicts
                            .filter((c) => c.severity === "medium")
                            .map((conflict, index) => (
                              <div key={index} className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                                <div className="font-medium text-sm">{conflict.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Primary action: {conflict.remediation[0]}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {analysis.summary.low > 0 && (
                      <div>
                        <h4 className="font-semibold text-yellow-600 mb-3 flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Low Priority ({analysis.summary.low})</span>
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          These conflicts should be monitored but don't require immediate action.
                        </p>
                        <div className="space-y-2">
                          {analysis.conflicts
                            .filter((c) => c.severity === "low")
                            .map((conflict, index) => (
                              <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                                <div className="font-medium text-sm">{conflict.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium mb-2">IP Address Management</h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li>Maintain accurate IP address documentation</li>
                        <li>Use DHCP reservations for servers and printers</li>
                        <li>Separate static and DHCP ranges clearly</li>
                        <li>Regular network scanning and auditing</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-2">Network Monitoring</h5>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
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
                No conflicts detected. Continue monitoring your network and maintain good IP address management
                practices.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
