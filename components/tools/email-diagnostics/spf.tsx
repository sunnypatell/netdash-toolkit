"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, FileText } from "lucide-react"
import type { SPFResult } from "@/lib/email-auth"
import { Issues } from "./issues"

export interface SPFPanelProps {
  result: SPFResult
  onCopy?: (text: string) => void
}

export function SPFPanel({ result, onCopy }: SPFPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" aria-hidden="true" />
          SPF Record
        </CardTitle>
        <CardDescription>Sender Policy Framework configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.found && (
          <>
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <code className="text-sm break-all">{result.record}</code>
                {onCopy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0"
                    onClick={() => onCopy(result.record || "")}
                    aria-label="Copy SPF record"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Mechanisms</p>
                <div className="flex flex-wrap gap-1">
                  {result.mechanisms.map((mechanism) => (
                    <Badge key={mechanism} variant="outline" className="font-mono text-xs">
                      {mechanism}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">All Mechanism</p>
                <Badge
                  variant={
                    result.all === "-all"
                      ? "default"
                      : result.all === "~all"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {result.all || "Not specified"}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">DNS Lookups</p>
                <Badge variant={result.lookupCount > 10 ? "destructive" : "outline"}>
                  {result.lookupCount} of 10
                </Badge>
                <p className="text-muted-foreground text-xs">
                  Direct terms only; lookups inside includes are not followed.
                </p>
              </div>
            </div>

            {result.includes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Includes</p>
                <div className="flex flex-wrap gap-1">
                  {result.includes.map((include) => (
                    <Badge key={include} variant="outline" className="text-xs">
                      {include}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <Issues
          errors={result.errors}
          warnings={
            result.found
              ? result.warnings
              : [
                  'Add a TXT record starting with "v=spf1" to declare which servers may send mail for this domain.',
                ]
          }
        />
      </CardContent>
    </Card>
  )
}
