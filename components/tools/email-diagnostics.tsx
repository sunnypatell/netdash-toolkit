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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Mail,
  Server,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Key,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  Info,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { toast } from "sonner"

interface DNSRecord {
  name: string
  type: number
  TTL: number
  data: string
}

interface MXRecord {
  priority: number
  exchange: string
  ttl: number
}

interface SPFResult {
  found: boolean
  record: string | null
  valid: boolean
  mechanisms: string[]
  includes: string[]
  all: string | null
  errors: string[]
  warnings: string[]
}

interface DKIMResult {
  found: boolean
  selector: string
  record: string | null
  valid: boolean
  keyType: string | null
  publicKey: string | null
  errors: string[]
}

interface DMARCResult {
  found: boolean
  record: string | null
  valid: boolean
  policy: string | null
  subdomainPolicy: string | null
  percentage: number
  rua: string[] // Aggregate reports
  ruf: string[] // Forensic reports
  errors: string[]
  warnings: string[]
}

interface DiagnosticResult {
  domain: string
  mx: MXRecord[]
  spf: SPFResult
  dkim: DKIMResult[]
  dmarc: DMARCResult
  overallScore: number
  timestamp: Date
}

type DiagnosticStatus = "idle" | "loading" | "success" | "error"

const COMMON_DKIM_SELECTORS = [
  "default",
  "google",
  "selector1",
  "selector2",
  "k1",
  "k2",
  "mail",
  "dkim",
  "s1",
  "s2",
  "email",
  "smtp",
  "mandrill",
  "mxvault",
  "everlytickey1",
  "everlytickey2",
  "zendesk1",
  "zendesk2",
]

export function EmailDiagnostics() {
  const [domain, setDomain] = useState("")
  const [customSelector, setCustomSelector] = useState("")
  const [status, setStatus] = useState<DiagnosticStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [progress, setProgress] = useState("")

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const cleanDomain = (input: string): string => {
    let clean = input.trim().toLowerCase()
    clean = clean.replace(/^https?:\/\//, "")
    clean = clean.replace(/^www\./, "")
    clean = clean.split("/")[0]
    clean = clean.split(":")[0]
    // Extract domain from email if provided
    if (clean.includes("@")) {
      clean = clean.split("@")[1]
    }
    return clean
  }

  const queryDNS = async (name: string, type: string): Promise<DNSRecord[]> => {
    try {
      const response = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
        {
          headers: {
            Accept: "application/dns-json",
          },
        }
      )

      if (!response.ok) {
        throw new Error(`DNS query failed: ${response.status}`)
      }

      const data = await response.json()
      return data.Answer || []
    } catch {
      return []
    }
  }

  const parseMXRecords = async (domainName: string): Promise<MXRecord[]> => {
    const records = await queryDNS(domainName, "MX")
    return records
      .map((record) => {
        const parts = record.data.split(" ")
        return {
          priority: parseInt(parts[0], 10),
          exchange: parts[1]?.replace(/\.$/, "") || "",
          ttl: record.TTL,
        }
      })
      .sort((a, b) => a.priority - b.priority)
  }

  const parseSPF = async (domainName: string): Promise<SPFResult> => {
    const records = await queryDNS(domainName, "TXT")
    const spfRecord = records.find((r) => r.data.toLowerCase().includes("v=spf1"))

    if (!spfRecord) {
      return {
        found: false,
        record: null,
        valid: false,
        mechanisms: [],
        includes: [],
        all: null,
        errors: ["No SPF record found"],
        warnings: [],
      }
    }

    // Clean up the record (remove quotes)
    const record = spfRecord.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "")
    const parts = record.split(/\s+/)
    const mechanisms: string[] = []
    const includes: string[] = []
    const errors: string[] = []
    const warnings: string[] = []
    let all: string | null = null

    for (const part of parts) {
      const lower = part.toLowerCase()

      if (lower.startsWith("include:")) {
        includes.push(part.substring(8))
        mechanisms.push(part)
      } else if (lower.startsWith("redirect=")) {
        mechanisms.push(part)
      } else if (lower === "+all") {
        all = "+all"
        errors.push("Using +all allows any server to send mail - highly insecure!")
      } else if (lower === "~all") {
        all = "~all"
        warnings.push("Using ~all (softfail) - consider using -all for stricter policy")
      } else if (lower === "-all") {
        all = "-all"
      } else if (lower === "?all") {
        all = "?all"
        warnings.push("Using ?all (neutral) provides no protection")
      } else if (lower.startsWith("ip4:") || lower.startsWith("ip6:")) {
        mechanisms.push(part)
      } else if (lower.startsWith("a") || lower.startsWith("mx") || lower.startsWith("ptr")) {
        mechanisms.push(part)
      } else if (lower !== "v=spf1") {
        mechanisms.push(part)
      }
    }

    // Check for common issues
    if (includes.length > 10) {
      warnings.push("High number of includes may cause DNS lookup limit issues")
    }

    if (record.length > 255) {
      warnings.push("SPF record exceeds 255 characters - may need to be split")
    }

    return {
      found: true,
      record,
      valid: errors.length === 0,
      mechanisms,
      includes,
      all,
      errors,
      warnings,
    }
  }

  const parseDKIM = async (domainName: string, selectors: string[]): Promise<DKIMResult[]> => {
    const results: DKIMResult[] = []

    for (const selector of selectors) {
      const dkimDomain = `${selector}._domainkey.${domainName}`
      const records = await queryDNS(dkimDomain, "TXT")

      if (records.length > 0) {
        const record = records[0].data.replace(/^"|"$/g, "").replace(/"\s*"/g, "")
        const errors: string[] = []
        let keyType: string | null = null
        let publicKey: string | null = null

        // Parse DKIM record
        const parts = record.split(";").map((p) => p.trim())
        for (const part of parts) {
          const [key, value] = part.split("=").map((s) => s.trim())
          if (key === "k") keyType = value
          if (key === "p") publicKey = value
        }

        if (!publicKey || publicKey === "") {
          errors.push("Empty public key - DKIM is revoked")
        }

        if (!record.includes("v=DKIM1")) {
          errors.push("Missing v=DKIM1 version tag")
        }

        results.push({
          found: true,
          selector,
          record,
          valid: errors.length === 0,
          keyType: keyType || "rsa",
          publicKey,
          errors,
        })
      }
    }

    return results
  }

  const parseDMARC = async (domainName: string): Promise<DMARCResult> => {
    const records = await queryDNS(`_dmarc.${domainName}`, "TXT")
    const dmarcRecord = records.find((r) => r.data.toLowerCase().includes("v=dmarc1"))

    if (!dmarcRecord) {
      return {
        found: false,
        record: null,
        valid: false,
        policy: null,
        subdomainPolicy: null,
        percentage: 100,
        rua: [],
        ruf: [],
        errors: ["No DMARC record found"],
        warnings: [],
      }
    }

    const record = dmarcRecord.data.replace(/^"|"$/g, "").replace(/"\s*"/g, "")
    const parts = record.split(";").map((p) => p.trim())
    const errors: string[] = []
    const warnings: string[] = []
    let policy: string | null = null
    let subdomainPolicy: string | null = null
    let percentage = 100
    const rua: string[] = []
    const ruf: string[] = []

    for (const part of parts) {
      const [key, value] = part.split("=").map((s) => s?.trim())
      if (!key) continue

      switch (key.toLowerCase()) {
        case "p":
          policy = value
          if (value === "none") {
            warnings.push("Policy is 'none' - emails failing authentication are not rejected")
          }
          break
        case "sp":
          subdomainPolicy = value
          break
        case "pct":
          percentage = parseInt(value, 10) || 100
          if (percentage < 100) {
            warnings.push(`Only ${percentage}% of emails are subject to DMARC policy`)
          }
          break
        case "rua":
          rua.push(...value.split(",").map((v) => v.trim().replace("mailto:", "")))
          break
        case "ruf":
          ruf.push(...value.split(",").map((v) => v.trim().replace("mailto:", "")))
          break
      }
    }

    if (!policy) {
      errors.push("Missing required 'p' (policy) tag")
    }

    if (rua.length === 0) {
      warnings.push("No aggregate report (rua) address configured")
    }

    return {
      found: true,
      record,
      valid: errors.length === 0,
      policy,
      subdomainPolicy,
      percentage,
      rua,
      ruf,
      errors,
      warnings,
    }
  }

  const calculateScore = (result: Omit<DiagnosticResult, "overallScore">): number => {
    let score = 0
    const maxScore = 100

    // MX Records (20 points)
    if (result.mx.length > 0) score += 20

    // SPF (30 points)
    if (result.spf.found) {
      score += 10
      if (result.spf.valid) score += 10
      if (result.spf.all === "-all") score += 10
      else if (result.spf.all === "~all") score += 5
    }

    // DKIM (30 points)
    if (result.dkim.length > 0) {
      score += 15
      if (result.dkim.some((d) => d.valid)) score += 15
    }

    // DMARC (20 points)
    if (result.dmarc.found) {
      score += 5
      if (result.dmarc.valid) score += 5
      if (result.dmarc.policy === "reject") score += 10
      else if (result.dmarc.policy === "quarantine") score += 7
      else if (result.dmarc.policy === "none") score += 3
    }

    return Math.min(score, maxScore)
  }

  const performDiagnostics = useCallback(async () => {
    const cleanedDomain = cleanDomain(domain)
    if (!cleanedDomain) {
      setError("Please enter a domain name")
      return
    }

    setStatus("loading")
    setError(null)
    setResult(null)

    try {
      // Check MX records
      setProgress("Checking MX records...")
      const mx = await parseMXRecords(cleanedDomain)

      // Check SPF
      setProgress("Checking SPF record...")
      const spf = await parseSPF(cleanedDomain)

      // Check DKIM with common selectors
      setProgress("Checking DKIM records...")
      const selectorsToCheck = customSelector
        ? [customSelector, ...COMMON_DKIM_SELECTORS]
        : COMMON_DKIM_SELECTORS
      const dkim = await parseDKIM(cleanedDomain, selectorsToCheck)

      // Check DMARC
      setProgress("Checking DMARC record...")
      const dmarc = await parseDMARC(cleanedDomain)

      const partialResult = {
        domain: cleanedDomain,
        mx,
        spf,
        dkim,
        dmarc,
        timestamp: new Date(),
      }

      const overallScore = calculateScore(partialResult)

      setResult({
        ...partialResult,
        overallScore,
      })
      setStatus("success")
      setProgress("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostics failed")
      setStatus("error")
      setProgress("")
    }
  }, [domain, customSelector])

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-500"
    if (score >= 60) return "text-lime-500"
    if (score >= 40) return "text-yellow-500"
    if (score >= 20) return "text-orange-500"
    return "text-red-500"
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return "Excellent"
    if (score >= 60) return "Good"
    if (score >= 40) return "Fair"
    if (score >= 20) return "Poor"
    return "Critical"
  }

  const exampleDomains = ["gmail.com", "microsoft.com", "proton.me", "fastmail.com"]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Mail}
        title="Email Diagnostics"
        description="Check MX records, SPF, DKIM, and DMARC configuration for any domain"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Domain Check
          </CardTitle>
          <CardDescription>
            Enter a domain name or email address to analyze email authentication
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {progress || "Analyzing..."}
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Run Diagnostics
                </>
              )}
            </Button>
            {exampleDomains.map((d) => (
              <Button key={d} variant="outline" size="sm" onClick={() => setDomain(d)}>
                {d}
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

      {result && status === "success" && (
        <>
          {/* Score Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Email Security Score</span>
                <div className="text-right">
                  <span className={`text-4xl font-bold ${getScoreColor(result.overallScore)}`}>
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
                  {getScoreLabel(result.overallScore)}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center">
                    {result.mx.length > 0 ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium">MX</p>
                  <p className="text-muted-foreground text-xs">
                    {result.mx.length > 0 ? `${result.mx.length} records` : "Missing"}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center">
                    {result.spf.found ? (
                      result.spf.valid ? (
                        <ShieldCheck className="h-6 w-6 text-green-500" />
                      ) : (
                        <ShieldAlert className="h-6 w-6 text-yellow-500" />
                      )
                    ) : (
                      <ShieldX className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium">SPF</p>
                  <p className="text-muted-foreground text-xs">
                    {result.spf.found ? (result.spf.valid ? "Valid" : "Issues") : "Missing"}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center">
                    {result.dkim.length > 0 ? (
                      result.dkim.some((d) => d.valid) ? (
                        <Key className="h-6 w-6 text-green-500" />
                      ) : (
                        <Key className="h-6 w-6 text-yellow-500" />
                      )
                    ) : (
                      <Key className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium">DKIM</p>
                  <p className="text-muted-foreground text-xs">
                    {result.dkim.length > 0 ? `${result.dkim.length} found` : "Not found"}
                  </p>
                </div>
                <div className="space-y-1 text-center">
                  <div className="flex items-center justify-center">
                    {result.dmarc.found ? (
                      result.dmarc.valid ? (
                        <Shield className="h-6 w-6 text-green-500" />
                      ) : (
                        <Shield className="h-6 w-6 text-yellow-500" />
                      )
                    ) : (
                      <Shield className="h-6 w-6 text-red-500" />
                    )}
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

          <Tabs defaultValue="mx" className="space-y-4">
            <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-4 sm:gap-0 sm:p-1">
              <TabsTrigger
                value="mx"
                className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
              >
                MX Records
              </TabsTrigger>
              <TabsTrigger
                value="spf"
                className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
              >
                SPF
              </TabsTrigger>
              <TabsTrigger
                value="dkim"
                className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
              >
                DKIM
              </TabsTrigger>
              <TabsTrigger
                value="dmarc"
                className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
              >
                DMARC
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mx" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    MX Records
                  </CardTitle>
                  <CardDescription>Mail exchange servers for {result.domain}</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.mx.length > 0 ? (
                    <div className="space-y-2">
                      {result.mx.map((mx, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono">
                              {mx.priority}
                            </Badge>
                            <span className="font-medium">{mx.exchange}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">TTL: {mx.ttl}s</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(mx.exchange)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        No MX records found. This domain cannot receive email.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="spf" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    SPF Record
                  </CardTitle>
                  <CardDescription>Sender Policy Framework configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.spf.found ? (
                    <>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <code className="text-sm break-all">{result.spf.record}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 shrink-0 p-0"
                            onClick={() => copyToClipboard(result.spf.record || "")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Mechanisms</p>
                          <div className="flex flex-wrap gap-1">
                            {result.spf.mechanisms.map((m, i) => (
                              <Badge key={i} variant="outline" className="font-mono text-xs">
                                {m}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">All Mechanism</p>
                          <Badge
                            variant={
                              result.spf.all === "-all"
                                ? "default"
                                : result.spf.all === "~all"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {result.spf.all || "Not specified"}
                          </Badge>
                        </div>
                      </div>

                      {result.spf.includes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Includes</p>
                          <div className="flex flex-wrap gap-1">
                            {result.spf.includes.map((inc, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {inc}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.spf.errors.length > 0 && (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            <ul className="list-inside list-disc">
                              {result.spf.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.spf.warnings.length > 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <ul className="list-inside list-disc">
                              {result.spf.warnings.map((warn, i) => (
                                <li key={i}>{warn}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        No SPF record found. Add a TXT record with "v=spf1" to specify authorized
                        mail servers.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dkim" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    DKIM Records
                  </CardTitle>
                  <CardDescription>DomainKeys Identified Mail signatures</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.dkim.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                      {result.dkim.map((dkim, index) => (
                        <AccordionItem key={index} value={`dkim-${index}`}>
                          <AccordionTrigger>
                            <div className="flex items-center gap-2">
                              {dkim.valid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                              )}
                              <span>Selector: {dkim.selector}</span>
                              <Badge variant="outline" className="text-xs">
                                {dkim.keyType || "rsa"}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <div className="bg-muted rounded-lg p-3">
                              <code className="text-xs break-all">{dkim.record}</code>
                            </div>
                            {dkim.errors.length > 0 && (
                              <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>
                                  <ul className="list-inside list-disc">
                                    {dkim.errors.map((err, i) => (
                                      <li key={i}>{err}</li>
                                    ))}
                                  </ul>
                                </AlertDescription>
                              </Alert>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No DKIM records found with common selectors. Try specifying a custom
                        selector if you know one.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dmarc" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    DMARC Record
                  </CardTitle>
                  <CardDescription>
                    Domain-based Message Authentication, Reporting & Conformance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.dmarc.found ? (
                    <>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <code className="text-sm break-all">{result.dmarc.record}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 shrink-0 p-0"
                            onClick={() => copyToClipboard(result.dmarc.record || "")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">Policy</p>
                          <Badge
                            variant={
                              result.dmarc.policy === "reject"
                                ? "default"
                                : result.dmarc.policy === "quarantine"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {result.dmarc.policy || "Not set"}
                          </Badge>
                        </div>
                        {result.dmarc.subdomainPolicy && (
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-sm">Subdomain Policy</p>
                            <Badge variant="outline">{result.dmarc.subdomainPolicy}</Badge>
                          </div>
                        )}
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm">Percentage</p>
                          <Badge variant="outline">{result.dmarc.percentage}%</Badge>
                        </div>
                      </div>

                      {result.dmarc.rua.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Aggregate Reports (rua)</p>
                          <div className="flex flex-wrap gap-1">
                            {result.dmarc.rua.map((addr, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {addr}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.dmarc.ruf.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Forensic Reports (ruf)</p>
                          <div className="flex flex-wrap gap-1">
                            {result.dmarc.ruf.map((addr, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {addr}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.dmarc.errors.length > 0 && (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            <ul className="list-inside list-disc">
                              {result.dmarc.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.dmarc.warnings.length > 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <ul className="list-inside list-disc">
                              {result.dmarc.warnings.map((warn, i) => (
                                <li key={i}>{warn}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        No DMARC record found. Add a TXT record at _dmarc.{result.domain} to
                        configure email authentication policy.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
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
                <strong>MX Records</strong> - Mail servers that receive email for the domain
              </li>
              <li>
                <strong>SPF</strong> - Specifies which servers can send email on behalf of the
                domain
              </li>
              <li>
                <strong>DKIM</strong> - Cryptographic signatures to verify email authenticity
              </li>
              <li>
                <strong>DMARC</strong> - Policy for handling emails that fail SPF/DKIM checks
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
              dmarc.org <ExternalLink className="inline h-3 w-3" />
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
