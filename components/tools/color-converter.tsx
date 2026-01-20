"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Copy, Palette, Check } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"

interface ColorValues {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
  cmyk: { c: number; m: number; y: number; k: number }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  l /= 100

  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

function rgbToCmyk(
  r: number,
  g: number,
  b: number
): { c: number; m: number; y: number; k: number } {
  r /= 255
  g /= 255
  b /= 255

  const k = 1 - Math.max(r, g, b)
  const c = k === 1 ? 0 : (1 - r - k) / (1 - k)
  const m = k === 1 ? 0 : (1 - g - k) / (1 - k)
  const y = k === 1 ? 0 : (1 - b - k) / (1 - k)

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  }
}

export function ColorConverter() {
  const { toast } = useToast()
  const [color, setColor] = useState<ColorValues>({
    hex: "#3b82f6",
    rgb: { r: 59, g: 130, b: 246 },
    hsl: { h: 217, s: 91, l: 60 },
    cmyk: { c: 76, m: 47, y: 0, k: 4 },
  })
  const [copied, setCopied] = useState<string | null>(null)
  const [hexInput, setHexInput] = useState("#3b82f6")

  const updateFromRgb = (r: number, g: number, b: number) => {
    const hex = rgbToHex(r, g, b)
    const hsl = rgbToHsl(r, g, b)
    const cmyk = rgbToCmyk(r, g, b)
    setColor({ hex, rgb: { r, g, b }, hsl, cmyk })
    setHexInput(hex)
  }

  const updateFromHex = (hex: string) => {
    const rgb = hexToRgb(hex)
    if (rgb) {
      updateFromRgb(rgb.r, rgb.g, rgb.b)
    }
  }

  const updateFromHsl = (h: number, s: number, l: number) => {
    const rgb = hslToRgb(h, s, l)
    updateFromRgb(rgb.r, rgb.g, rgb.b)
  }

  const handleHexChange = (value: string) => {
    setHexInput(value)
    if (/^#?[0-9A-Fa-f]{6}$/.test(value)) {
      updateFromHex(value.startsWith("#") ? value : "#" + value)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
      toast({ title: "Copied", description: `${label} copied` })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const CopyButton = ({ value, label }: { value: string; label: string }) => (
    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(value, label)}>
      {copied === label ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  )

  const presetColors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#6b7280",
    "#000000",
  ]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Palette}
        title="Color Converter"
        description="Convert colors between HEX, RGB, HSL, and CMYK formats"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Color Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="h-40 rounded-lg border shadow-inner"
              style={{ backgroundColor: color.hex }}
            />

            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateFromHex(c)}
                    className="h-8 w-8 rounded-md border shadow-sm transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color Picker</Label>
              <Input
                type="color"
                value={color.hex}
                onChange={(e) => updateFromHex(e.target.value)}
                className="h-12 w-full cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Color Values</CardTitle>
            <CardDescription>Edit any value to update the color</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* HEX */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>HEX</Label>
                <CopyButton value={color.hex} label="HEX" />
              </div>
              <Input
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#3b82f6"
                className="font-mono"
              />
            </div>

            {/* RGB */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>RGB</Label>
                <CopyButton
                  value={`rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`}
                  label="RGB"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["r", "g", "b"] as const).map((channel) => (
                  <div key={channel} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs uppercase">{channel}</span>
                      <Badge variant="outline" className="font-mono">
                        {color.rgb[channel]}
                      </Badge>
                    </div>
                    <Slider
                      value={[color.rgb[channel]]}
                      onValueChange={([v]) =>
                        updateFromRgb(
                          channel === "r" ? v : color.rgb.r,
                          channel === "g" ? v : color.rgb.g,
                          channel === "b" ? v : color.rgb.b
                        )
                      }
                      max={255}
                      step={1}
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground font-mono text-sm">
                rgb({color.rgb.r}, {color.rgb.g}, {color.rgb.b})
              </p>
            </div>

            {/* HSL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>HSL</Label>
                <CopyButton
                  value={`hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`}
                  label="HSL"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["h", "s", "l"] as const).map((channel) => (
                  <div key={channel} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs uppercase">
                        {channel === "h" ? "Hue" : channel === "s" ? "Sat" : "Light"}
                      </span>
                      <Badge variant="outline" className="font-mono">
                        {color.hsl[channel]}
                        {channel !== "h" ? "%" : "°"}
                      </Badge>
                    </div>
                    <Slider
                      value={[color.hsl[channel]]}
                      onValueChange={([v]) =>
                        updateFromHsl(
                          channel === "h" ? v : color.hsl.h,
                          channel === "s" ? v : color.hsl.s,
                          channel === "l" ? v : color.hsl.l
                        )
                      }
                      max={channel === "h" ? 360 : 100}
                      step={1}
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground font-mono text-sm">
                hsl({color.hsl.h}, {color.hsl.s}%, {color.hsl.l}%)
              </p>
            </div>

            {/* CMYK */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>CMYK</Label>
                <CopyButton
                  value={`cmyk(${color.cmyk.c}%, ${color.cmyk.m}%, ${color.cmyk.y}%, ${color.cmyk.k}%)`}
                  label="CMYK"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["c", "m", "y", "k"] as const).map((channel) => (
                  <div key={channel} className="rounded border p-2 text-center">
                    <span className="text-muted-foreground text-xs uppercase">{channel}</span>
                    <p className="font-mono font-bold">{color.cmyk[channel]}%</p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground font-mono text-sm">
                cmyk({color.cmyk.c}%, {color.cmyk.m}%, {color.cmyk.y}%, {color.cmyk.k}%)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CSS Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "HEX", value: color.hex },
              { label: "RGB", value: `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})` },
              { label: "RGBA", value: `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, 1)` },
              { label: "HSL", value: `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)` },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <CopyButton value={item.value} label={item.label} />
                </div>
                <code className="text-muted-foreground text-xs break-all">{item.value}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
