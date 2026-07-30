"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Ban, CheckCircle, Download, HelpCircle, X } from "lucide-react"
import {
  summarizeStates,
  type PortProbeResult,
  type PortState,
  type ScanMethod,
} from "@/lib/port-probe"

export interface ScanSession {
  target: string
  timestamp: number
  results: PortProbeResult[]
  completed: boolean
  method: ScanMethod
}

function stateIcon(state: PortState) {
  if (state === "open") return <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
  if (state === "browser-blocked")
    return <Ban className="text-muted-foreground h-4 w-4" aria-hidden="true" />
  if (state === "unknown")
    return <HelpCircle className="text-muted-foreground h-4 w-4" aria-hidden="true" />
  return <X className="h-4 w-4 text-red-600" aria-hidden="true" />
}

// "blocked by browser" has to read as a limit of the tool, not a fact about the host
function stateLabel(state: PortState) {
  return state === "browser-blocked" ? "blocked by browser" : state
}

interface ScanResultsProps {
  session: ScanSession
  onExport: (session: ScanSession) => void
}

export function ScanResults({ session, onExport }: ScanResultsProps) {
  const counts = summarizeStates(session.results)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Scan Results - {session.target}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{counts.open} open</Badge>
            {counts.unknown > 0 && <Badge variant="secondary">{counts.unknown} unknown</Badge>}
            {counts["browser-blocked"] > 0 && (
              <Badge variant="secondary">
                {counts["browser-blocked"]} unreachable from a browser
              </Badge>
            )}
            <Badge variant="secondary">{session.results.length} total</Badge>
            {session.completed && (
              <Button variant="outline" size="sm" onClick={() => onExport(session)}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Export
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          Scanned on {new Date(session.timestamp).toLocaleString()} by{" "}
          {session.method === "tcp-connect" ? "TCP connect" : "HTTP probe (browser fallback)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {session.results.map((result, index) => (
            <div key={index} className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {stateIcon(result.state)}
                  <div>
                    <div className="font-mono text-sm">Port {result.port}</div>
                    <div className="text-muted-foreground text-xs">{result.service}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={result.state === "open" ? "default" : "secondary"}
                    className={result.state === "open" ? "bg-green-100 text-green-800" : undefined}
                  >
                    {stateLabel(result.state)}
                  </Badge>
                  {result.responseTime !== undefined && (
                    <span className="text-muted-foreground text-xs">
                      {result.responseTime.toFixed(1)}ms
                    </span>
                  )}
                </div>
              </div>
              {result.detail && (
                <p className="text-muted-foreground mt-2 text-xs">{result.detail}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface ScanHistoryProps {
  sessions: ScanSession[]
  onExport: (session: ScanSession) => void
}

export function ScanHistory({ sessions, onExport }: ScanHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan History</CardTitle>
        <CardDescription>Previous port scan results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sessions.map((session, index) => {
            const counts = summarizeStates(session.results)
            return (
              <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{session.target}</div>
                  <div className="text-muted-foreground text-sm">
                    {new Date(session.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{counts.open} open</Badge>
                  <Badge variant="secondary">{session.results.length} scanned</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onExport(session)}
                    aria-label={`Export the scan of ${session.target}`}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
