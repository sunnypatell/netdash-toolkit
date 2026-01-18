"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Download, Copy, Check, Eye, EyeOff, QrCode, Info, Wifi } from "lucide-react"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { useToast } from "@/hooks/use-toast"
import type { ProjectItem } from "@/contexts/project-context"
import QRCode from "qrcode"

type SecurityType = "wpa2" | "wpa3" | "wep" | "open"

interface WifiConfig {
  ssid: string
  password: string
  security: SecurityType
  hidden: boolean
}

// Escape special characters per WiFi QR spec
const escapeWifiString = (str: string): string => {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/"/g, '\\"')
    .replace(/:/g, "\\:")
}

// Generate WiFi QR string
const generateWifiString = (config: WifiConfig): string => {
  const { ssid, password, security, hidden } = config

  // Map our security types to QR standard
  const securityMap: Record<SecurityType, string> = {
    wpa2: "WPA",
    wpa3: "SAE",
    wep: "WEP",
    open: "nopass",
  }

  const escapedSsid = escapeWifiString(ssid)
  const escapedPassword = escapeWifiString(password)
  const securityType = securityMap[security]

  let qrString = `WIFI:T:${securityType};S:${escapedSsid};`

  if (security !== "open" && password) {
    qrString += `P:${escapedPassword};`
  }

  if (hidden) {
    qrString += "H:true;"
  }

  qrString += ";"

  return qrString
}

export function WifiQRGenerator() {
  const { toast } = useToast()

  const [config, setConfig] = useState<WifiConfig>({
    ssid: "",
    password: "",
    security: "wpa2",
    hidden: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [qrString, setQrString] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [copied, setCopied] = useState<"string" | "config" | null>(null)
  const [error, setError] = useState("")

  // Generate QR code when config changes
  const generateQR = useCallback(async () => {
    if (!config.ssid.trim()) {
      setQrString("")
      setQrDataUrl("")
      setError("")
      return
    }

    // Validate password for secured networks
    if (config.security !== "open" && !config.password) {
      setError("Password required for secured networks")
      setQrDataUrl("")
      return
    }

    // WEP key validation
    if (config.security === "wep") {
      const len = config.password.length
      if (![5, 10, 13, 26].includes(len)) {
        setError("WEP key must be 5, 10, 13, or 26 characters")
        setQrDataUrl("")
        return
      }
    }

    // WPA password validation
    if ((config.security === "wpa2" || config.security === "wpa3") && config.password.length < 8) {
      setError("WPA password must be at least 8 characters")
      setQrDataUrl("")
      return
    }

    setError("")

    try {
      const wifiString = generateWifiString(config)
      setQrString(wifiString)

      // Generate QR code as data URL for display
      const dataUrl = await QRCode.toDataURL(wifiString, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "M",
      })
      setQrDataUrl(dataUrl)
    } catch (err) {
      setError("Failed to generate QR code")
      console.error("QR generation error:", err)
    }
  }, [config])

  useEffect(() => {
    generateQR()
  }, [generateQR])

  const copyToClipboard = async (type: "string" | "config") => {
    try {
      const text = type === "string" ? qrString : JSON.stringify(config, null, 2)

      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)

      toast({
        title: "Copied",
        description: type === "string" ? "QR string copied" : "Config copied",
      })
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const downloadQR = async (format: "png" | "svg") => {
    if (!config.ssid.trim()) return

    try {
      let dataUrl: string
      let filename: string

      if (format === "svg") {
        const svgString = await QRCode.toString(qrString, {
          type: "svg",
          width: 256,
          margin: 2,
        })
        dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
        filename = `wifi-qr-${config.ssid.replace(/[^a-zA-Z0-9]/g, "_")}.svg`
      } else {
        dataUrl = await QRCode.toDataURL(qrString, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: "H",
        })
        filename = `wifi-qr-${config.ssid.replace(/[^a-zA-Z0-9]/g, "_")}.png`
      }

      const link = document.createElement("a")
      link.href = dataUrl
      link.download = filename
      link.click()

      toast({
        title: "Downloaded",
        description: `QR code saved as ${format.toUpperCase()}`,
      })
    } catch {
      toast({
        title: "Download failed",
        description: "Could not download QR code",
        variant: "destructive",
      })
    }
  }

  const getSaveData = () => ({
    ...config,
    qrString,
    generatedAt: Date.now(),
  })

  const getSecurityLabel = (security: SecurityType): string => {
    const labels: Record<SecurityType, string> = {
      wpa2: "WPA2-Personal",
      wpa3: "WPA3-Personal",
      wep: "WEP (Legacy)",
      open: "Open (No Password)",
    }
    return labels[security]
  }

  // Valid security types for validation
  const validSecurityTypes: SecurityType[] = ["wpa2", "wpa3", "wep", "open"]

  // Load from project handler with validation
  const handleLoadFromProject = (data: Record<string, unknown>, _item: ProjectItem) => {
    // Validate and sanitize security type
    const loadedSecurity = data.security as string
    const security: SecurityType = validSecurityTypes.includes(loadedSecurity as SecurityType)
      ? (loadedSecurity as SecurityType)
      : "wpa2"

    // Sanitize ssid - ensure it's a string and within bounds
    const ssid = typeof data.ssid === "string" ? data.ssid.slice(0, 32) : ""

    // Sanitize password - ensure it's a string and within bounds
    const password = typeof data.password === "string" ? data.password.slice(0, 63) : ""

    // Sanitize hidden - ensure it's a boolean
    const hidden = data.hidden === true

    setConfig({
      ssid,
      password,
      security,
      hidden,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground mb-2 text-3xl font-bold">WiFi QR Code Generator</h1>
        <p className="text-muted-foreground">
          Generate QR codes for WiFi network credentials. Scan with any smartphone to connect
          instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Network Configuration
            </CardTitle>
            <CardDescription>Enter your WiFi network details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ssid">Network Name (SSID)</Label>
              <Input
                id="ssid"
                value={config.ssid}
                onChange={(e) => setConfig({ ...config, ssid: e.target.value })}
                placeholder="My WiFi Network"
                maxLength={32}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {config.ssid.length}/32 characters
              </p>
            </div>

            <div>
              <Label htmlFor="security">Security Type</Label>
              <Select
                value={config.security}
                onValueChange={(v) => setConfig({ ...config, security: v as SecurityType })}
              >
                <SelectTrigger id="security">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wpa2">WPA2-Personal (Recommended)</SelectItem>
                  <SelectItem value="wpa3">WPA3-Personal (Most Secure)</SelectItem>
                  <SelectItem value="wep">WEP (Legacy - Not Recommended)</SelectItem>
                  <SelectItem value="open">Open (No Password)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.security !== "open" && (
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    placeholder={config.security === "wep" ? "WEP key" : "WiFi password"}
                    maxLength={63}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {config.security === "wep"
                    ? "WEP: 5, 10, 13, or 26 characters"
                    : `WPA: 8-63 characters (${config.password.length}/63)`}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hidden"
                checked={config.hidden}
                onCheckedChange={(checked) => setConfig({ ...config, hidden: checked === true })}
              />
              <Label htmlFor="hidden" className="text-sm font-normal">
                Hidden network (SSID not broadcast)
              </Label>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Validation Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {config.security === "wep" && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription className="text-xs">
                  WEP is deprecated and insecure. Consider upgrading to WPA2 or WPA3.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Generated QR Code
              </CardTitle>
              <CardDescription>
                {config.ssid
                  ? `${config.ssid} - ${getSecurityLabel(config.security)}`
                  : "Enter network details to generate"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              {qrDataUrl ? (
                <>
                  <div className="rounded-lg bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`WiFi QR code for ${config.ssid}`}
                      className="h-48 w-48"
                    />
                  </div>

                  <div className="flex w-full flex-wrap justify-center gap-2">
                    <Button onClick={() => downloadQR("png")} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      PNG
                    </Button>
                    <Button onClick={() => downloadQR("svg")} variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      SVG
                    </Button>
                    <Button onClick={() => copyToClipboard("string")} variant="outline" size="sm">
                      {copied === "string" ? (
                        <Check className="mr-2 h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      Copy String
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-lg border-2 border-dashed">
                  <p className="text-muted-foreground text-center text-sm">
                    {config.ssid ? "Fix errors to generate" : "Enter SSID to generate QR"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {qrString && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">QR String</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="bg-muted block rounded p-2 font-mono text-xs break-all">
                  {qrString}
                </code>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <LoadFromProject itemType="wifi-qr" onLoad={handleLoadFromProject} className="flex-1" />
            <Button
              onClick={() => copyToClipboard("config")}
              variant="outline"
              className="flex-1"
              disabled={!config.ssid}
            >
              {copied === "config" ? (
                <Check className="mr-2 h-4 w-4 text-green-600" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy
            </Button>
            <SaveToProject
              itemType="wifi-qr"
              itemName={config.ssid || "WiFi QR"}
              itemData={getSaveData()}
              toolSource="wifi-qr-generator"
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
