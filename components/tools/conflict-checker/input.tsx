"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, AlertTriangle, XCircle } from "lucide-react"
import { PasteParser } from "@/components/ui/paste-parser"
import type { ParsedARPEntry, ParsedDHCPLease, ParsedMACEntry } from "@/lib/parsers"
import type { ConflictAnalysisResult } from "@/lib/conflict-utils"

export type ParsedNetworkData = (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[]

export interface ConflictInputPanelProps {
  analysis: ConflictAnalysisResult | null
  onDataParsed: (data: ParsedNetworkData) => void
  // the parse succeeded but the analysis rejected it; the parent renders that message
  analysisErrorId?: string
}

export function ConflictInputPanel({
  analysis,
  onDataParsed,
  analysisErrorId,
}: ConflictInputPanelProps) {
  return (
    <div className="space-y-6">
      <PasteParser
        onDataParsed={onDataParsed}
        invalid={Boolean(analysisErrorId)}
        describedBy={analysisErrorId}
      />

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
            <CardDescription>Parsed network data and the conflicts detected in it</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <dd className="text-primary text-2xl font-bold">{analysis.totalEntries}</dd>
                <dt className="text-muted-foreground text-sm">Total Entries</dt>
              </div>
              <div className="text-center">
                <dd className="text-2xl font-bold text-blue-600">{analysis.uniqueIPs}</dd>
                <dt className="text-muted-foreground text-sm">Unique IPs</dt>
              </div>
              <div className="text-center">
                <dd className="text-2xl font-bold text-green-600">{analysis.uniqueMACs}</dd>
                <dt className="text-muted-foreground text-sm">Unique MACs</dt>
              </div>
              <div className="text-center">
                <dd className="text-2xl font-bold text-orange-600">{analysis.conflicts.length}</dd>
                <dt className="text-muted-foreground text-sm">Conflicts</dt>
              </div>
            </dl>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Data sources:</span>
              {analysis.sources.map((source) => (
                <Badge key={source} variant="outline">
                  {source}
                </Badge>
              ))}
            </div>

            {analysis.conflicts.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                  High: {analysis.summary.high}
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-orange-600" aria-hidden="true" />
                  Medium: {analysis.summary.medium}
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                  Low: {analysis.summary.low}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ConflictInputPanel
