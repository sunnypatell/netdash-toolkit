"use client"

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Download,
  Info,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Network,
  WifiOff,
  Database,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { toast } from "sonner"
import {
  dedupeByOui,
  lookupLocal,
  lookupOui,
  parseMacInput,
  OUI_PREFIX_COUNT,
  OUI_VENDOR_COUNT,
  type OuiResult,
} from "@/lib/oui-vendors"

interface LookupRow extends OuiResult {
  timestamp: number
}

const REMOTE_SPACING_MS = 1100

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sourceLabel(source: OuiResult["source"]): string {
  switch (source) {
    case "offline":
      return "Offline database"
    case "remote":
      return "maclookup.app"
    case "cache":
      return "Session cache"
    default:
      return "Not looked up"
  }
}

export function OUILookup() {
  // a bundled prefix, so the default action resolves offline rather than
  // silently firing a request at a third party on first click
  const [macInput, setMacInput] = useState("00:50:56:AA:BB:CC")
  const [bulkInput, setBulkInput] = useState("")
  const [results, setResults] = useState<LookupRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [offlineOnly, setOfflineOnly] = useState(false)

  // prefix -> vendor (null = confirmed remote miss). survives re-renders so a
  // repeated prefix never costs a second request.
  const cache = useRef(new Map<string, string | null>())

  const parsedInput = useMemo(() => parseMacInput(macInput), [macInput])
  const bulkLines = useMemo(() => bulkInput.split("\n").filter((line) => line.trim()), [bulkInput])

  // how many of those lines would actually leave the device
  const bulkPlan = useMemo(() => {
    const groups = dedupeByOui(bulkLines)
    const remote = groups.filter(
      (g) => g.oui && !lookupLocal(g.oui) && !cache.current.has(g.oui)
    ).length
    return { unique: groups.length, remote: offlineOnly ? 0 : remote }
  }, [bulkLines, offlineOnly])

  const willGoRemote =
    !offlineOnly &&
    parsedInput !== null &&
    !lookupLocal(parsedInput.oui) &&
    !cache.current.has(parsedInput.oui)

  const handleSingleLookup = async () => {
    if (!parsedInput) return
    setIsLoading(true)
    try {
      const result = await lookupOui(macInput, { offlineOnly, cache: cache.current })
      setResults([{ ...result, timestamp: Date.now() }])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkLookup = async () => {
    if (bulkLines.length === 0) return

    setIsLoading(true)
    const groups = dedupeByOui(bulkLines)
    const rows: LookupRow[] = []
    let lastRemoteAt = 0

    try {
      for (const [index, group] of groups.entries()) {
        setProgress(`Prefix ${index + 1} of ${groups.length}`)

        // only network calls are rate limited; offline hits are instant
        const needsRemote =
          !offlineOnly &&
          group.oui !== "" &&
          !lookupLocal(group.oui) &&
          !cache.current.has(group.oui)
        if (needsRemote && lastRemoteAt > 0) {
          const wait = REMOTE_SPACING_MS - (Date.now() - lastRemoteAt)
          if (wait > 0) await sleep(wait)
        }

        const result = await lookupOui(group.inputs[0], { offlineOnly, cache: cache.current })
        if (needsRemote) lastRemoteAt = Date.now()

        // one row per input line so exports line up with what was pasted
        for (const input of group.inputs) {
          rows.push({ ...result, input, timestamp: Date.now() })
        }
      }
      setResults(rows)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk lookup failed")
    } finally {
      setProgress(null)
      setIsLoading(false)
    }
  }

  const exportResults = () => {
    downloadTextFile(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          offlineOnly,
          bundledPrefixes: OUI_PREFIX_COUNT,
          totalResults: results.length,
          foundResults: results.filter((r) => r.found).length,
          results,
        },
        null,
        2
      ),
      `oui-lookup-results-${dateStamp()}.json`,
      "application/json"
    )
  }

  const exportCSV = () => {
    const csv = [
      "Input,MAC,OUI,Vendor,Found,Source,Timestamp,Error",
      ...results.map((r) =>
        [
          r.input,
          r.mac ?? "",
          r.ouiFormatted,
          r.vendor ?? "",
          r.found,
          sourceLabel(r.source),
          new Date(r.timestamp).toISOString(),
          r.error ?? "",
        ]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n")

    downloadTextFile(csv, `oui-lookup-results-${dateStamp()}.csv`, "text/csv")
  }

  const vendorStats = useMemo(() => {
    const stats: Record<string, number> = {}
    for (const result of results) {
      if (result.found && result.vendor) {
        stats[result.vendor] = (stats[result.vendor] || 0) + 1
      }
    }
    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
  }, [results])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Network}
        title="OUI Lookup"
        description="Identify MAC address vendors from a bundled offline database, with an optional online fallback"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>A MAC address identifies a specific device.</strong> Every lookup is answered from
          the {OUI_PREFIX_COUNT} prefixes bundled with this app first, so nothing leaves your
          machine unless a prefix is missing. When it is - and online fallback is on - only the
          6-digit vendor prefix is sent to{" "}
          <a
            href="https://maclookup.app/api-v2/documentation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center hover:underline"
          >
            api.maclookup.app <ExternalLink className="ml-1 h-3 w-3" />
          </a>
          , never the device-specific half.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Single MAC Lookup</CardTitle>
              <CardDescription>Enter a full MAC address or just a 3-octet OUI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="mac-input">MAC Address</Label>
                <Input
                  id="mac-input"
                  value={macInput}
                  onChange={(e) => setMacInput(e.target.value)}
                  placeholder="00:11:22:33:44:55 or 001122334455 or 00:11:22"
                  onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSingleLookup()}
                />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    {parsedInput ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-600" />
                    )}
                    <span className={parsedInput ? "text-green-600" : "text-red-600"}>
                      {parsedInput
                        ? `${parsedInput.isFullMac ? "Full MAC" : "OUI only"} - prefix ${parsedInput.ouiFormatted}`
                        : "Not a MAC address or OUI"}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    xx:xx:xx:xx:xx:xx, xx-xx-..., xxxx.xxxx.xxxx, xxxxxxxxxxxx
                  </span>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border p-3">
                <Checkbox
                  id="offline-only"
                  checked={offlineOnly}
                  onCheckedChange={(checked) => setOfflineOnly(!!checked)}
                />
                <div className="space-y-1">
                  <Label htmlFor="offline-only" className="flex cursor-pointer items-center gap-2">
                    <WifiOff className="h-3.5 w-3.5" />
                    Offline only
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Never contact a remote API. Unbundled prefixes report as not found instead.
                  </p>
                </div>
              </div>

              {parsedInput && (
                <p className="text-muted-foreground text-xs">
                  {willGoRemote
                    ? `${parsedInput.ouiFormatted} is not in the bundled database - this lookup will send the prefix to api.maclookup.app.`
                    : `Answered locally - no network request.`}
                </p>
              )}

              <Button
                onClick={handleSingleLookup}
                disabled={!parsedInput || isLoading}
                className="w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                {isLoading ? "Looking up..." : "Lookup Vendor"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bulk MAC Lookup</CardTitle>
              <CardDescription>
                One per line. Duplicate vendor prefixes are looked up once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bulk-input">MAC Addresses</Label>
                <textarea
                  id="bulk-input"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="00:11:22:33:44:55&#10;00:50:56:aa:bb:cc&#10;08:00:27:dd:ee:ff&#10;001122334455"
                  className="h-32 w-full resize-none rounded-md border p-3 font-mono text-sm"
                />
                <div className="text-muted-foreground mt-1 text-xs">
                  {bulkLines.length} line{bulkLines.length === 1 ? "" : "s"}, {bulkPlan.unique}{" "}
                  unique prefix
                  {bulkPlan.unique === 1 ? "" : "es"}
                  {bulkPlan.remote > 0
                    ? ` - ${bulkPlan.remote} need a remote call (≈${bulkPlan.remote} s)`
                    : bulkLines.length > 0
                      ? " - all answered offline, instantly"
                      : ""}
                </div>
              </div>
              <Button
                onClick={handleBulkLookup}
                disabled={isLoading || bulkLines.length === 0}
                className="w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                {isLoading ? (progress ?? "Processing...") : "Bulk Lookup"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Bundled prefixes:</span>
                  <span className="text-muted-foreground font-mono">{OUI_PREFIX_COUNT}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bundled vendors:</span>
                  <span className="text-muted-foreground font-mono">{OUI_VENDOR_COUNT}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lookup order:</span>
                  <Badge variant="secondary">Offline first</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Online fallback:</span>
                  <Badge variant={offlineOnly ? "outline" : "secondary"}>
                    {offlineOnly ? "Disabled" : "maclookup.app"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Fallback rate limit:</span>
                  <span className="text-muted-foreground">1 request/second</span>
                </div>
                <Separator />
                <p className="text-muted-foreground text-xs">
                  The bundled set covers common virtualisation, enterprise networking and consumer
                  prefixes - it is not the full IEEE registry, which is why the online fallback
                  exists. Prefixes resolved remotely are cached for this session.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {results.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                    Lookup Results
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{results.length} total</Badge>
                      <Badge variant="secondary">
                        {results.filter((r) => r.found).length} found
                      </Badge>
                      <Badge variant="outline">
                        {results.filter((r) => r.source === "offline").length} offline
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 space-y-3 overflow-y-auto">
                    {results.map((result, index) => (
                      <div
                        key={`${result.input}-${index}`}
                        className="hover:bg-muted/50 rounded-lg border p-3 transition-colors"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm">{result.mac ?? result.input}</span>
                            <CopyButton
                              value={result.mac ?? result.input}
                              className="h-6 w-6 p-0"
                            />
                          </div>
                          <Badge variant={result.found ? "default" : "secondary"}>
                            {result.found ? "Found" : "Not found"}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">OUI:</span>
                            <span className="font-mono">{result.ouiFormatted || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vendor:</span>
                            <span
                              className={result.found ? "font-medium" : "text-muted-foreground"}
                            >
                              {result.vendor ?? "No vendor for this prefix"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Source:</span>
                            <span className="text-muted-foreground">
                              {sourceLabel(result.source)}
                            </span>
                          </div>
                          {result.locallyAdministered && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Locally administered address - randomized or manually set, so no
                              vendor is registered for it.
                            </p>
                          )}
                          {result.multicast && (
                            <p className="text-muted-foreground text-xs">
                              Multicast/group address, not a single interface.
                            </p>
                          )}
                          {result.error && (
                            <div className="flex justify-between gap-2">
                              <span className="text-muted-foreground">Note:</span>
                              <span className="text-muted-foreground text-right text-xs">
                                {result.error}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {vendorStats.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Vendor Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {vendorStats.map(([vendor, count]) => (
                        <div key={vendor} className="flex items-center justify-between">
                          <span className="mr-2 flex-1 truncate text-sm">{vendor}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex space-x-2">
                <Button onClick={exportResults} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
                <Button onClick={exportCSV} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Bundled Samples</CardTitle>
              <CardDescription>All of these resolve offline - click to load one</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {[
                  { oui: "00:50:56", mac: "00:50:56:aa:bb:cc" },
                  { oui: "00:0C:29", mac: "00:0C:29:dd:ee:ff" },
                  { oui: "00:1B:21", mac: "00:1B:21:11:22:33" },
                  { oui: "00:15:5D", mac: "00:15:5D:44:55:66" },
                  { oui: "08:00:27", mac: "08:00:27:77:88:99" },
                  { oui: "00:05:85", mac: "00:05:85:aa:bb:cc" },
                  { oui: "F0:18:98", mac: "F0:18:98:dd:ee:ff" },
                  { oui: "00:1C:73", mac: "00:1C:73:11:22:33" },
                ].map(({ oui, mac }) => (
                  <div key={oui} className="flex items-center justify-between">
                    <button
                      onClick={() => setMacInput(mac)}
                      className="hover:text-primary cursor-pointer text-left font-mono transition-colors"
                    >
                      {oui}:xx:xx:xx
                    </button>
                    <span className="text-muted-foreground ml-2 truncate">
                      {lookupLocal(oui.replace(/:/g, ""))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
