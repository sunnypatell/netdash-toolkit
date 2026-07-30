"use client"

import { useCallback, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Info,
  Loader2,
  ScrollText,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { downloadTextFile, dateStamp } from "@/lib/download"
import { toast } from "sonner"

// api.certspotter.com sends "access-control-allow-origin: *", verified by curl,
// so it is the one cert data source reachable from a browser. it serves
// certificate transparency log entries - what was ISSUED for a domain, which is
// not the same thing as what the server is serving right now.
const CERTSPOTTER_ENDPOINT = "https://api.certspotter.com/v1/issuances"

interface CtIssuance {
  id: string
  cert_sha256?: string
  dns_names?: string[]
  issuer?: { name?: string; friendly_name?: string }
  not_before?: string
  not_after?: string
  revoked?: boolean
}

interface TrustProbe {
  ok: boolean
  ms: number
}

type CheckStatus = "idle" | "checking" | "complete" | "error"

function cleanHostname(input: string): string {
  let clean = input.trim().toLowerCase()
  clean = clean.replace(/^[a-z]+:\/\//, "")
  clean = clean.split("/")[0]
  clean = clean.split("?")[0]
  clean = clean.split(":")[0]
  return clean
}

// a wildcard entry only covers one label, so *.a.com covers b.a.com but not c.b.a.com
function coversHost(names: string[] | undefined, host: string): boolean {
  if (!names) return false
  return names.some((raw) => {
    const name = raw.trim().toLowerCase()
    if (name === host) return true
    if (name.startsWith("*.")) {
      const suffix = name.slice(1)
      if (!host.endsWith(suffix)) return false
      return !host.slice(0, host.length - suffix.length).includes(".")
    }
    return false
  })
}

function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return null
  return Math.floor((ts - Date.now()) / 86400000)
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "unknown"
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return iso
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function SSLChecker() {
  const [hostname, setHostname] = useState("")
  const [status, setStatus] = useState<CheckStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [checkedHost, setCheckedHost] = useState("")
  const [trust, setTrust] = useState<TrustProbe | null>(null)
  const [issuances, setIssuances] = useState<CtIssuance[]>([])

  // a no-cors fetch is opaque, but the browser still refuses to complete it when
  // the certificate chain is not trusted. that is the only real tls signal a page
  // can get, and it cannot be told apart from dns/network failure.
  const probeBrowserTrust = async (host: string): Promise<TrustProbe> => {
    const start = Date.now()
    try {
      await fetch(`https://${host}/`, { mode: "no-cors", cache: "no-store" })
      return { ok: true, ms: Date.now() - start }
    } catch {
      return { ok: false, ms: Date.now() - start }
    }
  }

  const fetchIssuances = async (host: string): Promise<CtIssuance[]> => {
    const params = new URLSearchParams({ domain: host, include_subdomains: "false" })
    for (const field of ["dns_names", "issuer", "cert_sha256", "not_before", "not_after"]) {
      params.append("expand", field)
    }
    const res = await fetch(`${CERTSPOTTER_ENDPOINT}?${params.toString()}`)
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const body = await res.json()
        if (body?.message) detail = String(body.message)
      } catch {
        // non-json error body, keep the status
      }
      throw new Error(`Certificate transparency lookup failed: ${detail}`)
    }
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error("Certificate transparency lookup returned no list")
    return (data as CtIssuance[]).sort(
      (a, b) => Date.parse(b.not_after ?? "") - Date.parse(a.not_after ?? "")
    )
  }

  const runCheck = useCallback(async () => {
    const host = cleanHostname(hostname)
    if (!host) {
      setError("Enter a hostname, for example example.com")
      setStatus("error")
      toast.error("Enter a hostname first")
      return
    }

    setStatus("checking")
    setError(null)
    setTrust(null)
    setIssuances([])
    setCheckedHost(host)

    const probe = await probeBrowserTrust(host)
    setTrust(probe)

    try {
      setIssuances(await fetchIssuances(host))
      setStatus("complete")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Certificate lookup failed"
      setError(message)
      setStatus("error")
      toast.error(message)
    }
  }, [hostname])

  const matching = issuances.filter((cert) => coversHost(cert.dns_names, checkedHost))
  const newest = matching[0]
  const newestDays = daysUntil(newest?.not_after)

  const opensslCommand = `openssl s_client -connect ${checkedHost || "example.com"}:443 -servername ${checkedHost || "example.com"} </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -fingerprint -sha256`
  const opensslProtocolCommand = `for v in tls1 tls1_1 tls1_2 tls1_3; do echo -n "$v: "; openssl s_client -connect ${checkedHost || "example.com"}:443 -servername ${checkedHost || "example.com"} -$v </dev/null >/dev/null 2>&1 && echo supported || echo "not supported"; done`

  const exportIssuances = () => {
    if (!issuances.length) return
    downloadTextFile(
      JSON.stringify(
        { host: checkedHost, source: "certificate transparency (api.certspotter.com)", issuances },
        null,
        2
      ),
      `ct-issuances-${checkedHost}-${dateStamp()}.json`,
      "application/json"
    )
  }

  const commonSites = ["google.com", "github.com", "cloudflare.com", "expired.badssl.com"]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shield}
        title="SSL/TLS Checker"
        description="Certificate transparency lookup, browser trust probe, and local inspection commands"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>What a browser can and cannot see</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            Web pages have no access to TLS internals - there is no JavaScript API for the
            negotiated protocol version, cipher suite, or the certificate the server actually
            presented. This tool therefore reports two things it can prove, and gives you commands
            for the rest.
          </p>
          <p>
            It does <strong>not</strong> produce an SSL Labs grade. The SSL Labs API answers HTTP
            403 to any request that carries an <code className="font-mono text-xs">Origin</code>{" "}
            header, so it is unreachable from a browser, and its scans are published on a public
            results page. Nothing you type here is submitted to it.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Check a hostname
          </CardTitle>
          <CardDescription>
            Runs a browser trust probe and looks the domain up in public certificate transparency
            logs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="ssl-hostname" className="sr-only">
                Hostname
              </Label>
              <Input
                id="ssl-hostname"
                placeholder="example.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runCheck()}
                className="font-mono"
              />
            </div>
            <Button onClick={runCheck} disabled={status === "checking"}>
              {status === "checking" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Check
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {commonSites.map((site) => (
              <Button key={site} variant="outline" size="sm" onClick={() => setHostname(site)}>
                {site}
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

      {trust && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {trust.ok ? (
                <ShieldCheck className="h-5 w-5 text-green-500" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-yellow-500" />
              )}
              Browser trust probe
            </CardTitle>
            <CardDescription>
              Result of one opaque <code className="font-mono text-xs">no-cors</code> request from
              this browser to {checkedHost}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={trust.ok ? "default" : "secondary"}>
                {trust.ok ? "Handshake completed" : "Request did not complete"}
              </Badge>
              <Badge variant="outline">{trust.ms}ms round trip</Badge>
            </div>
            {trust.ok ? (
              <p className="text-muted-foreground">
                Your browser completed a TLS handshake with{" "}
                <span className="font-mono">{checkedHost}</span> over HTTPS and accepted its
                certificate chain against this machine&apos;s trust store. The response itself is
                opaque, so no status code or headers can be read from it.
              </p>
            ) : (
              <p className="text-muted-foreground">
                The request failed. That is consistent with an expired, mismatched, or untrusted
                certificate - but it is equally consistent with DNS failure, a blocked port, a
                content blocker, or the host simply refusing the connection. An opaque response
                cannot tell these apart, so this is not proof of a certificate problem. Use the
                OpenSSL command below to find out which it is.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {status === "complete" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" />
                Certificate transparency log entries
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{matching.length} covering this host</Badge>
                {issuances.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportIssuances}>
                    Export JSON
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              From{" "}
              <a
                href="https://sslmate.com/ct_search_api/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                SSLMate Cert Spotter <ExternalLink className="inline h-3 w-3" />
              </a>{" "}
              - public CT log data, fetched directly by your browser
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                These are certificates that certificate authorities <strong>issued</strong> for this
                domain and logged publicly. They are not necessarily the certificate the server is
                serving right now - a host can hold several valid certificates, or serve an older
                one. Treat the dates below as &quot;the newest certificate issued for this
                name&quot; rather than &quot;the live certificate&quot;.
              </AlertDescription>
            </Alert>

            {newest && newestDays !== null && (
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">
                  Newest logged certificate covering{" "}
                  <span className="font-mono">{checkedHost}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      newestDays < 0 ? "destructive" : newestDays < 30 ? "secondary" : "default"
                    }
                  >
                    {newestDays < 0
                      ? `expired ${Math.abs(newestDays)} days ago`
                      : `${newestDays} days until it expires`}
                  </Badge>
                  <Badge variant="outline">issued {formatDate(newest.not_before)}</Badge>
                  <Badge variant="outline">
                    {newest.issuer?.friendly_name || newest.issuer?.name || "unknown issuer"}
                  </Badge>
                </div>
              </div>
            )}

            {matching.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No CT log entry covers <span className="font-mono">{checkedHost}</span> exactly.
                {issuances.length > 0
                  ? " Entries for the domain exist but list other names - they are shown below."
                  : " The domain may be new, may use a private CA, or may not be in the logs this API indexes."}
              </p>
            )}

            <div className="space-y-3">
              {issuances.map((cert) => {
                const days = daysUntil(cert.not_after)
                const covers = coversHost(cert.dns_names, checkedHost)
                return (
                  <div key={cert.id} className="rounded-lg border p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {covers ? (
                        <Badge variant="default">covers {checkedHost}</Badge>
                      ) : (
                        <Badge variant="outline">other names</Badge>
                      )}
                      {cert.revoked && <Badge variant="destructive">revoked</Badge>}
                      {days !== null && (
                        <Badge variant={days < 0 ? "destructive" : "secondary"}>
                          {days < 0 ? "expired" : `${days}d left`}
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Issuer</p>
                        <p className="break-words">
                          {cert.issuer?.friendly_name || cert.issuer?.name || "unknown"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Validity</p>
                        <p>
                          {formatDate(cert.not_before)} to {formatDate(cert.not_after)}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">SHA-256 fingerprint</p>
                        <div className="flex items-center gap-1">
                          <p className="truncate font-mono text-xs">{cert.cert_sha256 || "n/a"}</p>
                          {cert.cert_sha256 && (
                            <CopyButton value={cert.cert_sha256} className="h-6 w-6 p-0" />
                          )}
                        </div>
                      </div>
                    </div>
                    {cert.dns_names && cert.dns_names.length > 0 && (
                      <div className="mt-3">
                        <p className="text-muted-foreground mb-2 text-sm">
                          Names ({cert.dns_names.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {cert.dns_names.slice(0, 12).map((name) => (
                            <Badge key={name} variant="outline" className="font-mono text-xs">
                              {name}
                            </Badge>
                          ))}
                          {cert.dns_names.length > 12 && (
                            <Badge variant="outline" className="text-xs">
                              +{cert.dns_names.length - 12} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Inspect the live certificate locally
          </CardTitle>
          <CardDescription>
            These read the certificate the server actually presents, which no web page can do
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Live certificate, issuer, dates and fingerprint</p>
            <div className="flex items-start gap-2">
              <pre className="bg-muted/50 flex-1 overflow-x-auto rounded p-3 font-mono text-xs">
                {opensslCommand}
              </pre>
              <CopyButton value={opensslCommand} variant="outline" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Which TLS versions the host accepts</p>
            <div className="flex items-start gap-2">
              <pre className="bg-muted/50 flex-1 overflow-x-auto rounded p-3 font-mono text-xs">
                {opensslProtocolCommand}
              </pre>
              <CopyButton value={opensslProtocolCommand} variant="outline" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            For a full graded audit including cipher suites and chain issues, run{" "}
            <a
              href="https://www.ssllabs.com/ssltest/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Qualys SSL Labs <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            yourself. Be aware that SSL Labs lists scan results publicly unless you tick &quot;do
            not show the results on the boards&quot;, which is why this tool never submits your
            hostname there.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reading the results</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
            <p>
              <span className="text-foreground font-medium">Trustworthy here:</span> the browser
              trust probe (your own browser made the connection) and the CT log entries (fetched
              straight from SSLMate, no relay in between).
            </p>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <p>
              <span className="text-foreground font-medium">Not available here:</span> negotiated
              TLS version, cipher suites, chain order and completeness, OCSP/CRL status, HSTS
              preload state, and any letter grade. All of it needs a socket-level TLS client.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
