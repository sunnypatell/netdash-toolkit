"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  ExternalLink,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

interface SecurityHeader {
  name: string
  present: boolean
  value?: string
  grade: "good" | "warning" | "bad" | "info"
  description: string
  recommendation?: string
  learnMore?: string
}

interface AnalysisResult {
  url: string
  score: number
  grade: string
  headers: SecurityHeader[]
  usedProxy: boolean
}

const SECURITY_HEADER_SPECS: Array<{
  name: string
  key: string
  description: string
  recommendation: string
  learnMore: string
  weight: number
}> = [
  {
    name: "Strict-Transport-Security",
    key: "strict-transport-security",
    description: "Enforces HTTPS connections and prevents protocol downgrade attacks",
    recommendation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    learnMore:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    weight: 20,
  },
  {
    name: "Content-Security-Policy",
    key: "content-security-policy",
    description: "Controls which resources can be loaded, preventing XSS and data injection",
    recommendation: "Configure CSP based on your app's needs. Start with: default-src 'self'",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    weight: 25,
  },
  {
    name: "X-Frame-Options",
    key: "x-frame-options",
    description: "Prevents clickjacking by controlling iframe embedding",
    recommendation: "Add: X-Frame-Options: DENY or SAMEORIGIN",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    weight: 15,
  },
  {
    name: "X-Content-Type-Options",
    key: "x-content-type-options",
    description: "Prevents MIME type sniffing attacks",
    recommendation: "Add: X-Content-Type-Options: nosniff",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
    weight: 10,
  },
  {
    name: "Referrer-Policy",
    key: "referrer-policy",
    description: "Controls how much referrer information is sent with requests",
    recommendation: "Add: Referrer-Policy: strict-origin-when-cross-origin",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
    weight: 10,
  },
  {
    name: "Permissions-Policy",
    key: "permissions-policy",
    description: "Controls which browser features can be used (formerly Feature-Policy)",
    recommendation: "Add: Permissions-Policy: geolocation=(), camera=(), microphone=()",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy",
    weight: 10,
  },
  {
    name: "X-XSS-Protection",
    key: "x-xss-protection",
    description: "Legacy XSS filter (deprecated but still useful for older browsers)",
    recommendation: "Add: X-XSS-Protection: 1; mode=block (or use CSP instead)",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection",
    weight: 5,
  },
  {
    name: "Cross-Origin-Opener-Policy",
    key: "cross-origin-opener-policy",
    description: "Isolates your origin from other origins in the browser",
    recommendation: "Add: Cross-Origin-Opener-Policy: same-origin",
    learnMore:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
    weight: 5,
  },
]

export function SecurityHeaders() {
  const [url, setUrl] = useState("https://example.com")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyzeHeaders = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let targetUrl = url.trim()
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl
      }

      // Try direct fetch first (works in Electron or for CORS-enabled sites)
      let response: Response | null = null
      let usedProxy = false

      try {
        response = await fetch(targetUrl, {
          method: "HEAD",
          mode: "cors",
        })
      } catch {
        // If direct fetch fails, try with a CORS proxy
        usedProxy = true
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
        response = await fetch(proxyUrl)
      }

      const headersMap = new Map<string, string>()
      response.headers.forEach((value, name) => {
        headersMap.set(name.toLowerCase(), value)
      })

      const headers: SecurityHeader[] = SECURITY_HEADER_SPECS.map((spec) => {
        const value = headersMap.get(spec.key)
        return {
          name: spec.name,
          present: !!value,
          value,
          grade: value ? "good" : "bad",
          description: spec.description,
          recommendation: value ? undefined : spec.recommendation,
          learnMore: spec.learnMore,
        }
      })

      // Calculate score
      let score = 0
      let maxScore = 0
      SECURITY_HEADER_SPECS.forEach((spec) => {
        maxScore += spec.weight
        if (headersMap.has(spec.key)) {
          score += spec.weight
        }
      })

      const percentage = usedProxy ? 0 : Math.round((score / maxScore) * 100)
      let grade = "F"
      if (!usedProxy) {
        if (percentage >= 90) grade = "A+"
        else if (percentage >= 80) grade = "A"
        else if (percentage >= 70) grade = "B"
        else if (percentage >= 60) grade = "C"
        else if (percentage >= 50) grade = "D"
      } else {
        grade = "?"
      }

      setResult({
        url: targetUrl,
        score: percentage,
        grade,
        headers,
        usedProxy,
      })
    } catch {
      setError("Unable to fetch headers. The site may be blocking requests.")
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-green-600 bg-green-100"
    if (grade === "B") return "text-blue-600 bg-blue-100"
    if (grade === "C") return "text-yellow-600 bg-yellow-100"
    if (grade === "?") return "text-gray-600 bg-gray-100"
    return "text-red-600 bg-red-100"
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shield}
        title="Security Headers Checker"
        description="Analyze HTTP security headers and get recommendations"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>URL Input</CardTitle>
            <CardDescription>Check security headers for any website</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="font-mono"
              />
            </div>

            <Button onClick={analyzeHeaders} disabled={loading || !url.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Check Security Headers"
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4 pt-4">
                {result.usedProxy && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Headers retrieved via proxy - results may be incomplete. Use the Electron app
                      for accurate security analysis.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-center">
                  <div
                    className={`inline-flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold ${getGradeColor(result.grade)}`}
                  >
                    {result.grade}
                  </div>
                  <p className="mt-2 text-2xl font-bold">{result.score}%</p>
                  <p className="text-muted-foreground text-sm">Security Score</p>
                </div>

                <Progress value={result.score} className="h-3" />

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-2xl font-bold text-green-600">
                      {result.headers.filter((h) => h.present).length}
                    </p>
                    <p className="text-muted-foreground text-xs">Present</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-2xl font-bold text-red-600">
                      {result.headers.filter((h) => !h.present).length}
                    </p>
                    <p className="text-muted-foreground text-xs">Missing</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Security Headers Analysis</CardTitle>
            <CardDescription>
              {result
                ? `Analysis for ${new URL(result.url).hostname}`
                : "Submit a URL to analyze security headers"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-3">
                {result.headers.map((header, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-4 ${header.present ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20" : "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {header.present ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                        ) : (
                          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-medium">{header.name}</p>
                            <Badge variant={header.present ? "default" : "destructive"}>
                              {header.present ? "Present" : "Missing"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">{header.description}</p>
                          {header.value && (
                            <p className="text-muted-foreground bg-muted/50 mt-2 rounded p-2 font-mono text-xs break-all">
                              {header.value}
                            </p>
                          )}
                          {header.recommendation && (
                            <div className="mt-2 flex items-start gap-2 text-sm">
                              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                              <span className="text-muted-foreground">{header.recommendation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {header.learnMore && (
                        <a
                          href={header.learnMore}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Shield className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">Enter a URL to check security headers</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Security Headers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">Why Security Headers Matter</h4>
              <p className="text-muted-foreground text-sm">
                HTTP security headers protect your website and users from common attacks like XSS,
                clickjacking, and protocol downgrade attacks. They are easy to implement and provide
                significant security benefits.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Implementation</h4>
              <p className="text-muted-foreground text-sm">
                Security headers can be configured in your web server (nginx, Apache), CDN
                (Cloudflare, AWS), or application framework. Most require only a few lines of
                configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
