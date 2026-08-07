"use client"

import { useEffect, useMemo, useState } from "react"
import { parseAsString, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Monitor, Smartphone, Tablet, Tv, Globe, Bot, RefreshCw, Info } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { ResultCard } from "@/components/ui/result-card"
import {
  applyClientHints,
  deviceLabel,
  parseUa,
  readClientHints,
  type UaClientHints,
} from "@/lib/ua-parse"

const SAMPLES = [
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
    name: "Chrome on iPhone (CriOS)",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Edge on iPhone (EdgiOS)",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 EdgiOS/120.0.2210.126 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Legacy Edge 18 (EdgeHTML)",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763",
  },
  {
    name: "Samsung Internet on Galaxy S23",
    ua: "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  },
  {
    name: "Safari on iPad",
    ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Android WebView",
    ua: "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  },
  {
    name: "Facebook in-app browser",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2]",
  },
  {
    name: "Googlebot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
  {
    name: "GPTBot",
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  },
  {
    name: "facebookexternalhit",
    ua: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  },
  { name: "curl", ua: "curl/8.4.0" },
  {
    name: "Headless Chrome",
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
  },
]

export function UserAgentParser() {
  // a UA string is short and not a secret, and sharing one is the whole point of this tool
  const [{ ua: queryUa }, setQuery] = useQueryStates(
    { ua: parseAsString.withDefault("") },
    { history: "replace" }
  )

  // the live UA is only a fallback for an empty url, so it is never written back
  const [liveUa, setLiveUa] = useState("")
  const [hints, setHints] = useState<UaClientHints | null>(null)
  const [hintsChecked, setHintsChecked] = useState(false)

  const userAgent = queryUa || liveUa
  const isLiveUa = queryUa === ""

  useEffect(() => {
    if (typeof navigator === "undefined") return
    setLiveUa(navigator.userAgent)
    void readClientHints().then((value) => {
      setHints(value)
      setHintsChecked(true)
    })
  }, [])

  const baseReport = useMemo(() => parseUa(userAgent), [userAgent])
  // hints describe *this* browser, so they only apply while the live UA is loaded
  const parsed = useMemo(
    () => (isLiveUa && hints ? applyClientHints(baseReport, hints) : baseReport),
    [baseReport, hints, isLiveUa]
  )
  const hasInput = userAgent.trim().length > 0

  const setUa = (value: string) => void setQuery({ ua: value })

  // clearing the param is what selects the live UA, so hints apply again
  const loadCurrentUA = () => void setQuery({ ua: null })

  const DeviceIcon =
    parsed.device.type === "bot"
      ? Bot
      : parsed.device.type === "mobile"
        ? Smartphone
        : parsed.device.type === "tablet"
          ? Tablet
          : parsed.device.type === "tv"
            ? Tv
            : Monitor

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Globe}
        title="User Agent Parser"
        description="Identify browser, engine, OS and device from a user agent string, with Client Hints where available"
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
                onChange={(e) => setUa(e.target.value)}
                placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
                className="h-24 font-mono text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={loadCurrentUA}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Use Current Browser
              </Button>
              {hasInput && <CopyButton value={userAgent} variant="outline" />}
            </div>

            {hasInput && (
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
                    {parsed.osVersionAmbiguous && (
                      <p className="text-muted-foreground text-xs">
                        OS version unconfirmed - see the note below
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={parsed.isBot ? "destructive" : "default"}>
                    {deviceLabel(parsed)}
                  </Badge>
                  <Badge variant="secondary">{parsed.engine.name}</Badge>
                  {parsed.usedClientHints && <Badge variant="outline">Client Hints applied</Badge>}
                </div>

                {parsed.notes.length > 0 && (
                  <ul className="text-muted-foreground space-y-1 text-xs">
                    {parsed.notes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {hasInput && (parsed.osVersionAmbiguous || parsed.precisionNote) && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="space-y-1 text-xs">
                  {parsed.precisionNote && <p>{parsed.precisionNote}</p>}
                  {isLiveUa && hintsChecked && !hints && (
                    <p>
                      UA reduced / low entropy: this browser exposes no{" "}
                      <code>navigator.userAgentData</code>, so nothing can raise the precision.
                      Client Hints are Chromium-only and need a secure context.
                    </p>
                  )}
                  {!isLiveUa && (
                    <p>
                      Pasted strings cannot be refined - Client Hints only exist for the live
                      browser. Load the current browser to see the high-entropy values.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {hasInput ? (
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
                  {
                    label: "Version",
                    value: parsed.os.version || "Unknown",
                    description: parsed.osVersionAmbiguous
                      ? "Cannot be pinned down from the UA string alone"
                      : undefined,
                  },
                ]}
              />

              <ResultCard
                title="Device Information"
                data={[
                  { label: "Type", value: deviceLabel(parsed), highlight: true },
                  { label: "Vendor", value: parsed.device.vendor || "Unknown" },
                  { label: "Model", value: parsed.device.model || "Unknown" },
                ]}
              />

              {parsed.usedClientHints && hints && (
                <ResultCard
                  title="Client Hints (high entropy)"
                  description="Read from navigator.userAgentData.getHighEntropyValues()"
                  data={[
                    { label: "Platform", value: hints.platform || "Unknown" },
                    { label: "Platform Version", value: hints.platformVersion || "Unknown" },
                    { label: "Model", value: hints.model || "(none)" },
                    {
                      label: "Full Version List",
                      value:
                        (hints.fullVersionList ?? [])
                          .map((b) => `${b.brand} ${b.version}`)
                          .join(", ") || "Unknown",
                    },
                  ]}
                />
              )}
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
          <CardDescription>
            The awkward cases - iOS third-party browsers, legacy Edge, webviews and crawlers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample.name}
                onClick={() => setUa(sample.ua)}
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
