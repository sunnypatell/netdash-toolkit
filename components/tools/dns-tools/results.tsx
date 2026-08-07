"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Clock, Database, Download, Shield } from "lucide-react"
import type { DNSResult } from "@/lib/network-testing"
import { formatDuration } from "@/lib/format"
import { CopyButton } from "@/components/ui/copy-button"

export interface QueryOutcome {
  result: DNSResult
  // the name actually sent, when it differs from what was typed
  sentName?: string
  typedName?: string
}

export function DNSResults({
  outcomes,
  onExport,
}: {
  outcomes: QueryOutcome[]
  onExport: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">Query Results</h4>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export
        </Button>
      </div>
      {outcomes.map(({ result, sentName, typedName }, index) => {
        // the cache returns the original response time, so it is not a fresh measurement
        const fromCache = result.provider.includes("(cached)")
        return (
          <Card key={index} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                    <span className="sr-only">Succeeded. </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                    <span className="sr-only">Failed. </span>
                  </>
                )}
                <span className="font-mono">{sentName ?? result.domain}</span>
                <Badge variant="outline">{result.recordType}</Badge>
                <Badge variant="secondary">{result.provider}</Badge>
                {result.dnssec && (
                  <Badge variant="outline" className="text-green-600">
                    <Shield className="mr-1 h-3 w-3" aria-hidden="true" />
                    Resolver set AD
                  </Badge>
                )}
                {fromCache ? (
                  <Badge variant="outline" className="text-emerald-600">
                    <Database className="mr-1 h-3 w-3" aria-hidden="true" />
                    From this page&apos;s cache
                  </Badge>
                ) : (
                  result.success &&
                  result.responseTime > 0 && (
                    <Badge variant="outline" className="text-blue-600">
                      <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                      {formatDuration(result.responseTime)}
                    </Badge>
                  )
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                {new Date(result.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {typedName && (
              <p className="text-muted-foreground mb-3 text-xs">
                You entered <span className="font-mono">{typedName}</span>. A PTR record is stored
                under the reversed-address name, so the query sent was{" "}
                <span className="font-mono">{sentName}</span> (RFC 1035 §3.5).
              </p>
            )}

            {result.success ? (
              result.records.length > 0 ? (
                <div className="space-y-2">
                  {result.records.map((record, recordIndex) => (
                    <div key={recordIndex} className="bg-muted/50 rounded-md p-3 text-sm">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground font-medium">Name:</span>
                          <div className="font-mono text-xs break-all">{record.name}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">Type:</span>
                          <div className="font-mono">{record.type}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">TTL:</span>
                          <div className="font-mono">{record.ttl}s</div>
                        </div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <span className="text-muted-foreground font-medium">Data:</span>
                            <div className="font-mono text-xs break-all">{record.data}</div>
                          </div>
                          <CopyButton value={record.data} className="shrink-0" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground bg-muted/30 rounded-md p-3 text-sm">
                  The resolver answered NOERROR with no records of this type. The name exists; this
                  record type is not set on it.
                </div>
              )
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
          </Card>
        )
      })}
    </div>
  )
}
