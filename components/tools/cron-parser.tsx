"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Timer, CheckCircle2, XCircle, Calendar, Globe, AlertTriangle } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { analyzeCron, CRON_MACROS, formatRelativeMs } from "@/lib/cron"
import { formatInZone, listTimeZones, localTimeZone } from "@/lib/timezones"

const RUN_COUNT = 8

const PRESETS = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Every 30 seconds", cron: "*/30 * * * * *" },
  { label: "Hourly", cron: "0 * * * *" },
  { label: "Daily at midnight", cron: "@daily" },
  { label: "Weekdays at 09:00", cron: "0 9 * * 1-5" },
  { label: "Weekends at 09:00", cron: "0 9 * * SAT,SUN" },
  { label: "Sunday via alias 7", cron: "0 9 * * 7" },
  { label: "1st of the month", cron: "0 0 1 * *" },
  { label: "Last day of the month", cron: "0 0 L * *" },
  { label: "3rd Friday of the month", cron: "0 0 * * 5#3" },
  { label: "Nearest weekday to the 15th", cron: "0 0 15W * *" },
  { label: "Overnight window (wraps)", cron: "0 22-2 * * *" },
  { label: "Quarterly", cron: "0 0 1 JAN,APR,JUL,OCT *" },
  { label: "On startup", cron: "@reboot" },
]

export function CronParser() {
  const [expression, setExpression] = useState("0 9 * * 1-5")
  const [timeZone, setTimeZone] = useState("UTC")
  // next-run projection depends on "now", so it must not run during ssr render
  const [from, setFrom] = useState<Date | null>(null)

  useEffect(() => {
    setTimeZone(localTimeZone())
    setFrom(new Date())
    const interval = setInterval(() => setFrom(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  const zones = useMemo(() => listTimeZones(), [])

  const result = useMemo(
    () => analyzeCron(expression, { timeZone, count: RUN_COUNT, from }),
    [expression, timeZone, from]
  )

  const trimmed = expression.trim()

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Timer}
        title="Cron Expression Parser"
        description="Describe cron expressions and project their next runs in any timezone"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Cron Expression
              {trimmed &&
                (result.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                ))}
            </CardTitle>
            <CardDescription>
              5, 6 (with seconds) or 7 (with year) fields, or an @macro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cron">Expression</Label>
              <div className="flex gap-2">
                <Input
                  id="cron"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="*/5 * * * *"
                  className="font-mono text-lg"
                  aria-invalid={trimmed !== "" && !result.valid}
                />
                <CopyButton value={expression} variant="outline" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron-tz" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Timezone
              </Label>
              <Select value={timeZone} onValueChange={setTimeZone}>
                <SelectTrigger id="cron-tz" className="w-full font-mono">
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
              <p className="text-muted-foreground text-xs">
                Runs are computed in this IANA zone, so DST shifts are honoured instead of
                duplicating or skipping runs.
              </p>
            </div>

            {result.valid && result.description && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-lg font-medium">{result.description}</p>
              </div>
            )}

            {trimmed !== "" && !result.valid && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{result.error ?? "Invalid cron expression"}</AlertDescription>
              </Alert>
            )}

            {trimmed === "" && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Enter a cron expression to get started.</AlertDescription>
              </Alert>
            )}

            {result.valid && result.runsError && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{result.runsError}</AlertDescription>
              </Alert>
            )}

            {result.fields.length > 0 && (
              <div className="space-y-2">
                <Label>Field Breakdown</Label>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${result.fields.length}, minmax(0, 1fr))` }}
                >
                  {result.fields.map((field) => (
                    <div key={field.role} className="text-center">
                      <div className="bg-muted/50 truncate rounded border p-2 font-mono text-sm">
                        {field.value}
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">{field.short}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-2">
                  {result.fields.map((field) => (
                    <div
                      key={field.role}
                      className="flex items-center justify-between gap-2 rounded border p-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {field.label}
                        </Badge>
                        <span className="truncate font-mono text-sm">{field.value}</span>
                      </div>
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {field.range}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.macro && result.valid && (
              <div className="rounded border p-2 text-sm">
                <Badge variant="outline" className="mr-2 font-mono">
                  macro
                </Badge>
                Shorthand expression - no field breakdown
              </div>
            )}

            {result.normalized !== trimmed && result.valid && (
              <p className="text-muted-foreground text-xs">
                Wrap-around range expanded for scheduling:{" "}
                <code className="font-mono">{result.normalized}</code>
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Next Runs
              </CardTitle>
              <CardDescription>
                Next {RUN_COUNT} executions in {timeZone} and UTC
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.runs.length > 0 ? (
                <div className="space-y-2">
                  {result.runs.map((run, i) => (
                    <div key={run.date.toISOString()} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm">
                          {formatInZone(run.date, timeZone)}
                        </span>
                        {i === 0 && <Badge>Next</Badge>}
                      </div>
                      <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono">{run.date.toISOString()}</span>
                        <span>{formatRelativeMs(run.inMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {from === null
                    ? "Loading schedule..."
                    : (result.runsError ?? "Enter a valid cron expression to see next runs")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Presets</CardTitle>
              <CardDescription>Including the extensions cron implementations add</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.cron}
                    onClick={() => setExpression(preset.cron)}
                    className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg border p-2 text-left transition-colors"
                  >
                    <span className="text-sm">{preset.label}</span>
                    <code className="text-muted-foreground font-mono text-xs">{preset.cron}</code>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cron Syntax Reference</CardTitle>
          <CardDescription>
            Day-of-month and day-of-week are OR-ed, as POSIX cron specifies: when both are
            restricted, either match fires the job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Field</th>
                  <th className="p-2 text-left">Values</th>
                  <th className="p-2 text-left">Special Characters</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { field: "Second (6/7-field only)", values: "0-59", special: "* , - /" },
                  { field: "Minute", values: "0-59", special: "* , - /" },
                  { field: "Hour", values: "0-23", special: "* , - /" },
                  { field: "Day of Month", values: "1-31", special: "* , - / L W ?" },
                  { field: "Month", values: "1-12 or JAN-DEC", special: "* , - /" },
                  {
                    field: "Day of Week",
                    values: "0-7 or SUN-SAT (0 and 7 are Sunday)",
                    special: "* , - / # L ?",
                  },
                  { field: "Year (7-field only)", values: "1970-2099", special: "* , - /" },
                ].map((row) => (
                  <tr key={row.field} className="border-b">
                    <td className="p-2 font-medium">{row.field}</td>
                    <td className="p-2 font-mono">{row.values}</td>
                    <td className="p-2 font-mono">{row.special}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { char: "*", desc: "Any value" },
              { char: ",", desc: "Value list (1,3,5)" },
              { char: "-", desc: "Range (1-5), wraps (22-2)" },
              { char: "/", desc: "Step (*/15)" },
              { char: "L", desc: "Last (0 0 L * *)" },
              { char: "W", desc: "Nearest weekday (15W)" },
              { char: "#", desc: "Nth weekday (5#3)" },
              { char: "?", desc: "No specific value" },
            ].map((item) => (
              <div key={item.char} className="rounded border p-2 text-center">
                <code className="text-lg font-bold">{item.char}</code>
                <p className="text-muted-foreground text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(CRON_MACROS).map(([macro, equivalent]) => (
              <button
                key={macro}
                onClick={() => setExpression(macro)}
                className="bg-muted hover:bg-muted/60 rounded px-2 py-1 text-center font-mono text-xs transition-colors"
              >
                {macro}
                <span className="text-muted-foreground block">{equivalent || "event-based"}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
