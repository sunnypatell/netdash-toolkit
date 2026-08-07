"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { sourceLabel, type LookupRow } from "./types"

interface ResultsPanelProps {
  rows: LookupRow[]
  onExportJson: () => void
  onExportCsv: () => void
}

export function ResultsPanel({ rows, onExportJson, onExportCsv }: ResultsPanelProps) {
  const vendorStats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      if (row.found && row.vendor) counts.set(row.vendor, (counts.get(row.vendor) ?? 0) + 1)
    }
    return [...counts].sort(([, a], [, b]) => b - a).slice(0, 10)
  }, [rows])

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Nothing looked up yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center rounded-lg border">
            <p className="text-muted-foreground text-sm">
              Look up a MAC address to see its vendor here
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            Lookup results
            <span className="flex items-center gap-2">
              <Badge variant="outline">{rows.length} total</Badge>
              <Badge variant="secondary">{rows.filter((r) => r.found).length} found</Badge>
              <Badge variant="outline">
                {rows.filter((r) => r.source === "offline").length} offline
              </Badge>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {rows.map((result, index) => (
              <div
                key={`${result.input}-${index}`}
                className="hover:bg-muted/50 rounded-lg border p-3 transition-colors"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm">{result.mac ?? result.input}</span>
                    <CopyButton value={result.mac ?? result.input} className="h-6 w-6 p-0" />
                  </span>
                  <Badge variant={result.found ? "default" : "secondary"}>
                    {result.found ? "Found" : "Not found"}
                  </Badge>
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">OUI</dt>
                    <dd className="font-mono">{result.ouiFormatted || "N/A"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Vendor</dt>
                    <dd className={result.found ? "font-medium" : "text-muted-foreground"}>
                      {result.vendor ?? "No vendor registered for this prefix"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="text-muted-foreground">{sourceLabel(result.source)}</dd>
                  </div>
                  {result.error && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Note</dt>
                      <dd className="text-muted-foreground text-right text-xs">{result.error}</dd>
                    </div>
                  )}
                </dl>
                {result.locallyAdministered && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Locally administered address (U/L bit set) - randomized or manually assigned, so
                    no vendor is registered for it.
                  </p>
                )}
                {result.multicast && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Multicast or group address (I/G bit set), not a single interface.
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {vendorStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vendor distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {vendorStats.map(([vendor, count]) => (
                <li key={vendor} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{vendor}</span>
                  <Badge variant="outline">{count}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={onExportJson} variant="outline" className="flex-1">
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
        <Button onClick={onExportCsv} variant="outline" className="flex-1">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>
  )
}
