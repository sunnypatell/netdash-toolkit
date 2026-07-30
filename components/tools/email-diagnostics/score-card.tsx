"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Key, Shield, ShieldAlert, ShieldCheck, ShieldX, XCircle } from "lucide-react"
import type { EmailDiagnosticResult } from "@/lib/email-auth"

export interface ScoreCardProps {
  result: EmailDiagnosticResult
}

const scoreColor = (score: number): string => {
  if (score >= 80) return "text-green-500"
  if (score >= 60) return "text-lime-500"
  if (score >= 40) return "text-yellow-500"
  if (score >= 20) return "text-orange-500"
  return "text-red-500"
}

const scoreLabel = (score: number): string => {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Good"
  if (score >= 40) return "Fair"
  if (score >= 20) return "Poor"
  return "Critical"
}

export function ScoreCard({ result }: ScoreCardProps) {
  const enforcedDkim = result.dkim.some((d) => d.valid && !d.testing)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Email Security Score</span>
          <div className="text-right">
            <span className={`text-4xl font-bold ${scoreColor(result.overallScore)}`}>
              {result.overallScore}
            </span>
            <span className="text-muted-foreground text-2xl">/100</span>
          </div>
        </CardTitle>
        <CardDescription>
          <Badge
            variant={
              result.overallScore >= 60
                ? "default"
                : result.overallScore >= 40
                  ? "secondary"
                  : "destructive"
            }
          >
            {scoreLabel(result.overallScore)}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center">
              {result.mx.records.length > 0 ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" aria-hidden="true" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" aria-hidden="true" />
              )}
            </div>
            <p className="text-sm font-medium">MX</p>
            <p className="text-muted-foreground text-xs">
              {result.mx.nullMx
                ? "Null MX"
                : result.mx.records.length > 0
                  ? `${result.mx.records.length} records`
                  : "Missing"}
            </p>
          </div>
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center">
              {result.spf.found ? (
                result.spf.valid ? (
                  <ShieldCheck className="h-6 w-6 text-green-500" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-yellow-500" aria-hidden="true" />
                )
              ) : (
                <ShieldX className="h-6 w-6 text-red-500" aria-hidden="true" />
              )}
            </div>
            <p className="text-sm font-medium">SPF</p>
            <p className="text-muted-foreground text-xs">
              {result.spf.found ? (result.spf.valid ? "Valid" : "Issues") : "Missing"}
            </p>
          </div>
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center">
              <Key
                className={`h-6 w-6 ${
                  enforcedDkim
                    ? "text-green-500"
                    : result.dkim.length > 0
                      ? "text-yellow-500"
                      : "text-red-500"
                }`}
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium">DKIM</p>
            <p className="text-muted-foreground text-xs">
              {result.dkim.length > 0 ? `${result.dkim.length} found` : "Not found"}
            </p>
          </div>
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center">
              <Shield
                className={`h-6 w-6 ${
                  result.dmarc.found
                    ? result.dmarc.valid
                      ? "text-green-500"
                      : "text-yellow-500"
                    : "text-red-500"
                }`}
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium">DMARC</p>
            <p className="text-muted-foreground text-xs">
              {result.dmarc.found
                ? result.dmarc.policy
                  ? `p=${result.dmarc.policy}`
                  : "Invalid"
                : "Missing"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
