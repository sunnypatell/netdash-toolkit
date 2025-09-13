"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Globe, Search, Activity, CheckCircle, AlertCircle, Clock, Shield } from "lucide-react"
import { queryDNSOverHTTPS } from "@/lib/network-testing"
import type { DNSResult } from "@/lib/network-testing"

export function DNSTools() {
  const [activeQuery, setActiveQuery] = useState(false)
  const [dnsResults, setDnsResults] = useState<DNSResult[]>([])

  // DNS Query State
  const [dnsQuery, setDnsQuery] = useState("example.com")
  const [dnsRecordType, setDnsRecordType] = useState("A")
  const [dnsProvider, setDnsProvider] = useState("cloudflare")

  const runDNSQuery = async () => {
    if (!dnsQuery.trim()) return

    setActiveQuery(true)
    try {
      const result = await queryDNSOverHTTPS(dnsQuery.trim(), dnsRecordType, dnsProvider)
      setDnsResults([result, ...dnsResults.slice(0, 9)]) // Keep last 10 results
    } catch (error) {
      console.error("DNS query failed:", error)
    } finally {
      setActiveQuery(false)
    }
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const renderDNSResults = () => {
    if (dnsResults.length === 0) return null

    return (
      <div className="space-y-4">
        <h4 className="font-semibold">Query Results</h4>
        {dnsResults.map((result, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-mono">{result.domain}</span>
                <Badge variant="outline">{result.recordType}</Badge>
                <Badge variant="secondary">{result.provider}</Badge>
                {result.dnssec && (
                  <Badge variant="outline" className="text-green-600">
                    <Shield className="w-3 h-3 mr-1" />
                    DNSSEC
                  </Badge>
                )}
                {result.success && (
                  <Badge variant="outline" className="text-blue-600">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(result.responseTime)}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>

            {result.success ? (
              result.records.length > 0 ? (
                <div className="space-y-2">
                  {result.records.map((record, recordIndex) => (
                    <div key={recordIndex} className="p-3 bg-muted/50 rounded-md text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
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
                        <div>
                          <span className="text-muted-foreground font-medium">Data:</span>
                          <div className="font-mono text-xs break-all">{record.data}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">
                  No records found for this query
                </div>
              )
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Globe className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">DNS Tools</h1>
          <p className="text-muted-foreground">DNS over HTTPS client with multiple provider support</p>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Secure DNS:</strong> All queries use DNS over HTTPS (DoH) for privacy and security. DNSSEC validation
          is supported where available.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>DNS over HTTPS Query</span>
          </CardTitle>
          <CardDescription>Query DNS records using secure DNS over HTTPS providers with DNSSEC support</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dns-query">Domain Name</Label>
              <Input
                id="dns-query"
                placeholder="example.com"
                value={dnsQuery}
                onChange={(e) => setDnsQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !activeQuery && runDNSQuery()}
              />
            </div>
            <div>
              <Label>Record Type</Label>
              <Select value={dnsRecordType} onValueChange={setDnsRecordType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A (IPv4 Address)</SelectItem>
                  <SelectItem value="AAAA">AAAA (IPv6 Address)</SelectItem>
                  <SelectItem value="CNAME">CNAME (Canonical Name)</SelectItem>
                  <SelectItem value="MX">MX (Mail Exchange)</SelectItem>
                  <SelectItem value="NS">NS (Name Server)</SelectItem>
                  <SelectItem value="TXT">TXT (Text Record)</SelectItem>
                  <SelectItem value="SOA">SOA (Start of Authority)</SelectItem>
                  <SelectItem value="PTR">PTR (Reverse DNS)</SelectItem>
                  <SelectItem value="SRV">SRV (Service Record)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>DNS Provider</Label>
              <Select value={dnsProvider} onValueChange={setDnsProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloudflare">Cloudflare (1.1.1.1)</SelectItem>
                  <SelectItem value="google">Google (8.8.8.8)</SelectItem>
                  <SelectItem value="quad9">Quad9 (9.9.9.9)</SelectItem>
                  <SelectItem value="opendns">OpenDNS</SelectItem>
                  <SelectItem value="adguard">AdGuard DNS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={runDNSQuery} disabled={!dnsQuery.trim() || activeQuery} className="w-full">
                {activeQuery ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Querying...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Query DNS
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDnsQuery("google.com")
                setDnsRecordType("A")
              }}
            >
              Test A Record
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDnsQuery("google.com")
                setDnsRecordType("MX")
              }}
            >
              Test MX Record
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDnsQuery("google.com")
                setDnsRecordType("TXT")
              }}
            >
              Test TXT Record
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDnsQuery("google.com")
                setDnsRecordType("AAAA")
              }}
            >
              Test IPv6
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDnsQuery("8.8.8.8")
                setDnsRecordType("PTR")
              }}
            >
              Reverse DNS
            </Button>
          </div>

          {renderDNSResults()}
        </CardContent>
      </Card>
    </div>
  )
}
