"use client"

import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, AlertTriangle, Download, FileText, Scan, Zap } from "lucide-react"
import {
  analyzeConflicts,
  exportConflictsToCSV,
  generateRemediationReport,
} from "@/lib/conflict-utils"
import type { ConflictAnalysisResult } from "@/lib/conflict-utils"
import type { ParsedARPEntry } from "@/lib/parsers"
import { electronNetwork, isElectron } from "@/lib/electron"
import { ToolHeader } from "@/components/ui/tool-header"
import { dateStamp, downloadTextFile } from "@/lib/download"
import type { ParsedNetworkData } from "./input"

const ConflictInputPanel = lazy(() => import("./input"))
const ConflictAnalysisPanel = lazy(() => import("./analysis"))
const ConflictRemediationPanel = lazy(() => import("./remediation"))

const TABS = ["input", "analysis", "remediation"] as const

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

const fallback = (
  <p role="status" className="text-muted-foreground py-8 text-center text-sm" data-panel-fallback>
    Loading panel
  </p>
)

// three views over one parsed dataset, so the shell owns the data and the panels
// take it as props. the paste and the arp scan stay user-initiated: pasted
// inventories are too large for a url and a scan touches the network.
export function ConflictChecker() {
  const [{ tab }, setQuery] = useQueryStates(
    { tab: parseAsStringLiteral(TABS).withDefault("input") },
    { history: "replace" }
  )

  const [parsedData, setParsedData] = useState<ParsedNetworkData>([])
  const [scanError, setScanError] = useState("")
  const [isNative, setIsNative] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  const { analysis, analysisError } = useMemo<{
    analysis: ConflictAnalysisResult | null
    analysisError: string
  }>(() => {
    if (parsedData.length === 0) return { analysis: null, analysisError: "" }
    try {
      return {
        analysis: analyzeConflicts(parsedData, ["Parsed network data"]),
        analysisError: "",
      }
    } catch (error) {
      return {
        analysis: null,
        analysisError: error instanceof Error ? error.message : "Conflict analysis failed",
      }
    }
  }, [parsedData])

  const runNativeArpScan = async () => {
    setIsScanning(true)
    setScanError("")
    try {
      const arpEntries = await electronNetwork.getArpTable()
      const entries: ParsedARPEntry[] = (arpEntries ?? []).map((entry) => ({
        ip: entry.ip,
        mac: entry.mac,
        interface: entry.interface,
        source: "arp" as const,
        type: "arp" as const,
      }))
      if (entries.length === 0) {
        setScanError("The ARP scan returned no entries")
        return
      }
      setParsedData(entries)
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Native ARP scan failed")
    } finally {
      setIsScanning(false)
    }
  }

  const exportConflicts = (format: "csv" | "report") => {
    if (!analysis || analysis.conflicts.length === 0) return
    if (format === "csv") {
      downloadTextFile(
        exportConflictsToCSV(analysis.conflicts),
        `network-conflicts-${dateStamp()}.csv`,
        "text/csv"
      )
      return
    }
    downloadTextFile(
      generateRemediationReport(analysis.conflicts),
      `remediation-report-${dateStamp()}.txt`
    )
  }

  const hasConflicts = (analysis?.conflicts.length ?? 0) > 0

  return (
    <div className="tool-container">
      <ToolHeader
        icon={AlertTriangle}
        title="IP Conflict Checker"
        description="Detect duplicate IP and MAC addresses across ARP tables, DHCP leases and inventories"
        actions={
          <>
            {isNative && (
              <>
                <Badge variant="outline" className="border-green-600 text-green-600">
                  <Zap className="mr-1 h-3 w-3" aria-hidden="true" />
                  Native Mode
                </Badge>
                <Button onClick={runNativeArpScan} disabled={isScanning} size="sm">
                  {isScanning ? (
                    <>
                      <Activity className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Scanning
                    </>
                  ) : (
                    <>
                      <Scan className="mr-2 h-4 w-4" aria-hidden="true" />
                      Scan Local Network
                    </>
                  )}
                </Button>
              </>
            )}
            {hasConflicts && (
              <>
                <Button variant="outline" size="sm" onClick={() => exportConflicts("csv")}>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportConflicts("report")}>
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  Export Text
                </Button>
              </>
            )}
          </>
        }
      />

      <div aria-live="polite" aria-busy={isScanning}>
        {isNative && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <Zap className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>Native mode:</strong> Scan Local Network reads the system ARP table on this
              machine. Nothing is sent off the device. You can also paste data from other sources
              for a combined analysis.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* already role=alert via the destructive variant, so it stays out of the
          region above or it announces twice */}
      {(scanError || analysisError) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="conflict-checker-error">
            {scanError || analysisError}
          </AlertDescription>
        </Alert>
      )}

      {/* the results live in three tab panels; announcing the tabs themselves
          would re-read everything on each switch, so a one-line headline goes
          out instead and the panels stay navigable */}
      <div role="status" aria-busy={isScanning} className="sr-only">
        {analysis
          ? `Analysis complete. ${analysis.totalEntries} entries, ${analysis.uniqueIPs} unique IP addresses, ${analysis.uniqueMACs} unique MAC addresses, ${analysis.conflicts.length} conflicts found.`
          : ""}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setQuery({ tab: value as (typeof TABS)[number] })}
        className="space-y-6"
      >
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
          <TabsTrigger value="input" className={TRIGGER_CLASS}>
            Data Input
          </TabsTrigger>
          <TabsTrigger value="analysis" className={TRIGGER_CLASS}>
            Conflict Analysis
          </TabsTrigger>
          <TabsTrigger value="remediation" className={TRIGGER_CLASS}>
            Remediation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="input">
          <Suspense fallback={fallback}>
            <ConflictInputPanel
              analysis={analysis}
              onDataParsed={setParsedData}
              // the scan failure has no field behind it, so only the analysis
              // failure is tied back to the paste
              analysisErrorId={analysisError ? "conflict-checker-error" : undefined}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="analysis">
          <Suspense fallback={fallback}>
            <ConflictAnalysisPanel analysis={analysis} />
          </Suspense>
        </TabsContent>

        <TabsContent value="remediation">
          <Suspense fallback={fallback}>
            <ConflictRemediationPanel analysis={analysis} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ConflictChecker
