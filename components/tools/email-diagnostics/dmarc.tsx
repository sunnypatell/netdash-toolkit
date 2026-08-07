"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/ui/copy-button"
import { Shield } from "lucide-react"
import type { DMARCResult } from "@/lib/email-auth"
import { Issues } from "./issues"

export interface DMARCPanelProps {
  domain: string
  result: DMARCResult
}

const ALIGNMENT_LABEL = { r: "relaxed", s: "strict" } as const

export function DMARCPanel({ domain, result }: DMARCPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" aria-hidden="true" />
          DMARC Record
        </CardTitle>
        <CardDescription>
          Domain-based Message Authentication, Reporting & Conformance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.found && (
          <>
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <code className="text-sm break-all">{result.record}</code>
                <CopyButton value={result.record || ""} className="shrink-0" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Policy</p>
                <Badge
                  variant={
                    result.policy === "reject"
                      ? "default"
                      : result.policy === "quarantine"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {result.policy || "Not set"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Subdomain Policy</p>
                <Badge variant="outline">{result.effectiveSubdomainPolicy || "Not set"}</Badge>
                {!result.subdomainPolicy && result.policy && (
                  <p className="text-muted-foreground text-xs">Inherited from p</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Percentage</p>
                <Badge variant={result.percentage === 100 ? "outline" : "secondary"}>
                  {result.percentage}%
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Alignment</p>
                <Badge variant="outline">
                  dkim {ALIGNMENT_LABEL[result.dkimAlignment]} / spf{" "}
                  {ALIGNMENT_LABEL[result.spfAlignment]}
                </Badge>
              </div>
            </div>

            {result.rua.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Aggregate Reports (rua)</p>
                <div className="flex flex-wrap gap-1">
                  {result.rua.map((address) => (
                    <Badge key={address} variant="outline" className="text-xs">
                      {address}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.ruf.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Forensic Reports (ruf)</p>
                <div className="flex flex-wrap gap-1">
                  {result.ruf.map((address) => (
                    <Badge key={address} variant="outline" className="text-xs">
                      {address}
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
              : [`Add a TXT record at _dmarc.${domain} to publish an authentication policy.`]
          }
        />
      </CardContent>
    </Card>
  )
}
