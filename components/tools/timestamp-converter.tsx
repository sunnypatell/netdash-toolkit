"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Clock, RefreshCw, Calendar } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { ResultCard } from "@/components/ui/result-card"

export function TimestampConverter() {
  const [timestamp, setTimestamp] = useState("")
  const [dateInput, setDateInput] = useState("")
  const [timeInput, setTimeInput] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [converted, setConverted] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Convert timestamp to date
  useEffect(() => {
    if (!timestamp.trim()) {
      setConverted(null)
      setError(null)
      return
    }

    const num = parseInt(timestamp, 10)
    if (isNaN(num)) {
      setError("Invalid timestamp")
      setConverted(null)
      return
    }

    // Auto-detect milliseconds vs seconds
    let date: Date
    if (num > 9999999999999) {
      // Microseconds
      date = new Date(num / 1000)
    } else if (num > 9999999999) {
      // Milliseconds
      date = new Date(num)
    } else {
      // Seconds
      date = new Date(num * 1000)
    }

    if (isNaN(date.getTime())) {
      setError("Invalid timestamp")
      setConverted(null)
    } else {
      setError(null)
      setConverted(date)
    }
  }, [timestamp])

  // Convert date/time inputs to timestamp
  useEffect(() => {
    if (dateInput && timeInput) {
      const date = new Date(`${dateInput}T${timeInput}`)
      if (!isNaN(date.getTime())) {
        setTimestamp(Math.floor(date.getTime() / 1000).toString())
      }
    }
  }, [dateInput, timeInput])

  const setNow = () => {
    const now = new Date()
    setTimestamp(Math.floor(now.getTime() / 1000).toString())
    setDateInput(now.toISOString().split("T")[0])
    setTimeInput(now.toTimeString().split(" ")[0])
  }

  const formatTimezone = (date: Date) => {
    const offset = -date.getTimezoneOffset()
    const hours = Math.floor(Math.abs(offset) / 60)
    const minutes = Math.abs(offset) % 60
    const sign = offset >= 0 ? "+" : "-"
    return `UTC${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  }

  const currentTimestamp = Math.floor(currentTime.getTime() / 1000)
  const currentMs = currentTime.getTime()

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Clock}
        title="Unix Timestamp Converter"
        description="Convert between Unix timestamps and human-readable dates"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Time
            </CardTitle>
            <CardDescription>Live updating timestamp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-muted-foreground text-xs">Unix Timestamp (seconds)</p>
                  <p className="font-mono text-lg font-bold">{currentTimestamp}</p>
                </div>
                <CopyButton value={currentTimestamp.toString()} size="sm" />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-muted-foreground text-xs">Milliseconds</p>
                  <p className="font-mono text-lg font-bold">{currentMs}</p>
                </div>
                <CopyButton value={currentMs.toString()} size="sm" />
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">Local Time</p>
                <p className="font-mono text-lg">
                  {currentTime.toLocaleString("en-US", {
                    dateStyle: "full",
                    timeStyle: "medium",
                  })}
                </p>
                <Badge variant="outline" className="mt-2">
                  {formatTimezone(currentTime)}
                </Badge>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">UTC / ISO 8601</p>
                <p className="font-mono text-sm">{currentTime.toISOString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Convert Timestamp</CardTitle>
            <CardDescription>Enter a Unix timestamp or select a date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timestamp">Unix Timestamp</Label>
              <div className="flex gap-2">
                <Input
                  id="timestamp"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  placeholder="1609459200"
                  className="font-mono"
                />
                <Button variant="outline" onClick={setNow}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Supports seconds, milliseconds, and microseconds
              </p>
            </div>

            <div className="text-muted-foreground text-center text-sm">or</div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  step="1"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {converted && !error && (
              <ResultCard
                title="Converted Date"
                data={[
                  {
                    label: "Local",
                    value: converted.toLocaleString("en-US", {
                      dateStyle: "full",
                      timeStyle: "medium",
                    }),
                    highlight: true,
                  },
                  { label: "UTC", value: converted.toUTCString() },
                  { label: "ISO 8601", value: converted.toISOString() },
                  { label: "Unix (s)", value: Math.floor(converted.getTime() / 1000).toString() },
                  { label: "Unix (ms)", value: converted.getTime().toString() },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common Timestamps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Unix Epoch", ts: 0, desc: "Jan 1, 1970" },
              { label: "Y2K", ts: 946684800, desc: "Jan 1, 2000" },
              { label: "2038 Problem", ts: 2147483647, desc: "Max 32-bit signed" },
              {
                label: "Today Start",
                ts: Math.floor(new Date().setHours(0, 0, 0, 0) / 1000),
                desc: "Midnight today",
              },
              {
                label: "Tomorrow",
                ts: Math.floor(new Date().setHours(0, 0, 0, 0) / 1000) + 86400,
                desc: "Midnight tomorrow",
              },
              { label: "1 Hour Ago", ts: currentTimestamp - 3600, desc: "Relative" },
              { label: "1 Day Ago", ts: currentTimestamp - 86400, desc: "Relative" },
              { label: "1 Week Ago", ts: currentTimestamp - 604800, desc: "Relative" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setTimestamp(item.ts.toString())}
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
          <CardTitle>Time Units in Seconds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
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
