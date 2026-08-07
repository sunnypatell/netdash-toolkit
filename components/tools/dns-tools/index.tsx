"use client"

import { Suspense, lazy, useState, useEffect } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Globe, Search, Activity, AlertCircle, Shield, Zap, Database, Trash2 } from "lucide-react"
import { queryDNSOverHTTPS, dnsCache } from "@/lib/network-testing"
import type { DNSResult } from "@/lib/network-testing"
import { isElectron, electronNetwork } from "@/lib/electron"
import { resolveQueryName } from "@/lib/reverse-dns"
import { ToolHeader } from "@/components/ui/tool-header"
import { dateStamp, downloadTextFile } from "@/lib/download"
import type { QueryOutcome } from "./results"

// the result list only exists once a lookup has answered, so it loads then. as a
// static import it rode along in the payload of every page in the app.
const DNSResults = lazy(() => import("./results").then((m) => ({ default: m.DNSResults })))

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "PTR", "SRV"] as const
const PROVIDERS = ["native", "cloudflare", "google", "quad9", "opendns", "adguard"] as const

function ResultsFallback() {
  return (
    <p
      role="status"
      className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
      data-panel-fallback
    >
      Loading results...
    </p>
  )
}

export function DNSTools() {
  const [query, setQuery] = useQueryStates(
    {
      name: parseAsString.withDefault("example.com"),
      type: parseAsStringLiteral(RECORD_TYPES).withDefault("A"),
      provider: parseAsStringLiteral(PROVIDERS).withDefault("cloudflare"),
    },
    // typing should not add one history entry per keystroke
    { history: "replace" }
  )
  const { name: dnsQuery, type: dnsRecordType, provider: dnsProvider } = query

  const [activeQuery, setActiveQuery] = useState(false)
  const [outcomes, setOutcomes] = useState<QueryOutcome[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isNative, setIsNative] = useState(false)
  const [cacheStats, setCacheStats] = useState({ size: 0, hits: 0, misses: 0, hitRate: "0%" })

  useEffect(() => {
    setIsNative(isElectron())
  }, [])

  const updateCacheStats = () => setCacheStats(dnsCache.getStats())

  const exportResults = () => {
    if (outcomes.length === 0) return
    downloadTextFile(
      JSON.stringify(
        outcomes.map(({ result, sentName, typedName }) => ({ ...result, sentName, typedName })),
        null,
        2
      ),
      `dns-lookups-${dateStamp()}.json`,
      "application/json"
    )
  }

  const clearCache = () => {
    dnsCache.clear()
    updateCacheStats()
  }

  const runDNSQuery = async () => {
    if (!dnsQuery.trim()) return

    // a PTR record lives under in-addr.arpa (rfc 1035 3.5) or ip6.arpa (rfc 3596
    // 2.5), never at the address itself. sending "8.8.8.8" as a PTR name asked for
    // a name that cannot exist and always came back NXDOMAIN.
    const { name: sentName, rewrittenFrom } = resolveQueryName(dnsQuery, dnsRecordType)

    setActiveQuery(true)
    setError(null)
    try {
      if (dnsProvider === "native" && isNative) {
        const nativeResult = await electronNetwork.dnsLookup(sentName, { type: dnsRecordType })
        if (!nativeResult) {
          setError("The desktop resolver did not answer")
          return
        }
        const result: DNSResult = {
          domain: sentName,
          recordType: dnsRecordType,
          provider: "Native (System)",
          timestamp: Date.now(),
          responseTime: nativeResult.responseTime,
          success: !nativeResult.error,
          error: nativeResult.error,
          // the system resolver api reports no AD bit, so claiming anything about
          // dnssec here would be an invention
          dnssec: false,
          records: nativeResult.records.map((r) => ({
            name: sentName,
            type: r.type,
            ttl: r.ttl || 0,
            data: r.value,
          })),
        }
        setOutcomes((prev) => [{ result, sentName, typedName: rewrittenFrom }, ...prev.slice(0, 9)])
        return
      }

      const result = await queryDNSOverHTTPS(sentName, dnsRecordType, dnsProvider)
      setOutcomes((prev) => [{ result, sentName, typedName: rewrittenFrom }, ...prev.slice(0, 9)])
    } catch (err) {
      setError(err instanceof Error ? err.message : "DNS query failed")
    } finally {
      updateCacheStats()
      setActiveQuery(false)
    }
  }

  const applyPreset = (name: string, type: (typeof RECORD_TYPES)[number]) =>
    void setQuery({ name, type })

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe}
        title="DNS Tools"
        description="DNS over HTTPS client with multiple provider support"
      />

      {isNative ? (
        <Alert className="border-green-500/50 bg-green-500/10">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Desktop app:</strong> the Native (System DNS) provider asks your own configured
            resolver over port 53, which a browser cannot do. The DoH providers below stay
            available.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>What DNS over HTTPS does and does not hide</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              A browser has no access to port 53, so every lookup here is an HTTPS request to a
              third-party DoH resolver (RFC 8484). The query is encrypted <em>in transit</em>, which
              hides it from your network - but the resolver you pick receives the name you asked
              about along with your IP address, and can log both. Pick the provider accordingly.
            </p>
            <p>
              A DNSSEC badge below means that resolver set the AD bit, i.e. it says it validated the
              answer (RFC 4035 §3.2.3). This page does not verify signatures itself, so that is the
              resolver&apos;s claim, not proof.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>DNS over HTTPS Query</span>
          </CardTitle>
          <CardDescription>Query DNS records through a DoH resolver of your choice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* the shared disclosure is rendered once by ToolShell; this card used to
              repeat the same sentence a second time */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="dns-query">Domain Name</Label>
              <Input
                id="dns-query"
                placeholder="example.com"
                value={dnsQuery}
                onChange={(e) => void setQuery({ name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && !activeQuery && runDNSQuery()}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "dns-tools-error" : undefined}
              />
            </div>
            <div>
              <Label htmlFor="dns-record-type">Record Type</Label>
              <Select
                value={dnsRecordType}
                onValueChange={(value) =>
                  void setQuery({ type: value as (typeof RECORD_TYPES)[number] })
                }
              >
                <SelectTrigger id="dns-record-type">
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
              <Label htmlFor="dns-provider">DNS Provider</Label>
              <Select
                value={dnsProvider}
                onValueChange={(value) =>
                  void setQuery({ provider: value as (typeof PROVIDERS)[number] })
                }
              >
                <SelectTrigger id="dns-provider">
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription id="dns-tools-error">{error}</AlertDescription>
            </Alert>
          )}

          <Separator />

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
            <Button variant="ghost" size="sm" onClick={clearCache} disabled={cacheStats.size === 0}>
              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
              Clear DNS Cache
            </Button>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
            <Button variant="outline" size="sm" onClick={() => applyPreset("example.com", "A")}>
              Test A Record
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("example.com", "MX")}>
              Test MX Record
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("example.com", "TXT")}>
              Test TXT Record
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("example.com", "AAAA")}>
              Test IPv6
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("8.8.8.8", "PTR")}>
              Reverse DNS
            </Button>
          </div>

          {/* live region so results are announced when the async query lands */}
          <div aria-live="polite" aria-busy={activeQuery}>
            {outcomes.length > 0 ? (
              <Suspense fallback={<ResultsFallback />}>
                <DNSResults outcomes={outcomes} onExport={exportResults} />
              </Suspense>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                Enter a domain name, pick a record type and provider, then run the query - records,
                TTLs and response times appear here. Nothing is sent until you press the button.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
