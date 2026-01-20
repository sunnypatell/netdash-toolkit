"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Globe,
  Building2,
  Calendar,
  Server,
  User,
  Mail,
  Phone,
  MapPin,
  Copy,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Network,
  Hash,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { toast } from "sonner"

interface RDAPEntity {
  handle?: string
  roles?: string[]
  vcardArray?: [string, Array<[string, object, string, string | string[]]>]
  entities?: RDAPEntity[]
}

interface RDAPNameserver {
  ldhName: string
  ipAddresses?: {
    v4?: string[]
    v6?: string[]
  }
}

interface RDAPEvent {
  eventAction: string
  eventDate: string
}

interface RDAPDomainResponse {
  objectClassName: string
  handle?: string
  ldhName: string
  unicodeName?: string
  status?: string[]
  events?: RDAPEvent[]
  entities?: RDAPEntity[]
  nameservers?: RDAPNameserver[]
  secureDNS?: {
    delegationSigned: boolean
  }
  links?: Array<{ rel: string; href: string }>
}

interface RDAPIPResponse {
  objectClassName: string
  handle?: string
  startAddress?: string
  endAddress?: string
  ipVersion?: string
  name?: string
  type?: string
  country?: string
  parentHandle?: string
  status?: string[]
  events?: RDAPEvent[]
  entities?: RDAPEntity[]
  cidr0_cidrs?: Array<{ v4prefix?: string; v6prefix?: string; length: number }>
  links?: Array<{ rel: string; href: string }>
}

interface RDAPASNResponse {
  objectClassName: string
  handle?: string
  startAutnum?: number
  endAutnum?: number
  name?: string
  type?: string
  country?: string
  status?: string[]
  events?: RDAPEvent[]
  entities?: RDAPEntity[]
}

type LookupType = "domain" | "ip" | "asn"
type LookupStatus = "idle" | "loading" | "success" | "error"

interface ParsedContact {
  name?: string
  organization?: string
  email?: string
  phone?: string
  address?: string
  roles: string[]
}

export function WhoisLookup() {
  const [query, setQuery] = useState("")
  const [lookupType, setLookupType] = useState<LookupType>("domain")
  const [status, setStatus] = useState<LookupStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [domainResult, setDomainResult] = useState<RDAPDomainResponse | null>(null)
  const [ipResult, setIPResult] = useState<RDAPIPResponse | null>(null)
  const [asnResult, setASNResult] = useState<RDAPASNResponse | null>(null)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  // Detect query type automatically
  const detectQueryType = (input: string): LookupType => {
    const trimmed = input.trim().toLowerCase()

    // ASN detection
    if (/^(as)?\d+$/i.test(trimmed)) return "asn"

    // IPv4 detection
    if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(trimmed)) return "ip"

    // IPv6 detection
    if (/^[a-f0-9:]+$/i.test(trimmed) && trimmed.includes(":")) return "ip"

    // Default to domain
    return "domain"
  }

  const cleanQuery = (input: string, type: LookupType): string => {
    let clean = input.trim().toLowerCase()

    if (type === "domain") {
      // Remove protocol and path
      clean = clean.replace(/^https?:\/\//, "")
      clean = clean.split("/")[0]
      clean = clean.split(":")[0]
    } else if (type === "asn") {
      // Remove "AS" prefix if present
      clean = clean.replace(/^as/i, "")
    }

    return clean
  }

  const performLookup = useCallback(async () => {
    if (!query.trim()) {
      setError("Please enter a domain, IP address, or ASN")
      return
    }

    const type = detectQueryType(query)
    setLookupType(type)
    const cleanedQuery = cleanQuery(query, type)

    setStatus("loading")
    setError(null)
    setDomainResult(null)
    setIPResult(null)
    setASNResult(null)

    try {
      let url: string
      let response: Response

      switch (type) {
        case "domain":
          // Use RDAP bootstrap for domains
          url = `https://rdap.org/domain/${encodeURIComponent(cleanedQuery)}`
          response = await fetch(url)
          break

        case "ip":
          // Use RDAP for IP
          url = `https://rdap.org/ip/${encodeURIComponent(cleanedQuery)}`
          response = await fetch(url)
          break

        case "asn":
          // Use RDAP for ASN
          url = `https://rdap.org/autnum/${encodeURIComponent(cleanedQuery)}`
          response = await fetch(url)
          break
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Not found - the domain, IP, or ASN may not be registered")
        }
        throw new Error(`Lookup failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      switch (type) {
        case "domain":
          setDomainResult(data)
          break
        case "ip":
          setIPResult(data)
          break
        case "asn":
          setASNResult(data)
          break
      }

      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed")
      setStatus("error")
    }
  }, [query])

  const parseVCard = (entity: RDAPEntity): ParsedContact => {
    const contact: ParsedContact = {
      roles: entity.roles || [],
    }

    if (entity.vcardArray && entity.vcardArray[1]) {
      for (const field of entity.vcardArray[1]) {
        const [type, , , value] = field
        switch (type) {
          case "fn":
            contact.name = Array.isArray(value) ? value.join(" ") : value
            break
          case "org":
            contact.organization = Array.isArray(value) ? value.join(" ") : value
            break
          case "email":
            contact.email = Array.isArray(value) ? value[0] : value
            break
          case "tel":
            contact.phone = Array.isArray(value) ? value[0] : value
            break
          case "adr":
            if (Array.isArray(value)) {
              contact.address = value.filter((v) => v).join(", ")
            }
            break
        }
      }
    }

    return contact
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateString
    }
  }

  const getStatusBadgeVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    const lower = status.toLowerCase()
    if (lower.includes("active") || lower.includes("ok")) return "default"
    if (lower.includes("inactive") || lower.includes("hold")) return "destructive"
    return "secondary"
  }

  const exampleQueries = [
    { label: "google.com", type: "Domain" },
    { label: "8.8.8.8", type: "IP" },
    { label: "AS15169", type: "ASN" },
    { label: "cloudflare.com", type: "Domain" },
    { label: "1.1.1.1", type: "IP" },
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
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="query" className="sr-only">
                Query
              </Label>
              <Input
                id="query"
                placeholder="example.com, 8.8.8.8, or AS15169"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && performLookup()}
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
              <Button key={ex.label} variant="outline" size="sm" onClick={() => setQuery(ex.label)}>
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
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Domain Result */}
      {domainResult && status === "success" && (
        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
            <TabsTrigger
              value="info"
              className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
            >
              Domain Info
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
            >
              Contacts
            </TabsTrigger>
            <TabsTrigger
              value="nameservers"
              className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
            >
              Nameservers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {domainResult.ldhName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Domain Name</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{domainResult.ldhName}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(domainResult.ldhName)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {domainResult.unicodeName &&
                    domainResult.unicodeName !== domainResult.ldhName && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-sm">Unicode Name</p>
                        <p className="font-medium">{domainResult.unicodeName}</p>
                      </div>
                    )}
                  {domainResult.handle && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm">Handle</p>
                      <p className="font-mono text-sm">{domainResult.handle}</p>
                    </div>
                  )}
                  {domainResult.secureDNS && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm">DNSSEC</p>
                      <Badge
                        variant={domainResult.secureDNS.delegationSigned ? "default" : "secondary"}
                      >
                        {domainResult.secureDNS.delegationSigned ? "Signed" : "Unsigned"}
                      </Badge>
                    </div>
                  )}
                </div>

                {domainResult.status && domainResult.status.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {domainResult.status.map((s, i) => (
                        <Badge key={i} variant={getStatusBadgeVariant(s)}>
                          {s.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {domainResult.events && domainResult.events.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">Events</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {domainResult.events.map((event, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                          <Calendar className="text-muted-foreground h-4 w-4" />
                          <div>
                            <p className="text-xs font-medium capitalize">
                              {event.eventAction.replace(/_/g, " ")}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {formatDate(event.eventDate)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            {domainResult.entities && domainResult.entities.length > 0 ? (
              <div className="grid gap-4">
                {domainResult.entities.map((entity, index) => {
                  const contact = parseVCard(entity)
                  return (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <User className="h-4 w-4" />
                          {contact.name || contact.organization || entity.handle || "Contact"}
                          <div className="flex gap-1">
                            {contact.roles.map((role, i) => (
                              <Badge key={i} variant="outline" className="text-xs capitalize">
                                {role.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          {contact.organization && (
                            <div className="flex items-center gap-2">
                              <Building2 className="text-muted-foreground h-4 w-4" />
                              <span>{contact.organization}</span>
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="text-muted-foreground h-4 w-4" />
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-primary hover:underline"
                              >
                                {contact.email}
                              </a>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="text-muted-foreground h-4 w-4" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                          {contact.address && (
                            <div className="flex items-start gap-2 sm:col-span-2">
                              <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" />
                              <span>{contact.address}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No contact information available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="nameservers" className="space-y-4">
            {domainResult.nameservers && domainResult.nameservers.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Nameservers ({domainResult.nameservers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {domainResult.nameservers.map((ns, index) => (
                      <div key={index} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{ns.ldhName}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copyToClipboard(ns.ldhName)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {ns.ipAddresses && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {ns.ipAddresses.v4?.map((ip, i) => (
                              <Badge
                                key={`v4-${i}`}
                                variant="outline"
                                className="font-mono text-xs"
                              >
                                {ip}
                              </Badge>
                            ))}
                            {ns.ipAddresses.v6?.map((ip, i) => (
                              <Badge
                                key={`v6-${i}`}
                                variant="outline"
                                className="font-mono text-xs"
                              >
                                {ip}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No nameserver information available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* IP Result */}
      {ipResult && status === "success" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              IP Block Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ipResult.startAddress && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Range Start</p>
                  <p className="font-mono font-medium">{ipResult.startAddress}</p>
                </div>
              )}
              {ipResult.endAddress && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Range End</p>
                  <p className="font-mono font-medium">{ipResult.endAddress}</p>
                </div>
              )}
              {ipResult.ipVersion && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">IP Version</p>
                  <Badge variant="outline">IPv{ipResult.ipVersion}</Badge>
                </div>
              )}
              {ipResult.name && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Network Name</p>
                  <p className="font-medium">{ipResult.name}</p>
                </div>
              )}
              {ipResult.type && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Type</p>
                  <Badge variant="secondary">{ipResult.type}</Badge>
                </div>
              )}
              {ipResult.country && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Country</p>
                  <p className="font-medium">{ipResult.country}</p>
                </div>
              )}
              {ipResult.handle && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Handle</p>
                  <p className="font-mono text-sm">{ipResult.handle}</p>
                </div>
              )}
              {ipResult.parentHandle && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Parent Handle</p>
                  <p className="font-mono text-sm">{ipResult.parentHandle}</p>
                </div>
              )}
            </div>

            {ipResult.cidr0_cidrs && ipResult.cidr0_cidrs.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">CIDR Blocks</p>
                <div className="flex flex-wrap gap-2">
                  {ipResult.cidr0_cidrs.map((cidr, i) => (
                    <Badge key={i} variant="outline" className="font-mono">
                      {cidr.v4prefix || cidr.v6prefix}/{cidr.length}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {ipResult.status && ipResult.status.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Status</p>
                <div className="flex flex-wrap gap-2">
                  {ipResult.status.map((s, i) => (
                    <Badge key={i} variant={getStatusBadgeVariant(s)}>
                      {s.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {ipResult.entities && ipResult.entities.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Organizations</p>
                <div className="grid gap-2">
                  {ipResult.entities.map((entity, i) => {
                    const contact = parseVCard(entity)
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                        <Building2 className="text-muted-foreground h-4 w-4" />
                        <span>{contact.organization || contact.name || entity.handle}</span>
                        {contact.roles.map((role, j) => (
                          <Badge key={j} variant="outline" className="text-xs capitalize">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ASN Result */}
      {asnResult && status === "success" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              ASN Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {asnResult.startAutnum && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">ASN</p>
                  <p className="font-mono text-lg font-bold">
                    AS{asnResult.startAutnum}
                    {asnResult.endAutnum && asnResult.endAutnum !== asnResult.startAutnum && (
                      <span className="text-muted-foreground"> - AS{asnResult.endAutnum}</span>
                    )}
                  </p>
                </div>
              )}
              {asnResult.name && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Name</p>
                  <p className="font-medium">{asnResult.name}</p>
                </div>
              )}
              {asnResult.type && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Type</p>
                  <Badge variant="secondary">{asnResult.type}</Badge>
                </div>
              )}
              {asnResult.country && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Country</p>
                  <p className="font-medium">{asnResult.country}</p>
                </div>
              )}
              {asnResult.handle && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Handle</p>
                  <p className="font-mono text-sm">{asnResult.handle}</p>
                </div>
              )}
            </div>

            {asnResult.status && asnResult.status.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Status</p>
                <div className="flex flex-wrap gap-2">
                  {asnResult.status.map((s, i) => (
                    <Badge key={i} variant={getStatusBadgeVariant(s)}>
                      {s.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {asnResult.entities && asnResult.entities.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Organizations</p>
                <div className="grid gap-2">
                  {asnResult.entities.map((entity, i) => {
                    const contact = parseVCard(entity)
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                        <Building2 className="text-muted-foreground h-4 w-4" />
                        <span>{contact.organization || contact.name || entity.handle}</span>
                        {contact.roles.map((role, j) => (
                          <Badge key={j} variant="outline" className="text-xs capitalize">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {asnResult.events && asnResult.events.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Events</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {asnResult.events.map((event, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      <div>
                        <p className="text-xs font-medium capitalize">
                          {event.eventAction.replace(/_/g, " ")}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(event.eventDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
            , the modern replacement for traditional WHOIS.
          </p>
          <div className="space-y-2">
            <p className="text-foreground font-medium">Supported Lookups:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>Domains</strong> - Registration info, expiry, nameservers, contacts
              </li>
              <li>
                <strong>IP Addresses</strong> - Block ownership, network name, organization
              </li>
              <li>
                <strong>ASN</strong> - Autonomous System information, operator details
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
