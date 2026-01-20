"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowRight, AlertTriangle, Loader2, ExternalLink, Copy, Globe } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"

interface RedirectHop {
  url: string
  status: number
  statusText: string
  location?: string
  time?: number
}

interface RedirectResult {
  originalUrl: string
  finalUrl: string
  hops: RedirectHop[]
  totalTime: number
  isHttpsUpgrade: boolean
  warnings: string[]
}

export function RedirectChecker() {
  const { toast } = useToast()
  const [url, setUrl] = useState("http://github.com")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RedirectResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkRedirects = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let targetUrl = url.trim()
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "http://" + targetUrl
      }

      const hops: RedirectHop[] = []
      const warnings: string[] = []
      let currentUrl = targetUrl
      const startTime = Date.now()
      const maxRedirects = 10

      for (let i = 0; i < maxRedirects; i++) {
        const hopStart = Date.now()

        try {
          const response = await fetch(currentUrl, {
            method: "HEAD",
            redirect: "manual",
            mode: "cors",
          })

          const hopTime = Date.now() - hopStart
          const location = response.headers.get("location")

          hops.push({
            url: currentUrl,
            status: response.status,
            statusText: response.statusText,
            location: location || undefined,
            time: hopTime,
          })

          if (response.status >= 300 && response.status < 400 && location) {
            // Handle relative URLs
            if (location.startsWith("/")) {
              const urlObj = new URL(currentUrl)
              currentUrl = urlObj.origin + location
            } else if (!location.startsWith("http")) {
              const urlObj = new URL(currentUrl)
              currentUrl = urlObj.origin + "/" + location
            } else {
              currentUrl = location
            }
          } else {
            break
          }
        } catch {
          // Try with a CORS proxy for the last hop
          hops.push({
            url: currentUrl,
            status: 0,
            statusText: "CORS Error - Unable to follow",
          })
          warnings.push(`Could not follow redirect to ${currentUrl} due to CORS restrictions`)
          break
        }
      }

      const totalTime = Date.now() - startTime
      const finalUrl = hops.length > 0 ? hops[hops.length - 1].url : targetUrl

      // Check for HTTPS upgrade
      const isHttpsUpgrade = targetUrl.startsWith("http://") && finalUrl.startsWith("https://")

      // Check for warnings
      if (hops.length >= maxRedirects) {
        warnings.push("Maximum redirect limit reached (10)")
      }

      // Check for redirect loops
      const urlCounts = new Map<string, number>()
      hops.forEach((hop) => {
        const count = urlCounts.get(hop.url) || 0
        urlCounts.set(hop.url, count + 1)
        if (count > 0) {
          warnings.push(`Possible redirect loop detected at ${hop.url}`)
        }
      })

      // Check for mixed content
      if (finalUrl.startsWith("http://") && targetUrl.startsWith("https://")) {
        warnings.push("Redirect from HTTPS to HTTP - potential security issue")
      }

      setResult({
        originalUrl: targetUrl,
        finalUrl,
        hops,
        totalTime,
        isHttpsUpgrade,
        warnings,
      })
    } catch (err) {
      setError(
        "Unable to check redirects. This may be due to CORS restrictions. Try using the Electron app for full access."
      )
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "URL copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500"
    if (status >= 300 && status < 400) return "bg-blue-500"
    if (status >= 400 && status < 500) return "bg-yellow-500"
    if (status >= 500) return "bg-red-500"
    return "bg-gray-500"
  }

  const getStatusBadgeVariant = (status: number) => {
    if (status >= 200 && status < 300) return "default"
    if (status >= 300 && status < 400) return "secondary"
    return "destructive"
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe}
        title="Redirect Checker"
        description="Trace HTTP redirect chains and analyze URL redirections"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>URL Input</CardTitle>
            <CardDescription>Enter a URL to trace its redirect chain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="url">Starting URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://example.com"
                className="font-mono"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Use http:// to test HTTPS upgrades
              </p>
            </div>

            <Button onClick={checkRedirects} disabled={loading || !url.trim()} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tracing...
                </>
              ) : (
                "Check Redirects"
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Total Hops</span>
                    <Badge variant="secondary">{result.hops.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Total Time</span>
                    <Badge variant="outline">{result.totalTime}ms</Badge>
                  </div>
                  {result.isHttpsUpgrade && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">HTTPS Upgrade</span>
                      <Badge variant="default" className="bg-green-600">
                        Yes
                      </Badge>
                    </div>
                  )}
                </div>

                {result.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-inside list-disc text-sm">
                        {result.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Redirect Chain</CardTitle>
            <CardDescription>
              {result
                ? `${result.hops.length} hop${result.hops.length !== 1 ? "s" : ""} traced`
                : "Submit a URL to trace redirects"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                {result.hops.map((hop, index) => (
                  <div key={index} className="relative">
                    {index < result.hops.length - 1 && (
                      <div className="bg-border absolute top-12 left-4 h-full w-0.5" />
                    )}
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${getStatusColor(hop.status)} flex-shrink-0 text-sm font-bold text-white`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2 pb-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(hop.status)}>
                            {hop.status} {hop.statusText}
                          </Badge>
                          {hop.time && <Badge variant="outline">{hop.time}ms</Badge>}
                          {index === result.hops.length - 1 && (
                            <Badge variant="default" className="bg-green-600">
                              Final
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="flex-1 font-mono text-sm break-all">{hop.url}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(hop.url)}
                            className="flex-shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <a
                            href={hop.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0"
                          >
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                        {hop.location && index < result.hops.length - 1 && (
                          <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <ArrowRight className="h-4 w-4" />
                            <span>Redirects to: {hop.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Globe className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">Enter a URL to trace its redirect chain</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HTTP Redirect Status Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                code: 301,
                name: "Moved Permanently",
                desc: "Resource permanently moved to new URL",
              },
              { code: 302, name: "Found", desc: "Temporary redirect (commonly used)" },
              { code: 303, name: "See Other", desc: "Redirect to GET another resource" },
              {
                code: 307,
                name: "Temporary Redirect",
                desc: "Temporary redirect, preserves method",
              },
              {
                code: 308,
                name: "Permanent Redirect",
                desc: "Permanent redirect, preserves method",
              },
              { code: 304, name: "Not Modified", desc: "Resource unchanged, use cached version" },
            ].map((item) => (
              <div key={item.code} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.code}</Badge>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
