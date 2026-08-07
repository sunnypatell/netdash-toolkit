"use client"

import { useMemo } from "react"
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
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import {
  SLA_LEVELS,
  UPTIME_PERIODS,
  analyzeUptime,
  downtimeSeconds,
  findPeriod,
  formatDowntime,
  type UptimePeriod,
} from "@/lib/uptime"

const PERIOD_IDS = UPTIME_PERIODS.map((p) => p.id) as [UptimePeriod, ...UptimePeriod[]]

export function UptimeCalculator() {
  const [query, setQuery] = useQueryStates(
    {
      uptime: parseAsString.withDefault("99.9"),
      period: parseAsStringLiteral(PERIOD_IDS).withDefault("month"),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const { uptime, period } = query
  const periodMeta = findPeriod(period)!

  // downtime is a pure function of a percentage and a period length, so the
  // figures follow the input rather than waiting on a Calculate button
  const results = useMemo(() => analyzeUptime(Number.parseFloat(uptime)), [uptime])

  const selected = results?.byPeriod.find((entry) => entry.period.id === period) ?? null
  const invalid = uptime.trim() !== "" && results === null

  // the whole budget, not just the selected period, so a paste carries the table
  const budgetText = results
    ? [
        `${results.availabilityPercent}% availability`,
        ...results.byPeriod.map(
          (entry) => `Per ${entry.period.label.toLowerCase()}: ${formatDowntime(entry.seconds)}`
        ),
      ].join("\n")
    : ""

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Clock}
        title="Uptime Calculator"
        description="Turn an availability percentage into the downtime budget it actually allows"
      />

      {invalid && (
        <Alert variant="destructive">
          <AlertDescription id="uptime-error">
            Enter an availability percentage between 0 and 100.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>SLA input</CardTitle>
            <CardDescription>Availability the service promises</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uptime">Uptime percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="uptime"
                  type="number"
                  inputMode="decimal"
                  value={uptime}
                  onChange={(e) => setQuery({ uptime: e.target.value })}
                  min={0}
                  max={100}
                  step="any"
                  className="font-mono"
                  aria-invalid={invalid}
                  aria-describedby={invalid ? "uptime-error" : undefined}
                />
                <span className="text-muted-foreground" aria-hidden="true">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="period">Time period</Label>
              <Select value={period} onValueChange={(v) => setQuery({ period: v as UptimePeriod })}>
                <SelectTrigger id="period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UPTIME_PERIODS.map((meta) => (
                    <SelectItem key={meta.id} value={meta.id}>
                      Per {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {periodMeta.days} days, {periodMeta.seconds.toLocaleString("en-US")} seconds. Every
                figure below is derived from that exact length.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs">Quick select</p>
              <div className="grid grid-cols-3 gap-2">
                {SLA_LEVELS.filter((level) => !level.nines.includes(".")).map((level) => (
                  <Button
                    key={level.nines}
                    variant="outline"
                    size="sm"
                    className="font-mono"
                    onClick={() => setQuery({ uptime: level.percentage.toString() })}
                  >
                    {level.percentage}%
                  </Button>
                ))}
              </div>
            </div>

            {results && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  {results.level ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                  <span className="text-sm font-medium">
                    {results.level ? results.level.label : "Below one nine"}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {results.level
                    ? results.level.typical
                    : "Under 90% availability, which no standard tier describes"}
                </p>
                <p className="font-mono text-xs">
                  {Number.isFinite(results.nines)
                    ? `${results.nines.toFixed(2)} nines`
                    : "no downtime at all"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Allowed downtime
              {results && <CopyButton value={budgetText} />}
            </CardTitle>
            <CardDescription>
              {results
                ? `Maximum outage that still meets ${results.availabilityPercent}% availability`
                : "Enter an availability percentage"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results && selected ? (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="font-mono text-4xl font-bold sm:text-5xl">
                    {formatDowntime(selected.seconds)}
                  </p>
                  <p className="text-muted-foreground mt-2">per {periodMeta.label.toLowerCase()}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  {results.byPeriod.map((entry) => (
                    <div
                      key={entry.period.id}
                      className={
                        "rounded-lg border p-3 text-center " +
                        (entry.period.id === period ? "border-primary bg-primary/5" : "")
                      }
                    >
                      <p className="text-muted-foreground text-xs">{entry.period.label}</p>
                      <p className="font-mono text-sm font-medium">
                        {formatDowntime(entry.seconds)}
                      </p>
                    </div>
                  ))}
                </div>

                {results.availabilityPercent < 99 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Below 99% availability. Most production SaaS targets 99.9% or higher, so this
                      budget is unusually generous.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                Enter an availability percentage between 0 and 100 - the downtime budget appears
                here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SLA reference</CardTitle>
          <CardDescription>
            Downtime allowances per availability level. The nines column is -log10(1 -
            availability), so it always matches the percentage next to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-2 text-left font-medium">
                    Level
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Uptime %
                  </th>
                  {UPTIME_PERIODS.map((meta) => (
                    <th key={meta.id} scope="col" className="p-2 text-left font-medium">
                      Per {meta.label}
                    </th>
                  ))}
                  <th scope="col" className="p-2 text-left font-medium">
                    Typical use
                  </th>
                </tr>
              </thead>
              <tbody>
                {SLA_LEVELS.map((level) => (
                  <tr key={level.nines} className="hover:bg-muted/50 border-b">
                    <td className="p-2">
                      <Badge variant="secondary">{level.label}</Badge>
                    </td>
                    <td className="p-2 font-mono">{level.percentage}%</td>
                    {UPTIME_PERIODS.map((meta) => (
                      <td key={meta.id} className="p-2 font-mono whitespace-nowrap">
                        {formatDowntime(downtimeSeconds(level.percentage, meta.seconds))}
                      </td>
                    ))}
                    <td className="text-muted-foreground p-2">{level.typical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            A month here is 30 days and a year is 365, stated rather than assumed. Vendors quoting
            8h 45m 57s per year for three nines are using a 365.25 day Julian year; the same
            percentage against 365 days is 8h 45m 36s.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
