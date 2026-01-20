"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileText, AlertTriangle, CheckCircle2, XCircle, Loader2, Info } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"

interface HeaderInfo {
  name: string
  value: string
  category: "security" | "cache" | "content" | "cors" | "other"
  description?: string
}

interface AnalysisResult {
  url: string
  status: number
  statusText: string
  headers: HeaderInfo[]
  securityScore: number
  recommendations: string[]
}

const HEADER_CATEGORIES: Record<string, { category: HeaderInfo["category"]; description: string }> =
  {
    "content-type": {
      category: "content",
      description: "Specifies the media type of the resource",
    },
    "content-length": { category: "content", description: "Size of the response body in bytes" },
    "content-encoding": { category: "content", description: "Compression algorithm used" },
    "cache-control": { category: "cache", description: "Caching directives for browsers and CDNs" },
    expires: { category: "cache", description: "Date/time after which the response is stale" },
    etag: { category: "cache", description: "Identifier for a specific version of the resource" },
    "last-modified": { category: "cache", description: "Date the resource was last modified" },
    "strict-transport-security": { category: "security", description: "Forces HTTPS connections" },
    "content-security-policy": {
      category: "security",
      description: "Controls resources the browser can load",
    },
    "x-frame-options": { category: "security", description: "Prevents clickjacking attacks" },
    "x-content-type-options": { category: "security", description: "Prevents MIME type sniffing" },
    "x-xss-protection": { category: "security", description: "XSS filter (legacy)" },
    "referrer-policy": { category: "security", description: "Controls referrer information" },
    "permissions-policy": { category: "security", description: "Controls browser feature access" },
    "access-control-allow-origin": { category: "cors", description: "Allowed origins for CORS" },
    "access-control-allow-methods": {
      category: "cors",
      description: "Allowed HTTP methods for CORS",
    },
    "access-control-allow-headers": { category: "cors", description: "Allowed headers for CORS" },
  }

const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
]

export function HTTPHeaders() {
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

      const headers: HeaderInfo[] = []
      const recommendations: string[] = []

      response.headers.forEach((value, name) => {
        const lowerName = name.toLowerCase()
        const info = HEADER_CATEGORIES[lowerName]
        headers.push({
          name,
          value,
          category: info?.category || "other",
          description: info?.description,
        })
      })

      // Check for missing security headers
      let securityScore = 100
      if (!usedProxy) {
        SECURITY_HEADERS.forEach((header) => {
          const found = headers.some((h) => h.name.toLowerCase() === header)
          if (!found) {
            securityScore -= 15
            recommendations.push(`Missing ${header} header`)
          }
        })
      } else {
        securityScore = 0
        recommendations.push(
          "Headers retrieved via proxy - security analysis may be incomplete. Use the Electron app for accurate results."
        )
      }

      securityScore = Math.max(0, securityScore)

      setResult({
        url: targetUrl,
        status: response.status,
        statusText: response.statusText,
        headers: headers.sort((a, b) => a.name.localeCompare(b.name)),
        securityScore,
        recommendations,
      })
    } catch (err) {
      setError("Unable to fetch headers. The site may be blocking requests.")
    } finally {
      setLoading(false)
    }
  }

  const exportHeaders = () => {
    if (!result) return
    const data = {
      url: result.url,
      status: result.status,
      headers: result.headers.reduce(
        (acc, h) => {
          acc[h.name] = h.value
          return acc
        },
        {} as Record<string, string>
      ),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `headers-${new URL(result.url).hostname}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const getCategoryColor = (category: HeaderInfo["category"]) => {
    switch (category) {
      case "security":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "cache":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "content":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20"
      case "cors":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileText}
        title="HTTP Headers Analyzer"
        description="Analyze HTTP response headers and security configuration"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>URL Input</CardTitle>
            <CardDescription>Enter a URL to analyze its HTTP headers</CardDescription>
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
                "Analyze Headers"
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="font-mono text-lg">
                      {result.status} {result.statusText}
                    </p>
                  </div>
                  <Badge
                    variant={result.securityScore >= 70 ? "default" : "destructive"}
                    className="px-3 py-1 text-lg"
                  >
                    {result.securityScore}%
                  </Badge>
                </div>

                {result.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recommendations</p>
                    {result.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                        <span className="text-muted-foreground">{rec}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={exportHeaders}>
                  Export JSON
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Response Headers</span>
              {result && <Badge variant="secondary">{result.headers.length} headers</Badge>}
            </CardTitle>
            <CardDescription>
              {result
                ? `Headers from ${new URL(result.url).hostname}`
                : "Submit a URL to see headers"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="max-h-[500px] space-y-2 overflow-y-auto">
                {result.headers.map((header, index) => (
                  <div key={index} className="space-y-1 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className={getCategoryColor(header.category)}>
                          {header.category}
                        </Badge>
                        <span className="truncate font-mono text-sm font-medium">
                          {header.name}
                        </span>
                      </div>
                      <CopyButton value={header.value} size="sm" className="flex-shrink-0" />
                    </div>
                    <p className="text-muted-foreground font-mono text-xs break-all">
                      {header.value}
                    </p>
                    {header.description && (
                      <p className="text-muted-foreground text-xs">{header.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">Enter a URL to analyze headers</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security Headers Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SECURITY_HEADERS.map((header) => {
              const hasHeader = result?.headers.some((h) => h.name.toLowerCase() === header)
              return (
                <div key={header} className="flex items-start gap-2 rounded-lg border p-3">
                  {hasHeader ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="font-mono text-sm font-medium">{header}</p>
                    <p className="text-muted-foreground text-xs">
                      {HEADER_CATEGORIES[header]?.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
