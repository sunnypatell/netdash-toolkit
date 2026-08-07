"use client"

import { Suspense, lazy, useCallback, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Download, ExternalLink, Loader2, Mail, Server } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { dateStamp, downloadTextFile } from "@/lib/download"
import {
  COMMON_DKIM_SELECTORS,
  cleanDomain,
  looksLikeDomain,
  runEmailDiagnostics,
  type EmailDiagnosticResult,
} from "@/lib/email-auth"
// result panels only exist after a successful run, so they load on demand
const ScoreCard = lazy(() => import("./score-card").then((m) => ({ default: m.ScoreCard })))
const MXPanel = lazy(() => import("./mx").then((m) => ({ default: m.MXPanel })))
const SPFPanel = lazy(() => import("./spf").then((m) => ({ default: m.SPFPanel })))
const DKIMPanel = lazy(() => import("./dkim").then((m) => ({ default: m.DKIMPanel })))
const DMARCPanel = lazy(() => import("./dmarc").then((m) => ({ default: m.DMARCPanel })))

type DiagnosticStatus = "idle" | "loading" | "success" | "error"

const TAB_CLASS =
  "border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"

const EXAMPLE_DOMAINS = ["gmail.com", "microsoft.com", "proton.me", "fastmail.com"]

const PanelFallback = () => (
  <p role="status" className="text-muted-foreground text-sm" data-panel-fallback>
    Loading panel...
  </p>
)

export function EmailDiagnostics() {
  const [domain, setDomain] = useState("")
  const [customSelector, setCustomSelector] = useState("")
  const [status, setStatus] = useState<DiagnosticStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  // the same banner carries both field validation and a lookup failure; only the
  // first should mark the field invalid
  const [domainInvalid, setDomainInvalid] = useState(false)
  const [result, setResult] = useState<EmailDiagnosticResult | null>(null)
  const [progress, setProgress] = useState("")

  const exportResults = () => {
    if (!result) return
    downloadTextFile(
      JSON.stringify(result, null, 2),
      `email-diagnostics-${result.domain}-${dateStamp()}.json`,
      "application/json"
    )
  }

  const performDiagnostics = useCallback(async () => {
    const cleanedDomain = cleanDomain(domain)
    if (!cleanedDomain) {
      setDomainInvalid(true)
      setError("Enter a domain name")
      return
    }
    if (!looksLikeDomain(cleanedDomain)) {
      setDomainInvalid(true)
      setError(`"${cleanedDomain}" is not a valid domain name`)
      return
    }

    setStatus("loading")
    setDomainInvalid(false)
    setError(null)
    setResult(null)

    try {
      const selectors = customSelector
        ? [customSelector.trim(), ...COMMON_DKIM_SELECTORS]
        : COMMON_DKIM_SELECTORS

      setResult(await runEmailDiagnostics(cleanedDomain, { selectors, onProgress: setProgress }))
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostics failed")
      setStatus("error")
    } finally {
      setProgress("")
    }
  }, [domain, customSelector])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Mail}
        title="Email Diagnostics"
        description="Check MX records, SPF, DKIM, and DMARC configuration for any domain"
        actions={
          result &&
          status === "success" && (
            <Button variant="outline" size="sm" onClick={exportResults}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" aria-hidden="true" />
            Domain Check
          </CardTitle>
          <CardDescription>
            Enter a domain name or email address to analyze email authentication. Records are read
            over DNS-over-HTTPS from Cloudflare, falling back to Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="example.com or user@example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && performDiagnostics()}
                aria-invalid={domainInvalid}
                aria-describedby={error ? "email-diagnostics-error" : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selector">Custom DKIM Selector (optional)</Label>
              <Input
                id="selector"
                placeholder="e.g., google, selector1"
                value={customSelector}
                onChange={(e) => setCustomSelector(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={performDiagnostics} disabled={status === "loading"}>
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {progress || "Analyzing..."}
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Run Diagnostics
                </>
              )}
            </Button>
            {EXAMPLE_DOMAINS.map((example) => (
              <Button key={example} variant="outline" size="sm" onClick={() => setDomain(example)}>
                {example}
              </Button>
            ))}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription id="email-diagnostics-error">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* the score is the headline, so it is what gets announced. the tab panels
          below stay outside, or every tab switch re-reads the whole result. */}
      <div role="status" aria-busy={status === "loading"} className="space-y-4">
        {status === "idle" && (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            The authentication score, MX records, SPF, DKIM and DMARC appear here. Nothing is looked
            up until you run the diagnostics.
          </p>
        )}
        {result && status === "success" && (
          <>
            {result.incomplete && (
              <Alert>
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  At least one DNS lookup failed, so a missing record here may just be an unanswered
                  query. The score is based on incomplete data.
                </AlertDescription>
              </Alert>
            )}

            <Suspense fallback={<PanelFallback />}>
              <ScoreCard result={result} />
            </Suspense>
          </>
        )}
      </div>

      {result && status === "success" && (
        <>
          <Tabs defaultValue="mx" className="space-y-4">
            <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-4 sm:gap-0 sm:p-1">
              <TabsTrigger value="mx" className={TAB_CLASS}>
                MX Records
              </TabsTrigger>
              <TabsTrigger value="spf" className={TAB_CLASS}>
                SPF
              </TabsTrigger>
              <TabsTrigger value="dkim" className={TAB_CLASS}>
                DKIM
              </TabsTrigger>
              <TabsTrigger value="dmarc" className={TAB_CLASS}>
                DMARC
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mx" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <MXPanel domain={result.domain} result={result.mx} />
              </Suspense>
            </TabsContent>

            <TabsContent value="spf" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <SPFPanel result={result.spf} />
              </Suspense>
            </TabsContent>

            <TabsContent value="dkim" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <DKIMPanel results={result.dkim} />
              </Suspense>
            </TabsContent>

            <TabsContent value="dmarc" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <DMARCPanel domain={result.domain} result={result.dmarc} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About Email Authentication</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <div className="space-y-2">
            <p className="text-foreground font-medium">What is checked:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>MX Records</strong> - Mail servers that receive email for the domain (RFC
                5321), including the null MX of RFC 7505
              </li>
              <li>
                <strong>SPF</strong> - Which servers may send for the domain, its qualifier, and the
                10 DNS-lookup limit of RFC 7208
              </li>
              <li>
                <strong>DKIM</strong> - Public keys published per selector (RFC 6376); only the
                selectors listed above are probed
              </li>
              <li>
                <strong>DMARC</strong> - Policy, subdomain policy, pct, alignment, and report
                addresses (RFC 7489)
              </li>
            </ul>
          </div>
          <p>
            Learn more about email authentication at{" "}
            <a
              href="https://dmarc.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              dmarc.org <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
