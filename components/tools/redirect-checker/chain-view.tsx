"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/copy-button"
import { AlertTriangle, ArrowRight, Download, ExternalLink, Globe } from "lucide-react"
import { dateStamp, downloadTextFile } from "@/lib/download"
import type { RedirectChain } from "@/lib/redirect-chain"

export type ChainSource = "pasted" | "relay"

export interface TracedChain extends RedirectChain {
  source: ChainSource
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return "bg-green-500"
  if (status >= 300 && status < 400) return "bg-blue-500"
  if (status >= 400 && status < 500) return "bg-yellow-500"
  if (status >= 500) return "bg-red-500"
  return "bg-gray-500"
}

function statusVariant(status: number) {
  if (status >= 200 && status < 300) return "default" as const
  if (status >= 300 && status < 400) return "secondary" as const
  return "destructive" as const
}

export function ChainSummary({ result }: { result: TracedChain }) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Source</span>
          <Badge variant={result.source === "relay" ? "destructive" : "secondary"}>
            {result.source === "relay" ? "unverified - via relay" : "your own capture"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Hops</span>
          <Badge variant="secondary">{result.hops.length}</Badge>
        </div>
        {result.isHttpsUpgrade && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">HTTPS upgrade</span>
            <Badge variant="default" className="bg-green-600">
              Yes
            </Badge>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          {result.truncated ? "Last URL seen" : "Final URL"}
        </p>
        <div className="flex items-start gap-2">
          <p className="flex-1 font-mono text-xs break-all">{result.finalUrl}</p>
          <CopyButton value={result.finalUrl} />
        </div>
      </div>

      {result.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-inside list-disc space-y-1 text-sm">
              {result.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export function ChainView({ result }: { result: TracedChain | null }) {
  // the source travels with the chain, so a relayed trace stays labelled unverified in the file
  const exportChain = () => {
    if (!result) return
    downloadTextFile(
      JSON.stringify(
        {
          source: result.source,
          verified: result.source !== "relay",
          exportedAt: new Date().toISOString(),
          chain: result,
        },
        null,
        2
      ),
      `redirect-chain-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Redirect chain
          {result && (
            <Button variant="outline" size="sm" onClick={exportChain}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          {result
            ? `${result.hops.length} hop${result.hops.length === 1 ? "" : "s"}${result.source === "relay" ? " - reported by the relay, unverified" : ""}`
            : "Paste or relay a trace to see the chain"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="space-y-4">
            {result.hops.map((hop, index) => {
              const isLast = index === result.hops.length - 1
              return (
                <div key={`${hop.url}-${index}`} className="relative">
                  {!isLast && <div className="bg-border absolute top-12 left-4 h-full w-0.5" />}
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${statusColor(hop.status)} flex-shrink-0 text-sm font-bold text-white`}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 pb-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(hop.status)}>
                          {hop.status} {hop.statusText}
                        </Badge>
                        {isLast &&
                          (result.truncated ? (
                            <Badge variant="outline">Chain truncated - not final</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600">
                              Final
                            </Badge>
                          ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="flex-1 font-mono text-sm break-all">{hop.url}</p>
                        <CopyButton value={hop.url} className="flex-shrink-0" />
                        <a
                          href={hop.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0"
                        >
                          <Button variant="ghost" size="sm" aria-label="Open hop in a new tab">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                      {hop.location && (
                        <div className="text-muted-foreground space-y-1 text-sm">
                          <div className="flex items-start gap-2">
                            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <span className="font-mono break-all">Location: {hop.location}</span>
                          </div>
                          {hop.resolved && hop.resolved !== hop.location && (
                            <p className="pl-6 font-mono text-xs break-all">
                              resolves to {hop.resolved}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <Globe className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">No chain loaded yet</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
