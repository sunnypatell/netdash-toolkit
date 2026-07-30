"use client"

import { useEffect, useMemo, useState } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock, RefreshCw, Globe, XCircle, Info, Pause, Play } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { ResultCard } from "@/components/ui/result-card"
import {
  TIMESTAMP_UNITS,
  epochMsToUnitString,
  formatRelativeToNow,
  parseTimestampInput,
  startOfLocalDay,
  toLocalDateInputValue,
  toLocalTimeInputValue,
  type TimestampUnit,
} from "@/lib/timestamp"
import {
  formatInZone,
  formatOffset,
  listTimeZones,
  localTimeZone,
  zoneOffsetMs,
  zonedTimeToEpochMs,
} from "@/lib/timezones"

const UNIT_OPTIONS = [
  "auto",
  "s",
  "ms",
  "us",
  "ns",
  "filetime",
  "ticks",
  "cocoa",
  "excel",
] as const satisfies readonly (TimestampUnit | "auto")[]

export function TimestampConverter() {
  // the timestamp, its unit and the target zone are the whole input, so they
  // live in the query string and a converted instant becomes a shareable link
  const [query, setQuery] = useQueryStates(
    {
      ts: parseAsString.withDefault(""),
      unit: parseAsStringLiteral(UNIT_OPTIONS).withDefault("auto"),
      tz: parseAsString.withDefault(""),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const raw = query.ts
  const unit = query.unit
  // an unset tz means "this browser": resolving it during ssr render would bake
  // one visitor's zone into the static html
  const [browserZone, setBrowserZone] = useState("UTC")
  // new Date() during render would differ between server and client html
  const [now, setNow] = useState<Date | null>(null)
  const [dateInput, setDateInput] = useState("")
  const [timeInput, setTimeInput] = useState("")

  // sc 2.2.2: an auto-updating clock needs a way to stop it
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    setBrowserZone(localTimeZone())
    setNow(new Date())
  }, [])

  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [paused])

  const timeZone = query.tz || browserZone
  const zones = useMemo(() => listTimeZones(), [])

  // the pickers write the timestamp field directly rather than through an
  // effect, so changing the zone can never silently rewrite what was typed
  const applyPickers = (date: string, time: string) => {
    setDateInput(date)
    setTimeInput(time)
    if (!date || !time) return
    const [y, mo, d] = date.split("-").map(Number)
    const [h, mi, s] = time.split(":").map(Number)
    if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return
    const epochMs = zonedTimeToEpochMs(
      { year: y, month: mo, day: d, hour: h, minute: mi, second: Number.isFinite(s) ? s : 0 },
      timeZone
    )
    void setQuery({ ts: Math.floor(epochMs / 1000).toString(), unit: "auto" })
  }

  const parsed = useMemo(() => parseTimestampInput(raw, { unit, timeZone }), [raw, unit, timeZone])

  const applyNow = () => {
    const current = new Date()
    // both pickers must come from the same wall clock, never a UTC date with a local time
    setDateInput(toLocalDateInputValue(current))
    setTimeInput(toLocalTimeInputValue(current))
    void setQuery({ ts: Math.floor(current.getTime() / 1000).toString(), unit: "auto" })
  }

  const presets = useMemo(() => {
    const base = [
      { label: "Unix Epoch", ts: 0, desc: "Jan 1, 1970 UTC" },
      { label: "Y2K", ts: 946684800, desc: "Jan 1, 2000 UTC" },
      { label: "2038 Problem", ts: 2147483647, desc: "Max 32-bit signed" },
      { label: "Apollo 11 landing", ts: -14182940, desc: "Negative timestamp" },
    ]
    if (!now) return base
    const nowSec = Math.floor(now.getTime() / 1000)
    return [
      ...base,
      {
        label: "Today Start",
        ts: Math.floor(startOfLocalDay(now).getTime() / 1000),
        desc: "Local midnight",
      },
      {
        label: "Tomorrow",
        // calendar arithmetic, not +86400, so dst days stay at midnight
        ts: Math.floor(startOfLocalDay(now, 1).getTime() / 1000),
        desc: "Next local midnight",
      },
      { label: "1 Hour Ago", ts: nowSec - 3600, desc: "Relative" },
      { label: "1 Week Ago", ts: nowSec - 604800, desc: "Relative" },
    ]
  }, [now])

  const nowOffset = now ? formatOffset(zoneOffsetMs(now.getTime(), timeZone)) : null

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Clock}
        title="Unix Timestamp Converter"
        description="Convert timestamps, ISO 8601 and date strings across any IANA timezone"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Current Time
                </CardTitle>
                <CardDescription>
                  {paused ? "Updates paused" : "Live updating timestamp"}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaused((v) => !v)}
                aria-pressed={paused}
              >
                {paused ? (
                  <Play className="mr-1 h-4 w-4" aria-hidden="true" />
                ) : (
                  <Pause className="mr-1 h-4 w-4" aria-hidden="true" />
                )}
                {paused ? "Resume updates" : "Pause updates"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-muted-foreground text-xs">Unix Timestamp (seconds)</p>
                  <p className="font-mono text-lg font-bold">
                    {now ? Math.floor(now.getTime() / 1000) : "--"}
                  </p>
                </div>
                {now && (
                  <CopyButton value={Math.floor(now.getTime() / 1000).toString()} size="sm" />
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-muted-foreground text-xs">Milliseconds</p>
                  <p className="font-mono text-lg font-bold">{now ? now.getTime() : "--"}</p>
                </div>
                {now && <CopyButton value={now.getTime().toString()} size="sm" />}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Selected zone ({timeZone})</p>
                <p className="font-mono text-sm">{now ? formatInZone(now, timeZone) : "--"}</p>
                {nowOffset && (
                  <Badge variant="outline" className="mt-2">
                    {nowOffset}
                  </Badge>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Browser zone ({browserZone})</p>
                <p className="font-mono text-sm">{now ? formatInZone(now, browserZone) : "--"}</p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">UTC / ISO 8601</p>
                <p className="font-mono text-sm">{now ? now.toISOString() : "--"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Convert</CardTitle>
            <CardDescription>
              Unix seconds/ms/µs/ns, Windows FILETIME, .NET ticks, Cocoa, Excel serial, ISO 8601 or
              an RFC 2822 date string
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timestamp">Timestamp or date</Label>
              <div className="flex gap-2">
                <Input
                  id="timestamp"
                  value={raw}
                  onChange={(e) => setQuery({ ts: e.target.value })}
                  placeholder="1609459200 or 2021-01-01T00:00:00Z"
                  className="font-mono"
                  aria-invalid={raw.trim() !== "" && !parsed.ok}
                />
                <Button variant="outline" onClick={applyNow} aria-label="Use current time">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unit">Numeric unit</Label>
                <Select
                  value={unit}
                  onValueChange={(v) => setQuery({ unit: v as TimestampUnit | "auto" })}
                >
                  <SelectTrigger id="unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect (s / ms / µs / ns)</SelectItem>
                    {TIMESTAMP_UNITS.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.autoDetectable ? u.label : `${u.label} (explicit only)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tz" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Timezone
                </Label>
                <Select value={timeZone} onValueChange={(v) => setQuery({ tz: v })}>
                  <SelectTrigger id="tz" className="w-full font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {zones.map((zone) => (
                      <SelectItem key={zone} value={zone} className="font-mono">
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-muted-foreground text-center text-sm">or</div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateInput}
                  onChange={(e) => applyPickers(e.target.value, timeInput)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  step="1"
                  value={timeInput}
                  onChange={(e) => applyPickers(dateInput, e.target.value)}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Date and time are read as wall-clock time in {timeZone}.
            </p>

            {raw.trim() !== "" && !parsed.ok && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{parsed.error}</AlertDescription>
              </Alert>
            )}

            {raw.trim() === "" && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Enter a timestamp or date, or press the refresh button for the current time.
                </AlertDescription>
              </Alert>
            )}

            {parsed.ok && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {parsed.kind === "numeric"
                      ? `${parsed.unit}${parsed.autoDetected ? " (auto-detected)" : ""}`
                      : parsed.kind === "iso"
                        ? "ISO 8601"
                        : "date string"}
                  </Badge>
                  {now && (
                    <Badge variant="secondary">
                      {formatRelativeToNow(parsed.epochMs, now.getTime())}
                    </Badge>
                  )}
                </div>
                {parsed.note && <p className="text-muted-foreground text-xs">{parsed.note}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {parsed.ok && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ResultCard
            title="Converted Date"
            data={[
              {
                label: `Selected zone (${timeZone})`,
                value: formatInZone(parsed.date, timeZone),
                highlight: true,
              },
              {
                label: `Browser zone (${browserZone})`,
                value: formatInZone(parsed.date, browserZone),
              },
              { label: "UTC", value: formatInZone(parsed.date, "UTC") },
              { label: "ISO 8601", value: parsed.date.toISOString() },
              { label: "RFC 2822", value: parsed.date.toUTCString() },
            ]}
          />
          <ResultCard
            title="Epoch Representations"
            description="Same instant expressed in every supported scale"
            data={TIMESTAMP_UNITS.map((u) => ({
              label: u.label,
              value: epochMsToUnitString(parsed.epochMs, u.id),
              description: u.hint,
            }))}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Common Timestamps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {presets.map((item) => (
              <button
                key={item.label}
                onClick={() => setQuery({ ts: item.ts.toString(), unit: "auto" })}
                className="hover:bg-muted/50 rounded-lg border p-3 text-left transition-colors"
              >
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-muted-foreground font-mono text-xs">{item.ts}</p>
                <p className="text-muted-foreground text-xs">{item.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Epoch Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Scale</th>
                  <th className="p-2 text-left">Epoch</th>
                  <th className="p-2 text-left">Resolution</th>
                  <th className="p-2 text-left">Seen in</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { scale: "Unix seconds", epoch: "1970-01-01", res: "1s", seen: "POSIX, JWT exp" },
                  { scale: "Unix ms", epoch: "1970-01-01", res: "1ms", seen: "JavaScript, Java" },
                  { scale: "Unix µs", epoch: "1970-01-01", res: "1µs", seen: "PostgreSQL, Chrome" },
                  {
                    scale: "Unix ns",
                    epoch: "1970-01-01",
                    res: "1ns",
                    seen: "Go, Prometheus, Cassandra",
                  },
                  {
                    scale: "Windows FILETIME",
                    epoch: "1601-01-01",
                    res: "100ns",
                    seen: "Win32, AD, event logs",
                  },
                  {
                    scale: ".NET ticks",
                    epoch: "0001-01-01",
                    res: "100ns",
                    seen: "DateTime.Ticks",
                  },
                  {
                    scale: "Apple/Cocoa",
                    epoch: "2001-01-01",
                    res: "1s",
                    seen: "macOS, iOS plists",
                  },
                  {
                    scale: "Excel serial",
                    epoch: "1899-12-30",
                    res: "1 day",
                    seen: "Excel, CSV exports",
                  },
                ].map((row) => (
                  <tr key={row.scale} className="border-b">
                    <td className="p-2 font-medium">{row.scale}</td>
                    <td className="p-2 font-mono">{row.epoch}</td>
                    <td className="p-2 font-mono">{row.res}</td>
                    <td className="text-muted-foreground p-2">{row.seen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "Minute", value: 60 },
              { label: "Hour", value: 3600 },
              { label: "Day", value: 86400 },
              { label: "Week", value: 604800 },
              { label: "Month (30d)", value: 2592000 },
              { label: "Year (365d)", value: 31536000 },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-3 text-center">
                <p className="font-mono text-lg font-bold">{item.value.toLocaleString()}</p>
                <p className="text-muted-foreground text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
