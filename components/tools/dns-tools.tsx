"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Globe,
  Search,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  Zap,
  Database,
  Trash2,
} from "lucide-react"
import { queryDNSOverHTTPS, dnsCache } from "@/lib/network-testing"
import type { DNSResult } from "@/lib/network-testing"
import { isElectron, electronNetwork } from "@/lib/electron"

export function DNSTools() {
  const [activeQuery, setActiveQuery] = useState(false)
  const [dnsResults, setDnsResults] = useState<DNSResult[]>([])
  const [isNative, setIsNative] = useState(false)
  const [cacheStats, setCacheStats] = useState({ size: 0, hits: 0, misses: 0, hitRate: "0%" })

  // DNS Query State
  const [dnsQuery, setDnsQuery] = useState("example.com")
  const [dnsRecordType, setDnsRecordType] = useState("A")
  const [dnsProvider, setDnsProvider] = useState("cloudflare")

  // Check if running in Electron for native networking
  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  // Update cache stats after each query
  const updateCacheStats = () => {
    setCacheStats(dnsCache.getStats())
  }

  const clearCache = () => {
    dnsCache.clear()
    updateCacheStats()
  }

  const runDNSQuery = async () => {
    if (!dnsQuery.trim()) return

    setActiveQuery(true)
    try {
      // Use native DNS resolution when provider is "native" and we're in Electron
      if (dnsProvider === "native" && isNative) {
        console.log("[NetDash] Using NATIVE DNS resolution")
        const nativeResult = await electronNetwork.dnsLookup(dnsQuery.trim(), {
          type: dnsRecordType,
        })

        if (nativeResult) {
          const result: DNSResult = {
            domain: dnsQuery.trim(),
            recordType: dnsRecordType,
            provider: "Native (System)",
            timestamp: Date.now(),
            responseTime: nativeResult.responseTime,
            success: !nativeResult.error,
            error: nativeResult.error,
            dnssec: false,
            records: nativeResult.records.map((r) => ({
              name: dnsQuery.trim(),
              type: r.type,
              ttl: r.ttl || 0,
              data: r.value,
            })),
          }
          setDnsResults([result, ...dnsResults.slice(0, 9)])
        }
      } else {
        // Use DNS over HTTPS for browser or when DoH provider is selected
        const result = await queryDNSOverHTTPS(dnsQuery.trim(), dnsRecordType, dnsProvider)
        setDnsResults([result, ...dnsResults.slice(0, 9)])
      }
      updateCacheStats()
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
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-mono">{result.domain}</span>
                <Badge variant="outline">{result.recordType}</Badge>
                <Badge variant="secondary">{result.provider}</Badge>
                {result.dnssec && (
                  <Badge variant="outline" className="text-green-600">
                    <Shield className="mr-1 h-3 w-3" />
                    DNSSEC
                  </Badge>
                )}
                {result.success && result.responseTime > 0 && (
                  <Badge variant="outline" className="text-blue-600">
                    <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                    {formatDuration(result.responseTime)}
                  </Badge>
                )}
                {result.success && result.responseTime === 0 && (
                  <Badge variant="outline" className="text-emerald-600">
                    <Database className="mr-1 h-3 w-3" aria-hidden="true" />
                    Cached
                  </Badge>
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
                        <div>
                          <span className="text-muted-foreground font-medium">Data:</span>
                          <div className="font-mono text-xs break-all">{record.data}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground bg-muted/30 rounded-md p-3 text-sm">
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
    <div className="tool-container">
      <div className="flex items-start space-x-3">
        <Globe className="text-primary mt-0.5 h-6 w-6 flex-shrink-0" />
        <div>
          <h1 className="text-responsive-xl font-bold">DNS Tools</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            DNS over HTTPS client with multiple provider support
          </p>
        </div>
      </div>

      {isNative ? (
        <Alert className="border-green-500/50 bg-green-500/10">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Native Mode:</strong> Running in desktop app with native DNS resolution. Select
            "Native (System)" provider for direct DNS queries using your system resolver, or use DoH
            providers for encrypted lookups.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Secure DNS:</strong> All queries use DNS over HTTPS (DoH) for privacy and
            security. DNSSEC validation is supported where available.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>DNS over HTTPS Query</span>
          </CardTitle>
          <CardDescription>
            Query DNS records using secure DNS over HTTPS providers with DNSSEC support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
                  {isNative && <SelectItem value="native">Native (System DNS)</SelectItem>}
                  <SelectItem value="cloudflare">Cloudflare (1.1.1.1)</SelectItem>
                  <SelectItem value="google">Google (8.8.8.8)</SelectItem>
                  <SelectItem value="quad9">Quad9 (9.9.9.9)</SelectItem>
                  <SelectItem value="opendns">OpenDNS</SelectItem>
                  <SelectItem value="adguard">AdGuard DNS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={runDNSQuery}
                disabled={!dnsQuery.trim() || activeQuery}
                className="w-full"
              >
                {activeQuery ? (
                  <>
                    <Activity className="mr-2 h-4 w-4 animate-spin" />
                    Querying...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Query DNS
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* DNS Cache Stats */}
          <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Database className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-medium">DNS Cache</span>
              </div>
              <div className="text-muted-foreground flex items-center space-x-3 text-sm">
                <span>
                  <strong>{cacheStats.size}</strong> entries
                </span>
                <span>
                  <strong>{cacheStats.hits}</strong> hits
                </span>
                <span>
                  <strong>{cacheStats.misses}</strong> misses
                </span>
                <span>
                  <strong>{cacheStats.hitRate}</strong> hit rate
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCache}
              disabled={cacheStats.size === 0}
              aria-label="Clear DNS cache"
            >
              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
              Clear Cache
            </Button>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
            <Button
              variant="outline"
              size="sm"
              className=""
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
              className=""
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
              className=""
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
              className=""
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
              className=""
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
