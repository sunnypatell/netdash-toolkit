"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Timer, CheckCircle2, XCircle, Calendar } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"

interface CronPart {
  field: string
  value: string
  description: string
  valid: boolean
  range: string
}

interface CronResult {
  valid: boolean
  description: string
  parts: CronPart[]
  nextRuns: Date[]
}

function parseValue(value: string, min: number, max: number): number[] | null {
  const results: number[] = []

  if (value === "*") {
    for (let i = min; i <= max; i++) results.push(i)
    return results
  }

  const parts = value.split(",")
  for (const part of parts) {
    // Handle step values (*/5, 1-10/2)
    const [range, stepStr] = part.split("/")
    const step = stepStr ? parseInt(stepStr, 10) : 1
    if (isNaN(step) || step < 1) return null

    if (range === "*") {
      for (let i = min; i <= max; i += step) results.push(i)
    } else if (range.includes("-")) {
      const [startStr, endStr] = range.split("-")
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) return null
      for (let i = start; i <= end; i += step) results.push(i)
    } else {
      const num = parseInt(range, 10)
      if (isNaN(num) || num < min || num > max) return null
      results.push(num)
    }
  }

  return [...new Set(results)].sort((a, b) => a - b)
}

function describeField(field: string, value: string, values: number[] | null): string {
  if (value === "*") return `every ${field}`
  if (!values || values.length === 0) return "invalid"
  if (value.includes("/")) {
    const step = value.split("/")[1]
    return `every ${step} ${field}${parseInt(step) > 1 ? "s" : ""}`
  }
  if (values.length === 1) return `at ${field} ${values[0]}`
  if (values.length <= 3) return `at ${field}s ${values.join(", ")}`
  return `${values.length} specific ${field}s`
}

function parseCron(expression: string): CronResult {
  const parts = expression.trim().split(/\s+/)

  if (parts.length !== 5) {
    return {
      valid: false,
      description: "Invalid cron expression. Expected 5 fields: minute hour day month weekday",
      parts: [],
      nextRuns: [],
    }
  }

  const fields = [
    { name: "minute", min: 0, max: 59, range: "0-59" },
    { name: "hour", min: 0, max: 23, range: "0-23" },
    { name: "day", min: 1, max: 31, range: "1-31" },
    { name: "month", min: 1, max: 12, range: "1-12" },
    { name: "weekday", min: 0, max: 6, range: "0-6 (Sun-Sat)" },
  ]

  const cronParts: CronPart[] = []
  const parsedValues: (number[] | null)[] = []
  let allValid = true

  for (let i = 0; i < 5; i++) {
    const values = parseValue(parts[i], fields[i].min, fields[i].max)
    parsedValues.push(values)
    const valid = values !== null
    if (!valid) allValid = false

    cronParts.push({
      field: fields[i].name,
      value: parts[i],
      description: describeField(fields[i].name, parts[i], values),
      valid,
      range: fields[i].range,
    })
  }

  // Generate human description
  let description = ""
  if (allValid) {
    const [min, hour, day, month, weekday] = parts

    if (expression === "* * * * *") {
      description = "Every minute"
    } else if (min !== "*" && hour !== "*" && day === "*" && month === "*" && weekday === "*") {
      description = `At ${hour.padStart(2, "0")}:${min.padStart(2, "0")} every day`
    } else if (min !== "*" && hour === "*" && day === "*" && month === "*" && weekday === "*") {
      description = `At minute ${min} of every hour`
    } else if (min === "0" && hour === "0" && day === "*" && month === "*" && weekday === "*") {
      description = "At midnight every day"
    } else if (min === "0" && hour === "0" && day === "1" && month === "*" && weekday === "*") {
      description = "At midnight on the 1st of every month"
    } else if (weekday !== "*" && day === "*") {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      const dayValues = parsedValues[4] || []
      const dayNames = dayValues.map((d) => days[d]).join(", ")
      description = `At ${hour.padStart(2, "0")}:${min.padStart(2, "0")} on ${dayNames}`
    } else {
      description = cronParts.map((p) => p.description).join(", ")
    }
  } else {
    description = "Invalid cron expression"
  }

  // Calculate next runs
  const nextRuns: Date[] = []
  if (allValid) {
    const now = new Date()
    let check = new Date(now)
    check.setSeconds(0)
    check.setMilliseconds(0)

    const [minutes, hours, days, months, weekdays] = parsedValues as number[][]

    for (let i = 0; i < 1000 && nextRuns.length < 5; i++) {
      check = new Date(check.getTime() + 60000) // Add 1 minute

      if (
        minutes.includes(check.getMinutes()) &&
        hours.includes(check.getHours()) &&
        days.includes(check.getDate()) &&
        months.includes(check.getMonth() + 1) &&
        weekdays.includes(check.getDay())
      ) {
        nextRuns.push(new Date(check))
      }
    }
  }

  return { valid: allValid, description, parts: cronParts, nextRuns }
}

export function CronParser() {
  const [expression, setExpression] = useState("0 9 * * 1-5")

  const result = useMemo(() => parseCron(expression), [expression])

  const presets = [
    { label: "Every minute", cron: "* * * * *" },
    { label: "Every hour", cron: "0 * * * *" },
    { label: "Every day at midnight", cron: "0 0 * * *" },
    { label: "Every day at 9 AM", cron: "0 9 * * *" },
    { label: "Weekdays at 9 AM", cron: "0 9 * * 1-5" },
    { label: "Every Monday at 9 AM", cron: "0 9 * * 1" },
    { label: "1st of every month", cron: "0 0 1 * *" },
    { label: "Every 15 minutes", cron: "*/15 * * * *" },
    { label: "Every 6 hours", cron: "0 */6 * * *" },
    { label: "Twice daily (9 AM & 6 PM)", cron: "0 9,18 * * *" },
  ]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Timer}
        title="Cron Expression Parser"
        description="Parse and understand cron expressions"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Cron Expression
              {expression.trim() &&
                (result.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                ))}
            </CardTitle>
            <CardDescription>Enter a 5-field cron expression</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cron">Expression</Label>
              <div className="flex gap-2">
                <Input
                  id="cron"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="* * * * *"
                  className="font-mono text-lg"
                />
                <CopyButton value={expression} variant="outline" />
              </div>
            </div>

            {result.valid && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-lg font-medium">{result.description}</p>
              </div>
            )}

            {!result.valid && expression.trim() && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{result.description}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Field Breakdown</Label>
              <div className="grid grid-cols-5 gap-2">
                {["MIN", "HOUR", "DAY", "MON", "DOW"].map((label, i) => (
                  <div key={label} className="text-center">
                    <div
                      className={`rounded border p-2 font-mono text-sm ${
                        result.parts[i]?.valid === false
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : "bg-muted/50"
                      }`}
                    >
                      {expression.split(/\s+/)[i] || "-"}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.parts.length > 0 && (
              <div className="space-y-2">
                {result.parts.map((part, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded border p-2 ${
                      !part.valid ? "border-red-500 bg-red-50 dark:bg-red-900/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {part.field}
                      </Badge>
                      <span className="text-sm">{part.description}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{part.range}</span>
                  </div>
                ))}
              </div>
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
              <CardDescription>Next 5 scheduled executions</CardDescription>
            </CardHeader>
            <CardContent>
              {result.nextRuns.length > 0 ? (
                <div className="space-y-2">
                  {result.nextRuns.map((date, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="font-mono text-sm">
                        {date.toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {i === 0 && <Badge>Next</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  Enter a valid cron expression to see next runs
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.cron}
                    onClick={() => setExpression(preset.cron)}
                    className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-2 text-left transition-colors"
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
                  { field: "Minute", values: "0-59", special: "* , - /" },
                  { field: "Hour", values: "0-23", special: "* , - /" },
                  { field: "Day of Month", values: "1-31", special: "* , - /" },
                  { field: "Month", values: "1-12", special: "* , - /" },
                  { field: "Day of Week", values: "0-6 (0=Sun)", special: "* , - /" },
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
              { char: "-", desc: "Range (1-5)" },
              { char: "/", desc: "Step (*/15)" },
            ].map((item) => (
              <div key={item.char} className="rounded border p-2 text-center">
                <code className="text-lg font-bold">{item.char}</code>
                <p className="text-muted-foreground text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
