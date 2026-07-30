"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Network,
  Shield,
  XCircle,
} from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import type { Conflict, ConflictAnalysisResult, ConflictEntry } from "@/lib/conflict-utils"

export interface ConflictAnalysisPanelProps {
  analysis: ConflictAnalysisResult | null
}

type Severity = Conflict["severity"]

const SEVERITY_VARIANT: Record<Severity, "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "high") return <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
  if (severity === "medium")
    return <AlertCircle className="h-4 w-4 text-orange-600" aria-hidden="true" />
  return <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
}

function ConflictTypeIcon({ type }: { type: Conflict["type"] }) {
  if (type === "mac-duplicate") return <Shield className="h-4 w-4" aria-hidden="true" />
  if (type === "stale-lease-or-spoof") return <Activity className="h-4 w-4" aria-hidden="true" />
  return <Network className="h-4 w-4" aria-hidden="true" />
}

function EntryRow({ entry, label }: { entry: ConflictEntry; label?: string }) {
  return (
    <div className="bg-muted/50 rounded p-2 text-sm">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {label && (
          <div>
            <span className="text-muted-foreground">Role:</span> {label}
          </div>
        )}
        {entry.ip && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">IP:</span>
            <span className="font-mono">{entry.ip}</span>
            <CopyButton value={entry.ip} />
          </div>
        )}
        {entry.mac && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">MAC:</span>
            <span className="font-mono">{entry.mac}</span>
            <CopyButton value={entry.mac} />
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
  )
}

export function ConflictAnalysisPanel({ analysis }: ConflictAnalysisPanelProps) {
  if (!analysis) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Parse network data on the Data Input tab to begin conflict analysis.
        </AlertDescription>
      </Alert>
    )
  }

  if (analysis.conflicts.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>No conflicts detected.</strong> No duplicate IP or MAC addresses were found across
          the {analysis.totalEntries} parsed entries.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {analysis.conflicts.map((conflict, index) => (
        <Card key={`${conflict.type}-${index}`} className="border-l-destructive border-l-4">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <ConflictTypeIcon type={conflict.type} />
                <div>
                  <CardTitle className="text-lg">{conflict.description}</CardTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[conflict.severity]}>
                      {conflict.severity.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">{conflict.type}</Badge>
                  </div>
                </div>
              </div>
              <SeverityIcon severity={conflict.severity} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 font-medium">Affected entries</h4>
              <div className="space-y-2">
                {"entries" in conflict ? (
                  conflict.entries.map((entry, entryIndex) => (
                    <EntryRow key={entryIndex} entry={entry} />
                  ))
                ) : (
                  <>
                    <EntryRow entry={conflict.staticEntry} label="Live observation" />
                    <EntryRow entry={conflict.dhcpEntry} label="DHCP lease" />
                  </>
                )}
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-medium">Recommended actions</h4>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {conflict.remediation.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default ConflictAnalysisPanel
