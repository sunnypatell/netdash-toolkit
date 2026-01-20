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
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Lock,
  Server,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Loader2,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { toast } from "sonner"

interface CertificateInfo {
  subject: string
  issuer: string
  validFrom: string
  validTo: string
  daysRemaining: number
  serialNumber: string
  signatureAlgorithm: string
  keySize: number
  fingerprint: string
  san: string[]
  isExpired: boolean
  isExpiringSoon: boolean
}

interface TLSInfo {
  protocols: { name: string; supported: boolean }[]
  cipherSuites: string[]
  preferredCipher: string
  supportsHSTS: boolean
  hstsMaxAge: number | null
}

interface SSLLabsResult {
  host: string
  port: number
  grade: string
  gradeTrustIgnored: string
  hasWarnings: boolean
  isExceptional: boolean
  status: string
  statusMessage: string
  endpoints: SSLLabsEndpoint[]
}

interface SSLLabsEndpoint {
  ipAddress: string
  serverName: string
  grade: string
  gradeTrustIgnored: string
  hasWarnings: boolean
  isExceptional: boolean
  progress: number
  duration: number
  delegation: number
  details?: SSLLabsDetails
}

interface SSLLabsDetails {
  certChains?: Array<{
    certs: Array<{
      subject: string
      issuerSubject: string
      notBefore: number
      notAfter: number
      sigAlg: string
      keySize: number
      sha256Hash: string
      altNames: string[]
    }>
  }>
  protocols?: Array<{
    id: number
    name: string
    version: string
  }>
  suites?: {
    list: Array<{
      name: string
      cipherStrength: number
    }>
  }
  hstsPolicy?: {
    status: string
    maxAge: number
  }
}

type CheckStatus = "idle" | "starting" | "analyzing" | "complete" | "error"

export function SSLChecker() {
  const [hostname, setHostname] = useState("")
  const [status, setStatus] = useState<CheckStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SSLLabsResult | null>(null)
  const [pollCount, setPollCount] = useState(0)

  // Quick check using native fetch (limited info)
  const [quickResult, setQuickResult] = useState<{
    reachable: boolean
    https: boolean
    responseTime: number
  } | null>(null)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  const cleanHostname = (input: string): string => {
    let clean = input.trim().toLowerCase()
    // Remove protocol if present
    clean = clean.replace(/^https?:\/\//, "")
    // Remove path if present
    clean = clean.split("/")[0]
    // Remove port if present
    clean = clean.split(":")[0]
    return clean
  }

  const performQuickCheck = async (host: string) => {
    const start = Date.now()
    try {
      const response = await fetch(`https://${host}`, {
        method: "HEAD",
        mode: "no-cors",
      })
      const responseTime = Date.now() - start
      setQuickResult({
        reachable: true,
        https: true,
        responseTime,
      })
    } catch {
      setQuickResult({
        reachable: false,
        https: false,
        responseTime: Date.now() - start,
      })
    }
  }

  const startSSLLabsCheck = useCallback(async () => {
    const host = cleanHostname(hostname)
    if (!host) {
      setError("Please enter a hostname")
      return
    }

    setStatus("starting")
    setError(null)
    setResult(null)
    setProgress(0)
    setPollCount(0)

    // Quick check first
    await performQuickCheck(host)

    try {
      // Start new assessment
      const startUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(host)}&startNew=on&all=done`
      const startResponse = await fetch(startUrl)

      if (!startResponse.ok) {
        throw new Error(`SSL Labs API error: ${startResponse.status}`)
      }

      const startData = await startResponse.json()

      if (startData.status === "ERROR") {
        throw new Error(startData.statusMessage || "SSL Labs analysis failed")
      }

      setStatus("analyzing")
      pollSSLLabs(host)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start SSL check")
      setStatus("error")
    }
  }, [hostname])

  const pollSSLLabs = async (host: string) => {
    const maxPolls = 60 // Max 5 minutes (5s interval)
    let currentPoll = 0

    const poll = async () => {
      currentPoll++
      setPollCount(currentPoll)

      if (currentPoll > maxPolls) {
        setError("Analysis timeout - please try again later")
        setStatus("error")
        return
      }

      try {
        const pollUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(host)}&all=done`
        const response = await fetch(pollUrl)

        if (!response.ok) {
          throw new Error(`Poll failed: ${response.status}`)
        }

        const data: SSLLabsResult = await response.json()

        // Update progress based on endpoint progress
        if (data.endpoints && data.endpoints.length > 0) {
          const avgProgress =
            data.endpoints.reduce((sum, ep) => sum + (ep.progress || 0), 0) / data.endpoints.length
          setProgress(avgProgress)
        }

        if (data.status === "READY") {
          setResult(data)
          setStatus("complete")
          setProgress(100)
        } else if (data.status === "ERROR") {
          throw new Error(data.statusMessage || "Analysis failed")
        } else {
          // Still analyzing, poll again
          setTimeout(poll, 5000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed")
        setStatus("error")
      }
    }

    poll()
  }

  const getGradeColor = (grade: string): string => {
    if (grade.startsWith("A")) return "text-green-500"
    if (grade.startsWith("B")) return "text-lime-500"
    if (grade.startsWith("C")) return "text-yellow-500"
    if (grade.startsWith("D")) return "text-orange-500"
    if (grade.startsWith("F")) return "text-red-500"
    return "text-muted-foreground"
  }

  const getGradeBadgeVariant = (
    grade: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (grade.startsWith("A")) return "default"
    if (grade.startsWith("B") || grade.startsWith("C")) return "secondary"
    if (grade.startsWith("D") || grade.startsWith("F")) return "destructive"
    return "outline"
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getDaysRemaining = (timestamp: number): number => {
    const now = Date.now()
    const diff = timestamp - now
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  const commonSites = [
    "google.com",
    "github.com",
    "cloudflare.com",
    "amazon.com",
    "microsoft.com",
    "apple.com",
  ]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shield}
        title="SSL/TLS Checker"
        description="Analyze SSL certificates, TLS configuration, and security grades"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Check SSL Certificate
          </CardTitle>
          <CardDescription>
            Enter a hostname to analyze its SSL/TLS configuration using SSL Labs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="hostname" className="sr-only">
                Hostname
              </Label>
              <Input
                id="hostname"
                placeholder="example.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startSSLLabsCheck()}
              />
            </div>
            <Button
              onClick={startSSLLabsCheck}
              disabled={status === "starting" || status === "analyzing"}
            >
              {status === "starting" || status === "analyzing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Check SSL
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

          {(status === "starting" || status === "analyzing") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Analysis in progress...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                This may take 1-3 minutes. Poll count: {pollCount}
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {quickResult && status !== "idle" && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Check Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {quickResult.reachable ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>{quickResult.reachable ? "Reachable" : "Unreachable"}</span>
              </div>
              <div className="flex items-center gap-2">
                {quickResult.https ? (
                  <Lock className="h-5 w-5 text-green-500" />
                ) : (
                  <ShieldX className="h-5 w-5 text-red-500" />
                )}
                <span>{quickResult.https ? "HTTPS OK" : "HTTPS Failed"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="text-muted-foreground h-5 w-5" />
                <span>{quickResult.responseTime}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && status === "complete" && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
            <TabsTrigger
              value="overview"
              className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="certificate"
              className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
            >
              Certificate
            </TabsTrigger>
            <TabsTrigger
              value="protocols"
              className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
            >
              Protocols
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {result.grade?.startsWith("A") ? (
                      <ShieldCheck className="h-6 w-6 text-green-500" />
                    ) : result.grade?.startsWith("F") ? (
                      <ShieldX className="h-6 w-6 text-red-500" />
                    ) : (
                      <ShieldAlert className="h-6 w-6 text-yellow-500" />
                    )}
                    SSL Grade
                  </span>
                  <span className={`text-4xl font-bold ${getGradeColor(result.grade || "?")}`}>
                    {result.grade || "?"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Host</p>
                    <p className="font-medium">{result.host}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Port</p>
                    <p className="font-medium">{result.port}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Status</p>
                    <Badge variant={result.status === "READY" ? "default" : "secondary"}>
                      {result.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Endpoints</p>
                    <p className="font-medium">{result.endpoints?.length || 0}</p>
                  </div>
                </div>

                {result.hasWarnings && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This site has security warnings. Review the details below.
                    </AlertDescription>
                  </Alert>
                )}

                {result.isExceptional && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      This site has exceptional security configuration.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {result.endpoints && result.endpoints.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Endpoints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.endpoints.map((endpoint, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{endpoint.ipAddress}</p>
                          {endpoint.serverName && (
                            <p className="text-muted-foreground text-sm">{endpoint.serverName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getGradeBadgeVariant(endpoint.grade || "?")}>
                            Grade: {endpoint.grade || "?"}
                          </Badge>
                          {endpoint.hasWarnings && (
                            <Badge variant="outline">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Warnings
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="certificate" className="space-y-4">
            {result.endpoints?.[0]?.details?.certChains?.[0]?.certs && (
              <Card>
                <CardHeader>
                  <CardTitle>Certificate Chain</CardTitle>
                  <CardDescription>Certificates in the chain from leaf to root</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {result.endpoints[0].details.certChains[0].certs.map((cert, index) => {
                    const daysRemaining = getDaysRemaining(cert.notAfter)
                    const isExpired = daysRemaining < 0
                    const isExpiringSoon = daysRemaining >= 0 && daysRemaining < 30

                    return (
                      <div key={index} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div>
                            <Badge variant="outline" className="mb-2">
                              {index === 0
                                ? "Leaf Certificate"
                                : index ===
                                    result.endpoints![0].details!.certChains![0].certs.length - 1
                                  ? "Root CA"
                                  : "Intermediate CA"}
                            </Badge>
                            <h4 className="font-medium">{cert.subject}</h4>
                          </div>
                          {index === 0 && (
                            <Badge
                              variant={
                                isExpired ? "destructive" : isExpiringSoon ? "secondary" : "default"
                              }
                            >
                              {isExpired
                                ? "Expired"
                                : isExpiringSoon
                                  ? `${daysRemaining} days left`
                                  : `${daysRemaining} days remaining`}
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-muted-foreground">Issuer</p>
                            <p className="truncate">{cert.issuerSubject}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Algorithm</p>
                            <p>{cert.sigAlg}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valid From</p>
                            <p>{formatDate(cert.notBefore)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valid Until</p>
                            <p>{formatDate(cert.notAfter)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Key Size</p>
                            <p>{cert.keySize} bits</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Fingerprint (SHA-256)</p>
                            <div className="flex items-center gap-1">
                              <p className="truncate font-mono text-xs">{cert.sha256Hash}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(cert.sha256Hash)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {cert.altNames && cert.altNames.length > 0 && index === 0 && (
                          <div className="mt-3">
                            <p className="text-muted-foreground mb-2 text-sm">
                              Subject Alternative Names ({cert.altNames.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {cert.altNames.slice(0, 10).map((name, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                              {cert.altNames.length > 10 && (
                                <Badge variant="outline" className="text-xs">
                                  +{cert.altNames.length - 10} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="protocols" className="space-y-4">
            {result.endpoints?.[0]?.details?.protocols && (
              <Card>
                <CardHeader>
                  <CardTitle>Supported Protocols</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.endpoints[0].details.protocols.map((protocol, index) => {
                      const isInsecure =
                        protocol.name === "SSL" ||
                        protocol.version === "1.0" ||
                        protocol.version === "1.1"
                      return (
                        <Badge key={index} variant={isInsecure ? "destructive" : "default"}>
                          {protocol.name} {protocol.version}
                          {isInsecure && " (Insecure)"}
                        </Badge>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.endpoints?.[0]?.details?.suites?.list && (
              <Card>
                <CardHeader>
                  <CardTitle>Cipher Suites</CardTitle>
                  <CardDescription>
                    {result.endpoints[0].details.suites.list.length} cipher suites supported
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {result.endpoints[0].details.suites.list.map((suite, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border p-2 text-sm"
                      >
                        <span className="truncate font-mono text-xs">{suite.name}</span>
                        <Badge
                          variant={
                            suite.cipherStrength >= 256
                              ? "default"
                              : suite.cipherStrength >= 128
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {suite.cipherStrength} bits
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.endpoints?.[0]?.details?.hstsPolicy && (
              <Card>
                <CardHeader>
                  <CardTitle>HSTS Policy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {result.endpoints[0].details.hstsPolicy.status === "present" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span>
                        {result.endpoints[0].details.hstsPolicy.status === "present"
                          ? "HSTS Enabled"
                          : "HSTS Not Enabled"}
                      </span>
                    </div>
                    {result.endpoints[0].details.hstsPolicy.maxAge > 0 && (
                      <Badge variant="outline">
                        Max-Age: {Math.round(result.endpoints[0].details.hstsPolicy.maxAge / 86400)}{" "}
                        days
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About SSL/TLS Checking</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <p>
            This tool uses the{" "}
            <a
              href="https://www.ssllabs.com/ssltest/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              SSL Labs API <ExternalLink className="inline h-3 w-3" />
            </a>{" "}
            to perform comprehensive SSL/TLS analysis.
          </p>
          <div className="space-y-2">
            <p className="text-foreground font-medium">Grade Meanings:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <span className="font-medium text-green-500">A+</span> - Exceptional configuration
              </li>
              <li>
                <span className="font-medium text-green-500">A/A-</span> - Good configuration
              </li>
              <li>
                <span className="font-medium text-lime-500">B</span> - Minor issues
              </li>
              <li>
                <span className="font-medium text-yellow-500">C</span> - Configuration issues
              </li>
              <li>
                <span className="font-medium text-orange-500">D</span> - Significant weaknesses
              </li>
              <li>
                <span className="font-medium text-red-500">F</span> - Critical vulnerabilities
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
