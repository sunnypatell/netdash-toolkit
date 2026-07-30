"use client"

import { useEffect, useMemo, useState } from "react"
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
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
import { Download, Copy, Check, Eye, EyeOff, QrCode, Info, Wifi, ShieldAlert } from "lucide-react"
import { SaveToProject } from "@/components/ui/save-to-project"
import { ToolHeader } from "@/components/ui/tool-header"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { copyText } from "@/lib/clipboard"
import { toast } from "sonner"
import type { ProjectItem } from "@/contexts/project-context"
import {
  SECURITY_LABELS,
  buildWifiUri,
  qrFileStem,
  utf8Length,
  validateWifiConfig,
  type WifiConfig,
  type WifiSecurity,
} from "@/lib/wifi-qr"
import QRCode from "qrcode"

const SECURITY_TYPES = ["wpa2", "wpa3", "wep", "open"] as const

export function WifiQRGenerator() {
  // the SSID and the network's shape go in the query string so a link is
  // shareable. the passphrase never does, and neither does the QR image derived
  // from it: a url lands in browser history, in the referer header of every
  // outbound link and in any proxy or analytics log on the path.
  const [query, setQuery] = useQueryStates(
    {
      ssid: parseAsString.withDefault(""),
      security: parseAsStringLiteral(SECURITY_TYPES).withDefault("wpa2"),
      hidden: parseAsBoolean.withDefault(false),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [qrError, setQrError] = useState("")
  const [copied, setCopied] = useState<"string" | "config" | null>(null)

  const config: WifiConfig = useMemo(
    () => ({
      ssid: query.ssid,
      password,
      security: query.security,
      hidden: query.hidden,
    }),
    [query.ssid, query.security, query.hidden, password]
  )

  const validation = useMemo(() => validateWifiConfig(config), [config])
  const valid = validation.errors.length === 0
  // the URI is a pure function of the config; only the raster image is async
  const qrString = useMemo(() => (valid ? buildWifiUri(config) : ""), [valid, config])

  useEffect(() => {
    if (!qrString) {
      setQrDataUrl("")
      setQrError("")
      return
    }
    // rapid typing resolves out of order, so a stale image must not win
    let live = true
    QRCode.toDataURL(qrString, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!live) return
        setQrDataUrl(url)
        setQrError("")
      })
      .catch(() => {
        if (!live) return
        setQrDataUrl("")
        setQrError("Could not render a QR code for this configuration")
      })
    return () => {
      live = false
    }
  }, [qrString])

  const copyToClipboard = async (type: "string" | "config") => {
    // the config json carries the passphrase, so it is only ever produced on an
    // explicit click, never written anywhere automatically
    const text =
      type === "string"
        ? qrString
        : JSON.stringify(
            { ssid: config.ssid, security: config.security, hidden: config.hidden, password },
            null,
            2
          )
    if (!(await copyText(text))) {
      toast.error("Could not copy to clipboard")
      return
    }
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
    toast.success(type === "string" ? "QR string copied" : "Config copied")
  }

  const downloadQR = async (format: "png" | "svg") => {
    if (!qrString) return
    try {
      const stem = qrFileStem(config.ssid)
      let dataUrl: string
      if (format === "svg") {
        const svg = await QRCode.toString(qrString, { type: "svg", width: 256, margin: 2 })
        dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      } else {
        dataUrl = await QRCode.toDataURL(qrString, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: "H",
        })
      }
      // binary/svg payloads stay on the data-url anchor path; downloadTextFile
      // only models utf-8 text blobs
      const link = document.createElement("a")
      link.href = dataUrl
      link.download = `${stem}.${format}`
      link.click()
      toast.success(`QR code saved as ${format.toUpperCase()}`)
    } catch {
      toast.error("Could not download QR code")
    }
  }

  const handleLoadFromProject = (data: Record<string, unknown>, _item: ProjectItem) => {
    const loaded = data.security
    const security: WifiSecurity = SECURITY_TYPES.includes(loaded as WifiSecurity)
      ? (loaded as WifiSecurity)
      : "wpa2"
    void setQuery({
      ssid: typeof data.ssid === "string" ? data.ssid.slice(0, 32) : "",
      security,
      hidden: data.hidden === true,
    })
    setPassword(typeof data.password === "string" ? data.password.slice(0, 63) : "")
  }

  const ssidBytes = utf8Length(config.ssid)

  return (
    <div className="tool-container">
      <ToolHeader
        icon={QrCode}
        title="WiFi QR Code Generator"
        description="Generate a WIFI: URI QR code for a network. Scan with any phone camera to join."
      />

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          The network name and security type are in this page&apos;s address so the setup is
          shareable. <strong>The passphrase is not, and never will be.</strong> A URL is recorded in
          browser history, sent in the referer header of outbound links, and logged by any proxy on
          the path, so a shared link asks the recipient for the passphrase instead of carrying it.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Network Configuration
            </CardTitle>
            <CardDescription>Enter the WiFi network details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ssid">Network Name (SSID)</Label>
              <Input
                id="ssid"
                value={config.ssid}
                onChange={(e) => setQuery({ ssid: e.target.value })}
                placeholder="My WiFi Network"
                aria-invalid={ssidBytes > 32}
              />
              <p className="text-muted-foreground text-xs">
                {ssidBytes}/32 bytes
                {ssidBytes !== config.ssid.length ? ` (${config.ssid.length} characters)` : ""} -
                the IEEE 802.11 limit counts bytes, not characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="security">Security Type</Label>
              <Select
                value={config.security}
                onValueChange={(v) => setQuery({ security: v as WifiSecurity })}
              >
                <SelectTrigger id="security" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECURITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {SECURITY_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config.security !== "open" && (
              <div className="space-y-2">
                <Label htmlFor="password">Passphrase</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={config.security === "wep" ? "WEP key" : "WiFi passphrase"}
                    autoComplete="off"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide passphrase" : "Show passphrase"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {config.security === "wep"
                    ? "WEP: 5 or 13 ASCII characters, or 10 or 26 hex digits"
                    : `WPA: 8-63 characters or a 64 digit hex PSK (${password.length} entered)`}
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hidden"
                checked={config.hidden}
                onCheckedChange={(checked) => setQuery({ hidden: checked === true })}
              />
              <Label htmlFor="hidden" className="text-sm font-normal">
                Hidden network (SSID not broadcast)
              </Label>
            </div>

            {validation.errors.length > 0 && config.ssid !== "" && (
              <Alert variant="destructive">
                <AlertTitle>Cannot generate a code yet</AlertTitle>
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1">
                    {validation.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation.warnings.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-1 text-xs">
                    {validation.warnings.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
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
                  ? `${config.ssid} - ${SECURITY_LABELS[config.security]}`
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
                      alt={`WiFi QR code for the network ${config.ssid}`}
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
                    {qrError || (config.ssid ? "Fix the errors to generate" : "Enter an SSID")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {qrString && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">WIFI: URI</CardTitle>
                <CardDescription className="text-xs">
                  Reserved characters are backslash-escaped, and an all-hex value is quoted so it is
                  not read as hex bytes. This string contains the passphrase.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <code className="bg-muted block rounded p-2 font-mono text-xs break-all">
                  {showPassword ? qrString : buildWifiUri({ ...config, password: "*".repeat(8) })}
                </code>
                {!showPassword && config.security !== "open" && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Passphrase masked. Use the eye button above to reveal it.
                  </p>
                )}
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
              itemData={{ ...config, qrString, generatedAt: Date.now() }}
              toolSource="wifi-qr-generator"
              className="flex-1"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Saving to a project stores the passphrase alongside the SSID so the code can be
            regenerated later. That is a deliberate click, not something typing does.
          </p>
        </div>
      </div>
    </div>
  )
}
