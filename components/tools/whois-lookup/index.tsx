"use client"

import { Suspense, lazy, useCallback, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, ExternalLink, Globe, Loader2, Search } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import {
  cleanQuery,
  detectQueryType,
  fetchRdap,
  flattenEntities,
  type LookupType,
  type RDAPASNResponse,
  type RDAPDomainResponse,
  type RDAPIPResponse,
} from "@/lib/rdap"
import { ASNResult, IPResult } from "./network-results"

// one chunk per domain panel
const InfoPanel = lazy(() => import("./info"))
const ContactsPanel = lazy(() => import("./contacts"))
const NameserversPanel = lazy(() => import("./nameservers"))

const TABS = ["info", "contacts", "nameservers"] as const

const TRIGGER_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

type LookupStatus = "idle" | "loading" | "success" | "error"

function PanelFallback() {
  return (
    <p role="status" className="text-muted-foreground p-4 text-sm">
      Loading...
    </p>
  )
}

export function WhoisLookup() {
  // the query lives in the url so a lookup is a shareable link, but arriving with
  // ?q= set does not fetch: rdap is a third-party request and needs a button press
  const [urlState, setUrlState] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      tab: parseAsStringLiteral(TABS).withDefault("info"),
    },
    { history: "replace" }
  )
  const { q: query, tab } = urlState

  const [lookupType, setLookupType] = useState<LookupType>("domain")
  const [status, setStatus] = useState<LookupStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [authoritativeUrl, setAuthoritativeUrl] = useState<string | undefined>()
  const [domainResult, setDomainResult] = useState<RDAPDomainResponse | null>(null)
  const [ipResult, setIPResult] = useState<RDAPIPResponse | null>(null)
  const [asnResult, setASNResult] = useState<RDAPASNResponse | null>(null)

  const performLookup = useCallback(async () => {
    if (!query.trim()) {
      setError("Enter a domain, IP address, or ASN")
      setStatus("error")
      return
    }

    const type = detectQueryType(query)
    setLookupType(type)
    setStatus("loading")
    setError(null)
    setAuthoritativeUrl(undefined)
    setDomainResult(null)
    setIPResult(null)
    setASNResult(null)

    try {
      const cleaned = cleanQuery(query, type)
      if (type === "domain") {
        const { data, authoritativeUrl: self } = await fetchRdap<RDAPDomainResponse>(type, cleaned)
        setDomainResult(data)
        setAuthoritativeUrl(self)
      } else if (type === "ip") {
        const { data, authoritativeUrl: self } = await fetchRdap<RDAPIPResponse>(type, cleaned)
        setIPResult(data)
        setAuthoritativeUrl(self)
      } else {
        const { data, authoritativeUrl: self } = await fetchRdap<RDAPASNResponse>(type, cleaned)
        setASNResult(data)
        setAuthoritativeUrl(self)
      }
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed")
      setStatus("error")
    }
  }, [query])

  const exampleQueries = [
    { label: "example.com", type: "Domain" },
    { label: "8.8.8.8", type: "IP" },
    { label: "AS15169", type: "ASN" },
    { label: "iana.org", type: "Domain" },
    { label: "192.0.2.0/24", type: "IP" },
  ]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Search}
        title="WHOIS Lookup"
        description="Look up domain registration, IP block ownership, and ASN information via RDAP"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Query
          </CardTitle>
          <CardDescription>Enter a domain name, IP address, or ASN (e.g., AS15169)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              Pressing Lookup sends what you typed to <strong>rdap.org</strong>, which reads the RFC
              9224 bootstrap registries and redirects your browser to whichever registry or RIR is
              authoritative for it. Both that redirector and the registry that answers see the query
              and your IP address.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="whois-query" className="sr-only">
                Query
              </Label>
              <Input
                id="whois-query"
                placeholder="example.com, 8.8.8.8, or AS15169"
                value={query}
                onChange={(e) => void setUrlState({ q: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && performLookup()}
                aria-invalid={status === "error"}
                aria-describedby={error ? "whois-lookup-error" : undefined}
              />
            </div>
            <Button onClick={performLookup} disabled={status === "loading"}>
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Lookup
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((ex) => (
              <Button
                key={ex.label}
                variant="outline"
                size="sm"
                onClick={() => void setUrlState({ q: ex.label })}
              >
                <Badge variant="outline" className="mr-2 text-xs">
                  {ex.type}
                </Badge>
                {ex.label}
              </Button>
            ))}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription id="whois-lookup-error">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* live region: the rdap response arrives asynchronously */}
      <div aria-live="polite" aria-busy={status === "loading"} className="space-y-4 sm:space-y-6">
        {domainResult && status === "success" && lookupType === "domain" && (
          <Tabs
            value={tab}
            onValueChange={(value) => void setUrlState({ tab: value as (typeof TABS)[number] })}
            className="space-y-4"
          >
            <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
              <TabsTrigger value="info" className={TRIGGER_CLASS}>
                Domain Info
              </TabsTrigger>
              <TabsTrigger value="contacts" className={TRIGGER_CLASS}>
                Contacts ({flattenEntities(domainResult.entities).length})
              </TabsTrigger>
              <TabsTrigger value="nameservers" className={TRIGGER_CLASS}>
                Nameservers ({domainResult.nameservers?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <InfoPanel domain={domainResult} authoritativeUrl={authoritativeUrl} />
              </Suspense>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <ContactsPanel domain={domainResult} />
              </Suspense>
            </TabsContent>

            <TabsContent value="nameservers" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <NameserversPanel domain={domainResult} />
              </Suspense>
            </TabsContent>
          </Tabs>
        )}

        {ipResult && status === "success" && (
          <IPResult result={ipResult} authoritativeUrl={authoritativeUrl} />
        )}

        {asnResult && status === "success" && (
          <ASNResult result={asnResult} authoritativeUrl={authoritativeUrl} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About WHOIS/RDAP</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <p>
            This tool uses{" "}
            <a
              href="https://www.icann.org/rdap"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              RDAP (Registration Data Access Protocol) <ExternalLink className="inline h-3 w-3" />
            </a>
            , the modern replacement for port-43 WHOIS. It is JSON over HTTPS with CORS, which is
            why a browser can read it at all - classic WHOIS runs on TCP 43 and is unreachable from
            a web page.
          </p>
          <div className="space-y-2">
            <p className="text-foreground font-medium">Supported lookups:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>Domains</strong> - registration events, status, nameservers, contacts
              </li>
              <li>
                <strong>IP addresses</strong> - block ownership, network name, organization
              </li>
              <li>
                <strong>ASN</strong> - autonomous system information and operator
              </li>
            </ul>
          </div>
          <p>
            Not every TLD runs an RDAP service. Where one does not exist, the bootstrap has nothing
            to redirect to and the lookup fails with a 404 that means &quot;no service&quot;, not
            &quot;not registered&quot;.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
