"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

type Period = "day" | "week" | "month" | "year"

interface SLALevel {
  nines: string
  percentage: number
  label: string
  typical: string
}

const SLA_LEVELS: SLALevel[] = [
  { nines: "1", percentage: 90, label: "One Nine", typical: "Internal tools" },
  { nines: "2", percentage: 99, label: "Two Nines", typical: "Basic hosting" },
  { nines: "3", percentage: 99.9, label: "Three Nines", typical: "Standard SaaS" },
  { nines: "4", percentage: 99.99, label: "Four Nines", typical: "Enterprise" },
  { nines: "5", percentage: 99.999, label: "Five Nines", typical: "Carrier-grade" },
  { nines: "6", percentage: 99.9999, label: "Six Nines", typical: "Mission critical" },
]

const PERIOD_MINUTES: Record<Period, number> = {
  day: 24 * 60,
  week: 7 * 24 * 60,
  month: 30 * 24 * 60,
  year: 365 * 24 * 60,
}

const formatDowntime = (minutes: number): string => {
  if (minutes < 1) {
    return (minutes * 60).toFixed(2) + " seconds"
  }
  if (minutes < 60) {
    return minutes.toFixed(2) + " minutes"
  }
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return hours + "h " + mins + "m"
  }
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.round((minutes % (24 * 60)) / 60)
  return days + "d " + hours + "h"
}

export function UptimeCalculator() {
  const [uptime, setUptime] = useState("99.9")
  const [period, setPeriod] = useState<Period>("month")

  const results = useMemo(() => {
    const uptimePercent = parseFloat(uptime)
    if (isNaN(uptimePercent) || uptimePercent < 0 || uptimePercent > 100) return null

    const totalMinutes = PERIOD_MINUTES[period]
    const downtimeMinutes = totalMinutes * (1 - uptimePercent / 100)
    const uptimeMinutes = totalMinutes - downtimeMinutes

    // Find matching SLA level
    let slaLevel: SLALevel | null = null
    for (const level of SLA_LEVELS) {
      if (uptimePercent >= level.percentage) {
        slaLevel = level
      }
    }

    // Calculate all periods
    const periods = {
      day: PERIOD_MINUTES.day * (1 - uptimePercent / 100),
      week: PERIOD_MINUTES.week * (1 - uptimePercent / 100),
      month: PERIOD_MINUTES.month * (1 - uptimePercent / 100),
      year: PERIOD_MINUTES.year * (1 - uptimePercent / 100),
    }

    return {
      uptimePercent,
      downtimeMinutes,
      uptimeMinutes,
      downtimeFormatted: formatDowntime(downtimeMinutes),
      slaLevel,
      periods,
    }
  }, [uptime, period])

  const getPeriodLabel = (p: Period) => {
    const labels: Record<Period, string> = {
      day: "Day",
      week: "Week",
      month: "Month (30d)",
      year: "Year (365d)",
    }
    return labels[p]
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Clock}
        title="Uptime Calculator"
        description="Calculate allowed downtime based on SLA percentage"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>SLA Input</CardTitle>
            <CardDescription>Enter uptime percentage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="uptime">Uptime Percentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="uptime"
                  type="number"
                  value={uptime}
                  onChange={(e) => setUptime(e.target.value)}
                  min={0}
                  max={100}
                  step={0.001}
                  className="font-mono"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>

            <div>
              <Label>Time Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Per Day</SelectItem>
                  <SelectItem value="week">Per Week</SelectItem>
                  <SelectItem value="month">Per Month (30 days)</SelectItem>
                  <SelectItem value="year">Per Year (365 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs">Quick Select</p>
              <div className="grid grid-cols-3 gap-2">
                {SLA_LEVELS.slice(1, 6).map((level) => (
                  <Badge
                    key={level.nines}
                    variant="outline"
                    className="cursor-pointer justify-center"
                    onClick={() => setUptime(level.percentage.toString())}
                  >
                    {level.percentage}%
                  </Badge>
                ))}
              </div>
            </div>

            {results && results.slaLevel && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{results.slaLevel.label}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{results.slaLevel.typical}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Allowed Downtime</CardTitle>
            <CardDescription>Maximum downtime to maintain {uptime}% SLA</CardDescription>
          </CardHeader>
          <CardContent>
            {results ? (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-5xl font-bold">{results.downtimeFormatted}</p>
                  <p className="text-muted-foreground mt-2">
                    per {getPeriodLabel(period).toLowerCase()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {(Object.entries(results.periods) as [Period, number][]).map(([p, mins]) => (
                    <div
                      key={p}
                      className={
                        "rounded-lg border p-3 text-center " +
                        (p === period ? "border-primary bg-primary/5" : "")
                      }
                    >
                      <p className="text-muted-foreground text-xs">{getPeriodLabel(p)}</p>
                      <p className="font-mono text-sm font-medium">{formatDowntime(mins)}</p>
                    </div>
                  ))}
                </div>

                {results.uptimePercent < 99 && (
                  <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950/20">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      This uptime level is below typical production standards. Most SaaS products
                      target 99.9% or higher.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">Enter a valid uptime percentage (0-100)</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SLA Reference</CardTitle>
          <CardDescription>Common availability levels and their allowed downtime</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Level</th>
                  <th className="p-2 text-left font-medium">Uptime %</th>
                  <th className="p-2 text-left font-medium">Downtime/Year</th>
                  <th className="p-2 text-left font-medium">Downtime/Month</th>
                  <th className="p-2 text-left font-medium">Typical Use</th>
                </tr>
              </thead>
              <tbody>
                {SLA_LEVELS.map((level) => (
                  <tr key={level.nines} className="hover:bg-muted/50 border-b">
                    <td className="p-2">
                      <Badge variant="secondary">{level.label}</Badge>
                    </td>
                    <td className="p-2 font-mono">{level.percentage}%</td>
                    <td className="p-2 font-mono">
                      {formatDowntime(PERIOD_MINUTES.year * (1 - level.percentage / 100))}
                    </td>
                    <td className="p-2 font-mono">
                      {formatDowntime(PERIOD_MINUTES.month * (1 - level.percentage / 100))}
                    </td>
                    <td className="text-muted-foreground p-2">{level.typical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
