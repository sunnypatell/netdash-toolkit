"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Copy, Monitor, Smartphone, Tablet, Globe, Bot, RefreshCw } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"
import { ResultCard } from "@/components/ui/result-card"

interface ParsedUserAgent {
  browser: { name: string; version: string }
  os: { name: string; version: string }
  device: { type: string; vendor?: string; model?: string }
  engine: { name: string; version: string }
  isBot: boolean
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

// Simple UA parser - based on common patterns
function parseUserAgent(ua: string): ParsedUserAgent {
  const result: ParsedUserAgent = {
    browser: { name: "Unknown", version: "" },
    os: { name: "Unknown", version: "" },
    device: { type: "Desktop" },
    engine: { name: "Unknown", version: "" },
    isBot: false,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }

  // Detect bots
  const botPatterns = /bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduck/i
  result.isBot = botPatterns.test(ua)

  // Detect mobile/tablet
  result.isMobile = /Mobile|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  result.isTablet = /Tablet|iPad|Android(?!.*Mobile)/i.test(ua)
  result.isDesktop = !result.isMobile && !result.isTablet && !result.isBot

  // Device type
  if (result.isBot) result.device.type = "Bot"
  else if (result.isMobile) result.device.type = "Mobile"
  else if (result.isTablet) result.device.type = "Tablet"
  else result.device.type = "Desktop"

  // Browser detection
  if (/Edg\/(\d+[\d.]*)/i.test(ua)) {
    result.browser = { name: "Edge", version: ua.match(/Edg\/(\d+[\d.]*)/i)?.[1] || "" }
  } else if (/OPR\/(\d+[\d.]*)/i.test(ua)) {
    result.browser = { name: "Opera", version: ua.match(/OPR\/(\d+[\d.]*)/i)?.[1] || "" }
  } else if (/Chrome\/(\d+[\d.]*)/i.test(ua)) {
    result.browser = { name: "Chrome", version: ua.match(/Chrome\/(\d+[\d.]*)/i)?.[1] || "" }
  } else if (/Firefox\/(\d+[\d.]*)/i.test(ua)) {
    result.browser = { name: "Firefox", version: ua.match(/Firefox\/(\d+[\d.]*)/i)?.[1] || "" }
  } else if (/Safari\/(\d+[\d.]*)/i.test(ua) && !/Chrome/i.test(ua)) {
    result.browser = { name: "Safari", version: ua.match(/Version\/(\d+[\d.]*)/i)?.[1] || "" }
  } else if (/MSIE (\d+[\d.]*)/i.test(ua) || /Trident.*rv:(\d+[\d.]*)/i.test(ua)) {
    result.browser = {
      name: "Internet Explorer",
      version: ua.match(/MSIE (\d+[\d.]*)/i)?.[1] || ua.match(/rv:(\d+[\d.]*)/i)?.[1] || "",
    }
  }

  // OS detection
  if (/Windows NT 10/i.test(ua)) {
    result.os = { name: "Windows", version: "10/11" }
  } else if (/Windows NT 6\.3/i.test(ua)) {
    result.os = { name: "Windows", version: "8.1" }
  } else if (/Windows NT 6\.2/i.test(ua)) {
    result.os = { name: "Windows", version: "8" }
  } else if (/Windows NT 6\.1/i.test(ua)) {
    result.os = { name: "Windows", version: "7" }
  } else if (/Mac OS X (\d+[._\d]*)/i.test(ua)) {
    result.os = {
      name: "macOS",
      version: ua.match(/Mac OS X (\d+[._\d]*)/i)?.[1]?.replace(/_/g, ".") || "",
    }
  } else if (/iPhone OS (\d+[._\d]*)/i.test(ua)) {
    result.os = {
      name: "iOS",
      version: ua.match(/iPhone OS (\d+[._\d]*)/i)?.[1]?.replace(/_/g, ".") || "",
    }
  } else if (/iPad.*OS (\d+[._\d]*)/i.test(ua)) {
    result.os = {
      name: "iPadOS",
      version: ua.match(/OS (\d+[._\d]*)/i)?.[1]?.replace(/_/g, ".") || "",
    }
  } else if (/Android (\d+[\d.]*)/i.test(ua)) {
    result.os = { name: "Android", version: ua.match(/Android (\d+[\d.]*)/i)?.[1] || "" }
  } else if (/Linux/i.test(ua)) {
    result.os = { name: "Linux", version: "" }
  } else if (/CrOS/i.test(ua)) {
    result.os = { name: "Chrome OS", version: "" }
  }

  // Engine detection
  if (/Gecko\/(\d+)/i.test(ua) && /Firefox/i.test(ua)) {
    result.engine = { name: "Gecko", version: ua.match(/rv:(\d+[\d.]*)/i)?.[1] || "" }
  } else if (/AppleWebKit\/(\d+[\d.]*)/i.test(ua)) {
    result.engine = { name: "WebKit", version: ua.match(/AppleWebKit\/(\d+[\d.]*)/i)?.[1] || "" }
  } else if (/Trident\/(\d+[\d.]*)/i.test(ua)) {
    result.engine = { name: "Trident", version: ua.match(/Trident\/(\d+[\d.]*)/i)?.[1] || "" }
  }

  // Device vendor/model for mobile
  if (/iPhone/i.test(ua)) {
    result.device = { type: "Mobile", vendor: "Apple", model: "iPhone" }
  } else if (/iPad/i.test(ua)) {
    result.device = { type: "Tablet", vendor: "Apple", model: "iPad" }
  } else if (/Samsung/i.test(ua)) {
    const model = ua.match(/SM-[A-Z0-9]+/i)?.[0]
    result.device = { type: result.device.type, vendor: "Samsung", model }
  } else if (/Pixel/i.test(ua)) {
    const model = ua.match(/Pixel[^;)]+/i)?.[0]
    result.device = { type: result.device.type, vendor: "Google", model }
  }

  return result
}

export function UserAgentParser() {
  const { toast } = useToast()
  const [userAgent, setUserAgent] = useState("")
  const [parsed, setParsed] = useState<ParsedUserAgent | null>(null)

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setUserAgent(navigator.userAgent)
    }
  }, [])

  useEffect(() => {
    if (userAgent.trim()) {
      setParsed(parseUserAgent(userAgent))
    } else {
      setParsed(null)
    }
  }, [userAgent])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "User agent copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const loadCurrentUA = () => {
    if (typeof navigator !== "undefined") {
      setUserAgent(navigator.userAgent)
    }
  }

  const DeviceIcon = parsed?.isMobile
    ? Smartphone
    : parsed?.isTablet
      ? Tablet
      : parsed?.isBot
        ? Bot
        : Monitor

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe}
        title="User Agent Parser"
        description="Parse and analyze browser user agent strings"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Agent String</CardTitle>
            <CardDescription>Enter a user agent string to parse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ua">User Agent</Label>
              <Textarea
                id="ua"
                value={userAgent}
                onChange={(e) => setUserAgent(e.target.value)}
                placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
                className="h-24 font-mono text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={loadCurrentUA}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Use Current Browser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(userAgent)}
                disabled={!userAgent}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>

            {parsed && (
              <div className="space-y-4 pt-4">
                <div className="bg-muted/50 flex items-center gap-4 rounded-lg p-4">
                  <DeviceIcon className="text-primary h-12 w-12" />
                  <div>
                    <p className="text-lg font-semibold">
                      {parsed.browser.name} {parsed.browser.version}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {parsed.os.name} {parsed.os.version}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={parsed.isDesktop ? "default" : "outline"}>
                    {parsed.isDesktop && "Desktop"}
                    {parsed.isMobile && "Mobile"}
                    {parsed.isTablet && "Tablet"}
                    {parsed.isBot && "Bot/Crawler"}
                  </Badge>
                  <Badge variant="secondary">{parsed.engine.name}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {parsed ? (
            <>
              <ResultCard
                title="Browser Information"
                data={[
                  { label: "Browser", value: parsed.browser.name },
                  { label: "Version", value: parsed.browser.version || "Unknown" },
                  { label: "Engine", value: parsed.engine.name },
                  { label: "Engine Version", value: parsed.engine.version || "Unknown" },
                ]}
              />

              <ResultCard
                title="Operating System"
                data={[
                  { label: "OS", value: parsed.os.name },
                  { label: "Version", value: parsed.os.version || "Unknown" },
                ]}
              />

              <ResultCard
                title="Device Information"
                data={[
                  { label: "Type", value: parsed.device.type, highlight: true },
                  { label: "Vendor", value: parsed.device.vendor || "Unknown" },
                  { label: "Model", value: parsed.device.model || "Unknown" },
                ]}
              />
            </>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">Enter a user agent string to see results</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample User Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                name: "Chrome on Windows",
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
              {
                name: "Safari on macOS",
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
              },
              {
                name: "Firefox on Linux",
                ua: "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
              },
              {
                name: "Chrome on Android",
                ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
              },
              {
                name: "Safari on iPhone",
                ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
              },
              {
                name: "Googlebot",
                ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
              },
            ].map((sample) => (
              <button
                key={sample.name}
                onClick={() => setUserAgent(sample.ua)}
                className="hover:bg-muted/50 rounded-lg border p-3 text-left transition-colors"
              >
                <p className="text-sm font-medium">{sample.name}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">{sample.ua}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
