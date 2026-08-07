"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/ui/copy-button"
import { Server } from "lucide-react"
import type { MXResult } from "@/lib/email-auth"
import { Issues } from "./issues"

export interface MXPanelProps {
  domain: string
  result: MXResult
}

export function MXPanel({ domain, result }: MXPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" aria-hidden="true" />
          MX Records
        </CardTitle>
        <CardDescription>Mail exchange servers for {domain}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.records.length > 0 && (
          <div className="space-y-2">
            {result.records.map((mx) => (
              <div
                key={`${mx.priority}-${mx.exchange}`}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">
                    {mx.priority}
                  </Badge>
                  <span className="font-medium">{mx.exchange}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">TTL: {mx.ttl}s</span>
                  <CopyButton value={mx.exchange} />
                </div>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">
              Lower preference values are tried first; equal values share the load.
            </p>
          </div>
        )}

        <Issues
          errors={
            result.records.length === 0 && result.errors.length === 0
              ? ["No MX records found, so this domain cannot receive email"]
              : result.errors
          }
          warnings={result.warnings}
        />
      </CardContent>
    </Card>
  )
}
