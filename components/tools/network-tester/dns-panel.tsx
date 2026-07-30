"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Activity, AlertCircle, CheckCircle, Globe, Search } from "lucide-react"
import { queryDNSOverHTTPS } from "@/lib/network-testing"
import type { DNSResult } from "@/lib/network-testing"
import { formatDuration } from "@/lib/format"

const PROVIDERS = [
  { value: "cloudflare", label: "Cloudflare (1.1.1.1)", host: "cloudflare-dns.com" },
  { value: "google", label: "Google (8.8.8.8)", host: "dns.google" },
  { value: "quad9", label: "Quad9 (9.9.9.9)", host: "dns.quad9.net" },
  { value: "opendns", label: "OpenDNS", host: "doh.opendns.com" },
  { value: "adguard", label: "AdGuard DNS", host: "dns.adguard-dns.com" },
]

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "PTR", "SRV"]

export function DNSPanel() {
  const [domain, setDomain] = useState("example.com")
  const [recordType, setRecordType] = useState("A")
  const [provider, setProvider] = useState("cloudflare")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<DNSResult[]>([])

  const providerHost = PROVIDERS.find((p) => p.value === provider)?.host ?? "the resolver"

  const runQuery = async () => {
    if (!domain.trim()) return

    setRunning(true)
    setError(null)
    try {
      const result = await queryDNSOverHTTPS(domain.trim(), recordType, provider)
      setResults((previous) => [result, ...previous.slice(0, 9)])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "DNS query failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="h-5 w-5" aria-hidden="true" />
          <span>DNS over HTTPS</span>
        </CardTitle>
        <CardDescription>
          Resolve records through a public DoH resolver instead of this device&apos;s resolver
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <strong>Third party lookup:</strong> the name you type is sent to{" "}
            <span className="font-mono">{providerHost}</span> over HTTPS, so that operator sees the
            query. Answers come from their cache, not from your configured resolver, so they can
            differ from what this machine would resolve.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="dns-query">Domain</Label>
            <Input
              id="dns-query"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "dns-panel-error" : undefined}
            />
          </div>
          <div>
            <Label htmlFor="dns-record-type">Record Type</Label>
            <Select value={recordType} onValueChange={setRecordType}>
              <SelectTrigger id="dns-record-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dns-provider">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="dns-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={runQuery} disabled={!domain.trim() || running} className="w-full">
              {running ? (
                <>
                  <Activity className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Querying...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                  Query DNS
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription id="dns-panel-error">{error}</AlertDescription>
          </Alert>
        )}

        <div aria-live="polite" aria-busy={running} className="space-y-4">
          {results.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Enter a domain, pick a record type and provider, then run the query - records and TTLs
              appear here.
            </p>
          ) : (
            <div className="space-y-4">
              <h4 className="font-semibold">Recent Queries</h4>
              {results.map((result, index) => (
                <Card key={`${result.timestamp}-${index}`} className="p-4">
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
                      <span className="font-mono">{result.domain}</span>
                      <Badge variant="outline">{result.recordType}</Badge>
                      <Badge variant="secondary">{result.provider}</Badge>
                      {result.dnssec && <Badge variant="outline">DNSSEC</Badge>}
                      {result.success && (
                        <Badge variant="outline">{formatDuration(result.responseTime)}</Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {result.success ? (
                    result.records.length > 0 ? (
                      <div className="space-y-2">
                        {result.records.map((record, recordIndex) => (
                          <div
                            key={recordIndex}
                            className="bg-muted/50 rounded p-2 font-mono text-sm"
                          >
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                              <div>
                                <span className="text-muted-foreground">Name:</span> {record.name}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Type:</span> {record.type}
                              </div>
                              <div>
                                <span className="text-muted-foreground">TTL:</span> {record.ttl}s
                              </div>
                              <div>
                                <span className="text-muted-foreground">Data:</span>
                                <div className="break-all">{record.data}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">No records found</div>
                    )
                  ) : (
                    <div className="text-sm text-red-600">{result.error}</div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
