"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Clock, HardDrive, Gauge, ArrowRight, RefreshCw } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { ResultCard } from "@/components/ui/result-card"

type SizeUnit = "B" | "KB" | "MB" | "GB" | "TB" | "PB"
type SpeedUnit = "bps" | "Kbps" | "Mbps" | "Gbps" | "Bps" | "KBps" | "MBps" | "GBps"
type TimeUnit = "seconds" | "minutes" | "hours" | "days"

const SIZE_MULTIPLIERS: Record<SizeUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
  PB: 1024 ** 5,
}

const SPEED_TO_BPS: Record<SpeedUnit, number> = {
  bps: 1,
  Kbps: 1000,
  Mbps: 1000000,
  Gbps: 1000000000,
  Bps: 8,
  KBps: 8000,
  MBps: 8000000,
  GBps: 8000000000,
}

const TIME_TO_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
}

export function BandwidthCalculator() {
  // Transfer Time Calculator
  const [fileSize, setFileSize] = useState("1")
  const [fileSizeUnit, setFileSizeUnit] = useState<SizeUnit>("GB")
  const [transferSpeed, setTransferSpeed] = useState("100")
  const [transferSpeedUnit, setTransferSpeedUnit] = useState<SpeedUnit>("Mbps")
  const [overhead, setOverhead] = useState("10") // Protocol overhead percentage

  // Download Size Calculator
  const [downloadTime, setDownloadTime] = useState("1")
  const [downloadTimeUnit, setDownloadTimeUnit] = useState<TimeUnit>("hours")
  const [downloadSpeed, setDownloadSpeed] = useState("100")
  const [downloadSpeedUnit, setDownloadSpeedUnit] = useState<SpeedUnit>("Mbps")

  // Speed Converter
  const [convertValue, setConvertValue] = useState("100")
  const [convertFromUnit, setConvertFromUnit] = useState<SpeedUnit>("Mbps")

  // Calculate transfer time
  const transferTimeResult = useMemo(() => {
    const sizeBytes = (parseFloat(fileSize) || 0) * SIZE_MULTIPLIERS[fileSizeUnit]
    const sizeBits = sizeBytes * 8
    const speedBps = (parseFloat(transferSpeed) || 1) * SPEED_TO_BPS[transferSpeedUnit]
    const overheadPercent = (parseFloat(overhead) || 0) / 100

    // Effective speed after overhead
    const effectiveSpeed = speedBps * (1 - overheadPercent)

    const totalSeconds = sizeBits / effectiveSpeed

    // Format time
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)

    let formatted = ""
    if (days > 0) formatted += `${days}d `
    if (hours > 0 || days > 0) formatted += `${hours}h `
    if (minutes > 0 || hours > 0 || days > 0) formatted += `${minutes}m `
    formatted += `${seconds}s`

    return {
      totalSeconds,
      formatted: formatted.trim(),
      days,
      hours,
      minutes,
      seconds,
      effectiveSpeedMbps: effectiveSpeed / 1000000,
    }
  }, [fileSize, fileSizeUnit, transferSpeed, transferSpeedUnit, overhead])

  // Calculate download size
  const downloadSizeResult = useMemo(() => {
    const timeSeconds = (parseFloat(downloadTime) || 0) * TIME_TO_SECONDS[downloadTimeUnit]
    const speedBps = (parseFloat(downloadSpeed) || 1) * SPEED_TO_BPS[downloadSpeedUnit]

    const totalBits = speedBps * timeSeconds
    const totalBytes = totalBits / 8

    // Find best unit
    let value = totalBytes
    let unit: SizeUnit = "B"

    if (totalBytes >= SIZE_MULTIPLIERS.PB) {
      value = totalBytes / SIZE_MULTIPLIERS.PB
      unit = "PB"
    } else if (totalBytes >= SIZE_MULTIPLIERS.TB) {
      value = totalBytes / SIZE_MULTIPLIERS.TB
      unit = "TB"
    } else if (totalBytes >= SIZE_MULTIPLIERS.GB) {
      value = totalBytes / SIZE_MULTIPLIERS.GB
      unit = "GB"
    } else if (totalBytes >= SIZE_MULTIPLIERS.MB) {
      value = totalBytes / SIZE_MULTIPLIERS.MB
      unit = "MB"
    } else if (totalBytes >= SIZE_MULTIPLIERS.KB) {
      value = totalBytes / SIZE_MULTIPLIERS.KB
      unit = "KB"
    }

    return {
      bytes: totalBytes,
      value: value.toFixed(2),
      unit,
      formatted: `${value.toFixed(2)} ${unit}`,
    }
  }, [downloadTime, downloadTimeUnit, downloadSpeed, downloadSpeedUnit])

  // Speed conversions
  const speedConversions = useMemo(() => {
    const baseBps = (parseFloat(convertValue) || 0) * SPEED_TO_BPS[convertFromUnit]

    return {
      bps: baseBps.toFixed(0),
      Kbps: (baseBps / 1000).toFixed(2),
      Mbps: (baseBps / 1000000).toFixed(4),
      Gbps: (baseBps / 1000000000).toFixed(6),
      Bps: (baseBps / 8).toFixed(0),
      KBps: (baseBps / 8000).toFixed(2),
      MBps: (baseBps / 8000000).toFixed(4),
      GBps: (baseBps / 8000000000).toFixed(6),
    }
  }, [convertValue, convertFromUnit])

  const commonSpeeds = [
    { name: "Dial-up", speed: "56 Kbps" },
    { name: "DSL", speed: "10 Mbps" },
    { name: "Cable", speed: "100 Mbps" },
    { name: "Fiber (basic)", speed: "300 Mbps" },
    { name: "Fiber (gigabit)", speed: "1 Gbps" },
    { name: "Fiber (premium)", speed: "10 Gbps" },
    { name: "Fast Ethernet", speed: "100 Mbps" },
    { name: "Gigabit Ethernet", speed: "1 Gbps" },
    { name: "10 GbE", speed: "10 Gbps" },
    { name: "25 GbE", speed: "25 Gbps" },
    { name: "100 GbE", speed: "100 Gbps" },
    { name: "WiFi 4 (802.11n)", speed: "150 Mbps" },
    { name: "WiFi 5 (802.11ac)", speed: "867 Mbps" },
    { name: "WiFi 6 (802.11ax)", speed: "2400 Mbps" },
    { name: "WiFi 7 (802.11be)", speed: "5760 Mbps" },
  ]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Gauge}
        title="Bandwidth Calculator"
        description="Calculate transfer times, download sizes, and convert between speed units"
      />

      <Tabs defaultValue="transfer-time" className="space-y-4">
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-3 sm:gap-0 sm:p-1">
          <TabsTrigger
            value="transfer-time"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            Transfer Time
          </TabsTrigger>
          <TabsTrigger
            value="download-size"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            Download Size
          </TabsTrigger>
          <TabsTrigger
            value="converter"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            Unit Converter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer-time" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Transfer Time Calculator
                </CardTitle>
                <CardDescription>
                  Calculate how long it takes to transfer a file at a given speed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="file-size">File Size</Label>
                    <Input
                      id="file-size"
                      type="number"
                      min="0"
                      step="0.1"
                      value={fileSize}
                      onChange={(e) => setFileSize(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="size-unit">Unit</Label>
                    <Select
                      value={fileSizeUnit}
                      onValueChange={(v) => setFileSizeUnit(v as SizeUnit)}
                    >
                      <SelectTrigger id="size-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B">Bytes</SelectItem>
                        <SelectItem value="KB">KB</SelectItem>
                        <SelectItem value="MB">MB</SelectItem>
                        <SelectItem value="GB">GB</SelectItem>
                        <SelectItem value="TB">TB</SelectItem>
                        <SelectItem value="PB">PB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="transfer-speed">Transfer Speed</Label>
                    <Input
                      id="transfer-speed"
                      type="number"
                      min="0"
                      step="1"
                      value={transferSpeed}
                      onChange={(e) => setTransferSpeed(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="speed-unit">Unit</Label>
                    <Select
                      value={transferSpeedUnit}
                      onValueChange={(v) => setTransferSpeedUnit(v as SpeedUnit)}
                    >
                      <SelectTrigger id="speed-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bps">bps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Gbps">Gbps</SelectItem>
                        <SelectItem value="Bps">B/s</SelectItem>
                        <SelectItem value="KBps">KB/s</SelectItem>
                        <SelectItem value="MBps">MB/s</SelectItem>
                        <SelectItem value="GBps">GB/s</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="overhead">Protocol Overhead (%)</Label>
                  <Input
                    id="overhead"
                    type="number"
                    min="0"
                    max="50"
                    value={overhead}
                    onChange={(e) => setOverhead(e.target.value)}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    TCP/IP typically adds 5-10% overhead
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "1 GB", size: "1", unit: "GB" as SizeUnit },
                    { label: "4.7 GB (DVD)", size: "4.7", unit: "GB" as SizeUnit },
                    { label: "25 GB (Blu-ray)", size: "25", unit: "GB" as SizeUnit },
                    { label: "100 GB", size: "100", unit: "GB" as SizeUnit },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFileSize(preset.size)
                        setFileSizeUnit(preset.unit)
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <ResultCard
              title="Transfer Time"
              data={[
                {
                  label: "Time Required",
                  value: transferTimeResult.formatted,
                  highlight: true,
                },
                {
                  label: "Total Seconds",
                  value: transferTimeResult.totalSeconds.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }),
                },
                {
                  label: "Effective Speed",
                  value: `${transferTimeResult.effectiveSpeedMbps.toFixed(2)} Mbps`,
                },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="download-size" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Download Size Calculator
                </CardTitle>
                <CardDescription>
                  Calculate how much data you can download in a given time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="download-time">Time</Label>
                    <Input
                      id="download-time"
                      type="number"
                      min="0"
                      step="1"
                      value={downloadTime}
                      onChange={(e) => setDownloadTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time-unit">Unit</Label>
                    <Select
                      value={downloadTimeUnit}
                      onValueChange={(v) => setDownloadTimeUnit(v as TimeUnit)}
                    >
                      <SelectTrigger id="time-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seconds">Seconds</SelectItem>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="download-speed">Download Speed</Label>
                    <Input
                      id="download-speed"
                      type="number"
                      min="0"
                      step="1"
                      value={downloadSpeed}
                      onChange={(e) => setDownloadSpeed(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="download-speed-unit">Unit</Label>
                    <Select
                      value={downloadSpeedUnit}
                      onValueChange={(v) => setDownloadSpeedUnit(v as SpeedUnit)}
                    >
                      <SelectTrigger id="download-speed-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Gbps">Gbps</SelectItem>
                        <SelectItem value="MBps">MB/s</SelectItem>
                        <SelectItem value="GBps">GB/s</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <ResultCard
              title="Download Capacity"
              data={[
                {
                  label: "Maximum Download",
                  value: downloadSizeResult.formatted,
                  highlight: true,
                },
                {
                  label: "In Bytes",
                  value: downloadSizeResult.bytes.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  }),
                },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="converter" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Speed Unit Converter
                </CardTitle>
                <CardDescription>Convert between different bandwidth units</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="convert-value">Value</Label>
                    <Input
                      id="convert-value"
                      type="number"
                      min="0"
                      step="1"
                      value={convertValue}
                      onChange={(e) => setConvertValue(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="convert-unit">Unit</Label>
                    <Select
                      value={convertFromUnit}
                      onValueChange={(v) => setConvertFromUnit(v as SpeedUnit)}
                    >
                      <SelectTrigger id="convert-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bps">bps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Gbps">Gbps</SelectItem>
                        <SelectItem value="Bps">B/s</SelectItem>
                        <SelectItem value="KBps">KB/s</SelectItem>
                        <SelectItem value="MBps">MB/s</SelectItem>
                        <SelectItem value="GBps">GB/s</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Bits per second</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">bps</span>
                        <span className="font-mono">{speedConversions.bps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kbps</span>
                        <span className="font-mono">{speedConversions.Kbps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mbps</span>
                        <span className="font-mono">{speedConversions.Mbps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gbps</span>
                        <span className="font-mono">{speedConversions.Gbps}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Bytes per second</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">B/s</span>
                        <span className="font-mono">{speedConversions.Bps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">KB/s</span>
                        <span className="font-mono">{speedConversions.KBps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MB/s</span>
                        <span className="font-mono">{speedConversions.MBps}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GB/s</span>
                        <span className="font-mono">{speedConversions.GBps}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Common Connection Speeds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-5">
            {commonSpeeds.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  const match = item.speed.match(/^([\d.]+)\s*(\w+)$/)
                  if (match) {
                    setTransferSpeed(match[1])
                    setTransferSpeedUnit(match[2] as SpeedUnit)
                  }
                }}
                className="hover:bg-muted rounded-lg border p-3 text-left transition-colors"
              >
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{item.speed}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
