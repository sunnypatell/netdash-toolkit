"use client"

import { Suspense, lazy, useCallback, useRef, useState } from "react"
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Database, ExternalLink, Info, Network, WifiOff } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { toast } from "sonner"
import {
  OUI_PREFIX_COUNT,
  OUI_VENDOR_COUNT,
  dedupeByOui,
  lookupLocal,
  lookupOui,
  parseMacInput,
} from "@/lib/oui-vendors"
import { sourceLabel, type LookupRow } from "./types"

// one chunk per panel: the shell carries neither input mode nor the results table
const SingleLookupPanel = lazy(() =>
  import("./single").then((m) => ({ default: m.SingleLookupPanel }))
)
const BulkLookupPanel = lazy(() => import("./bulk").then((m) => ({ default: m.BulkLookupPanel })))
const ResultsPanel = lazy(() => import("./results").then((m) => ({ default: m.ResultsPanel })))

const TABS = ["single", "bulk"] as const
const REMOTE_SPACING_MS = 1100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function PanelFallback() {
  return (
    <p
      data-panel-fallback
      className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
    >
      Loading panel...
    </p>
  )
}

export function OUILookup() {
  // the address and offline switch go in the url; a pasted inventory is somebody's device list
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(TABS).withDefault("single"),
      // a bundled prefix, so the default resolves offline instead of hitting a third party
      mac: parseAsString.withDefault("00:50:56:AA:BB:CC"),
      offline: parseAsBoolean.withDefault(false),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const [bulkInput, setBulkInput] = useState("")
  const [rows, setRows] = useState<LookupRow[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  // prefix -> vendor (null = confirmed remote miss); survives re-renders so a repeat is free
  const cache = useRef(new Map<string, string | null>())
  // mirrored into state: reading the ref during render left both this and the bulk estimate stale
  const [cachedOuis, setCachedOuis] = useState<ReadonlySet<string>>(() => new Set())
  const cached = useCallback((oui: string) => cachedOuis.has(oui), [cachedOuis])
  const syncCachedOuis = useCallback(() => setCachedOuis(new Set(cache.current.keys())), [])

  const offlineOnly = query.offline
  const parsed = parseMacInput(query.mac)
  const willGoRemote =
    !offlineOnly && parsed !== null && !lookupLocal(parsed.oui) && !cachedOuis.has(parsed.oui)

  const runSingle = async () => {
    if (!parsed) return
    setBusy(true)
    try {
      const result = await lookupOui(query.mac, { offlineOnly, cache: cache.current })
      setRows([{ ...result, timestamp: Date.now() }])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed")
    } finally {
      syncCachedOuis()
      setBusy(false)
    }
  }

  const runBulk = async (lines: string[]) => {
    if (lines.length === 0) return
    setBusy(true)
    const groups = dedupeByOui(lines)
    const collected: LookupRow[] = []
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
          collected.push({ ...result, input, timestamp: Date.now() })
        }
      }
      setRows(collected)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk lookup failed")
    } finally {
      syncCachedOuis()
      setProgress(null)
      setBusy(false)
    }
  }

  const exportJson = () => {
    downloadTextFile(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          offlineOnly,
          bundledPrefixes: OUI_PREFIX_COUNT,
          totalResults: rows.length,
          foundResults: rows.filter((r) => r.found).length,
          results: rows,
        },
        null,
        2
      ),
      `oui-lookup-results-${dateStamp()}.json`,
      "application/json"
    )
  }

  const exportCsv = () => {
    const csv = [
      "Input,MAC,OUI,Vendor,Found,Source,Timestamp,Error",
      ...rows.map((r) =>
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
          machine unless a prefix is missing. When it is, and online fallback is on, only the
          6-digit vendor prefix is sent to{" "}
          <a
            href="https://maclookup.app/api-v2/documentation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center hover:underline"
          >
            api.maclookup.app <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
          </a>
          , never the device-specific half.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Tabs
            value={query.tab}
            onValueChange={(value) => void setQuery({ tab: value as (typeof TABS)[number] })}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single</TabsTrigger>
              <TabsTrigger value="bulk">Bulk</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <SingleLookupPanel
                  value={query.mac}
                  busy={busy}
                  willGoRemote={willGoRemote}
                  onChange={(mac) => void setQuery({ mac })}
                  onLookup={() => void runSingle()}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4">
              <Suspense fallback={<PanelFallback />}>
                <BulkLookupPanel
                  value={bulkInput}
                  busy={busy}
                  progress={progress}
                  offlineOnly={offlineOnly}
                  cached={cached}
                  onChange={setBulkInput}
                  onLookup={(lines) => void runBulk(lines)}
                />
              </Suspense>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" aria-hidden="true" />
                Data sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3 rounded-lg border p-3">
                <Checkbox
                  id="offline-only"
                  checked={offlineOnly}
                  onCheckedChange={(checked) => setQuery({ offline: !!checked })}
                />
                <div className="space-y-1">
                  <Label htmlFor="offline-only" className="flex cursor-pointer items-center gap-2">
                    <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                    Offline only
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Never contact a remote API. Unbundled prefixes report as not found instead.
                  </p>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt>Bundled prefixes</dt>
                  <dd className="text-muted-foreground font-mono">{OUI_PREFIX_COUNT}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Bundled vendors</dt>
                  <dd className="text-muted-foreground font-mono">{OUI_VENDOR_COUNT}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Lookup order</dt>
                  <dd>
                    <Badge variant="secondary">Offline first</Badge>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Online fallback</dt>
                  <dd>
                    <Badge variant={offlineOnly ? "outline" : "secondary"}>
                      {offlineOnly ? "Disabled" : "api.maclookup.app"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Fallback rate limit</dt>
                  <dd className="text-muted-foreground">1 request/second</dd>
                </div>
              </dl>
              <Separator />
              <p className="text-muted-foreground text-xs">
                The bundled set covers common virtualisation, enterprise networking and consumer
                prefixes. It is not the full IEEE registry, which is why the online fallback exists.
                Prefixes resolved remotely are cached for this session.
              </p>
            </CardContent>
          </Card>
        </div>

        <div role="status" aria-busy={busy}>
          <Suspense fallback={<PanelFallback />}>
            <ResultsPanel rows={rows} onExportJson={exportJson} onExportCsv={exportCsv} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default OUILookup
