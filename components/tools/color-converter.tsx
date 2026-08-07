"use client"

import { useEffect, useMemo, useState } from "react"
import { parseAsString, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Palette, Contrast, AlertCircle } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import type { Color } from "culori/fn"
import {
  alphaOf,
  cmykToRgb,
  contrastCheck,
  cssPreview,
  hslDisplay,
  isInSrgbGamut,
  nearestNamedColor,
  oklchDisplay,
  parseColor,
  rgb255,
  rgbToCmyk,
  toStrings,
  type Cmyk,
  type ContrastCheck,
} from "@/lib/color-convert"

const PRESETS = [
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

const EXAMPLES = [
  "#fff",
  "#3b82f680",
  "rebeccapurple",
  "rgb(59 130 246 / 0.5)",
  "hsl(217 91% 60%)",
  "hwb(217 23% 4%)",
  "lab(54.6% 8.76 -65.79)",
  "lch(54.6% 66.4 277.6)",
  "oklab(0.623 -0.033 -0.185)",
  "oklch(0.62 0.19 260)",
  "color(display-p3 0.3 0.5 0.93)",
]

const INVALID_COLOR_MESSAGE =
  "Not a colour this parser recognises. Try #fff, #rrggbbaa, a CSS name, or rgb()/hsl()/hwb()/lab()/lch()/oklab()/oklch()."

function PassFail({ label, pass, threshold }: { label: string; pass: boolean; threshold: string }) {
  return (
    <div className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">
        {label} <span className="font-mono">{threshold}</span>
      </span>
      <Badge variant={pass ? "default" : "destructive"} className="ml-2">
        {pass ? "Pass" : "Fail"}
      </Badge>
    </div>
  )
}

function ContrastPanel({
  title,
  swatch,
  check,
}: {
  title: string
  swatch: string
  check: ContrastCheck
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-5 w-5 rounded border"
            style={{ backgroundColor: swatch }}
            aria-hidden="true"
          />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Badge variant="outline" className="font-mono">
          {check.ratio.toFixed(2)}:1
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <PassFail label="AA normal" threshold="4.5:1" pass={check.aaNormal} />
        <PassFail label="AAA normal" threshold="7:1" pass={check.aaaNormal} />
        <PassFail label="AA large" threshold="3:1" pass={check.aaLarge} />
        <PassFail label="AAA large" threshold="4.5:1" pass={check.aaaLarge} />
      </div>
    </div>
  )
}

const FALLBACK: Color = { mode: "rgb", r: 0, g: 0, b: 0 }

export function ColorConverter() {
  // colour and background are short and never sensitive, so both live in the url
  const [{ c: text, bg: bgText }, setQuery] = useQueryStates(
    {
      c: parseAsString.withDefault("#3b82f6"),
      bg: parseAsString.withDefault("#0f172a"),
    },
    { history: "replace" }
  )

  const parsedText = useMemo(() => parseColor(text), [text])
  // the last colour that parsed, so a half-typed "rgb(" does not blank the swatch
  const [lastValid, setLastValid] = useState<Color>(() => parseColor("#3b82f6") ?? FALLBACK)
  useEffect(() => {
    if (parsedText) setLastValid(parsedText)
  }, [parsedText])

  // keeps the last-edited space, so hue survives s=0 and l=0/100 instead of round-tripping via rgb
  const source = parsedText ?? lastValid
  const textError = text.trim() && !parsedText ? INVALID_COLOR_MESSAGE : null

  const alpha = alphaOf(source)
  const strings = useMemo(() => toStrings(source), [source])
  const rgb = useMemo(() => rgb255(source), [source])
  const hsl = useMemo(() => hslDisplay(source), [source])
  const oklch = useMemo(() => oklchDisplay(source), [source])
  const cmyk = useMemo(() => rgbToCmyk(source), [source])
  const named = useMemo(() => nearestNamedColor(source), [source])
  const inGamut = useMemo(() => isInSrgbGamut(source), [source])
  const preview = useMemo(() => cssPreview(source), [source])

  const customBg = useMemo(() => parseColor(bgText), [bgText])
  // the colour, not strings.hex: hex drops alpha, so a 50% swatch measured as opaque and read 21:1
  const contrast = useMemo(
    () => ({
      white: contrastCheck(source, "#ffffff"),
      black: contrastCheck(source, "#000000"),
      custom: customBg ? contrastCheck(source, customBg) : null,
    }),
    [source, customBg]
  )

  // each space writes back in its own notation, which keeps hue 210 from collapsing when s hits 0
  const commit = (next: Color, notation: keyof typeof strings = "hex") => {
    void setQuery({ c: toStrings(next)[notation] })
  }

  const handleText = (value: string) => void setQuery({ c: value })

  const withAlpha = (color: Color): Color => (alpha < 1 ? { ...color, alpha } : color)

  const setRgb = (channel: "r" | "g" | "b", value: number) => {
    const next = { ...rgb, [channel]: value }
    commit(
      withAlpha({ mode: "rgb", r: next.r / 255, g: next.g / 255, b: next.b / 255 }),
      alpha < 1 ? "rgb" : "hex"
    )
  }

  const setHsl = (channel: "h" | "s" | "l", value: number) => {
    const next = { ...hsl, [channel]: value }
    commit(withAlpha({ mode: "hsl", h: next.h, s: next.s / 100, l: next.l / 100 }), "hsl")
  }

  const setOklch = (channel: "l" | "c" | "h", value: number) => {
    const next = { ...oklch, [channel]: value }
    commit(withAlpha({ mode: "oklch", l: next.l, c: next.c, h: next.h }), "oklch")
  }

  const setCmyk = (channel: keyof Cmyk, value: number) => {
    const next: Cmyk = { ...cmyk, [channel]: Math.min(100, Math.max(0, value)) }
    commit(cmykToRgb(next, alpha), alpha < 1 ? "rgb" : "hex")
  }

  const setAlpha = (value: number) => {
    commit({ ...source, alpha: value / 100 }, value >= 100 ? "hex" : "rgb")
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Palette}
        title="Color Converter"
        description="Convert between HEX, RGB, HSL, HWB, CMYK, LAB, LCH, OKLab, OKLCH and Display P3, with alpha and WCAG contrast"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Color Preview</CardTitle>
            <CardDescription>
              {named.exact ? `CSS named color: ${named.name}` : `Closest CSS name: ${named.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="h-40 rounded-lg border shadow-inner"
              style={{
                backgroundColor: preview,
                backgroundImage:
                  alpha < 1
                    ? "linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)"
                    : undefined,
                backgroundSize: alpha < 1 ? "16px 16px" : undefined,
                backgroundPosition: alpha < 1 ? "0 0, 8px 8px" : undefined,
              }}
            />

            {!inGamut && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Outside the sRGB gamut. The swatch shows a chroma-clamped stand-in; the OKLCH and
                  Display P3 values below are the real ones.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="color-input">Color (any CSS syntax)</Label>
              <Input
                id="color-input"
                value={text}
                onChange={(e) => handleText(e.target.value)}
                placeholder="#3b82f6, rebeccapurple, oklch(0.62 0.19 260)"
                className="font-mono"
                aria-invalid={textError !== null}
                aria-describedby={textError ? "color-input-error" : undefined}
              />
              {/* status, not alert: this re-validates on every keystroke, so an
                  assertive region would interrupt mid-value */}
              {textError && (
                <p
                  id="color-input-error"
                  role="status"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  {textError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleText(c)}
                    className="h-8 w-8 rounded-md border shadow-sm transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                    // sc 1.4.13: title tooltips are not dismissible, hoverable, or focus-visible
                    aria-label={`Use ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color-picker">Color Picker</Label>
              <Input
                id="color-picker"
                type="color"
                value={strings.hex}
                onChange={(e) => handleText(e.target.value)}
                className="h-12 w-full cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Alpha</Label>
                <Badge variant="outline" className="font-mono">
                  {Math.round(alpha * 100)}%
                </Badge>
              </div>
              <Slider
                value={[Math.round(alpha * 100)]}
                onValueChange={([v]) => setAlpha(v)}
                max={100}
                step={1}
                aria-label="Alpha"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Try</Label>
              <div className="flex flex-wrap gap-1">
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleText(e)}
                    className="hover:bg-muted/50 rounded border px-1.5 py-0.5 font-mono text-[0.625rem]"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Color Values</CardTitle>
            <CardDescription>Every slider edits the color in its own space</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>RGB</Label>
                <CopyButton value={strings.rgb} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["r", "g", "b"] as const).map((channel) => (
                  <div key={channel} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs uppercase">{channel}</span>
                      <Badge variant="outline" className="font-mono">
                        {rgb[channel]}
                      </Badge>
                    </div>
                    <Slider
                      value={[rgb[channel]]}
                      onValueChange={([v]) => setRgb(channel, v)}
                      max={255}
                      step={1}
                      aria-label={`RGB ${channel}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground font-mono text-sm">{strings.rgb}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>HSL</Label>
                <CopyButton value={strings.hsl} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["h", "s", "l"] as const).map((channel) => (
                  <div key={channel} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs uppercase">
                        {channel === "h" ? "Hue" : channel === "s" ? "Sat" : "Light"}
                      </span>
                      <Badge variant="outline" className="font-mono">
                        {hsl[channel]}
                        {channel === "h" ? "°" : "%"}
                      </Badge>
                    </div>
                    <Slider
                      value={[hsl[channel]]}
                      onValueChange={([v]) => setHsl(channel, v)}
                      max={channel === "h" ? 360 : 100}
                      step={1}
                      aria-label={`HSL ${channel}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground font-mono text-sm">{strings.hsl}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>OKLCH</Label>
                <CopyButton value={strings.oklch} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "l" as const, label: "Light", max: 1, step: 0.001 },
                    { key: "c" as const, label: "Chroma", max: 0.4, step: 0.001 },
                    { key: "h" as const, label: "Hue", max: 360, step: 1 },
                  ] satisfies { key: "l" | "c" | "h"; label: string; max: number; step: number }[]
                ).map(({ key, label, max, step }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs uppercase">{label}</span>
                      <Badge variant="outline" className="font-mono">
                        {oklch[key]}
                      </Badge>
                    </div>
                    <Slider
                      value={[oklch[key]]}
                      onValueChange={([v]) => setOklch(key, v)}
                      max={max}
                      step={step}
                      aria-label={`OKLCH ${label}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground font-mono text-sm">{strings.oklch}</p>
              <p className="text-muted-foreground text-xs">
                Perceptually uniform - equal lightness steps look equal, unlike HSL.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>CMYK</Label>
                <CopyButton value={strings.cmyk} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["c", "m", "y", "k"] as const).map((channel) => (
                  <div key={channel} className="space-y-1">
                    <Label
                      htmlFor={`cmyk-${channel}`}
                      className="text-muted-foreground text-xs uppercase"
                    >
                      {channel}
                    </Label>
                    <Input
                      id={`cmyk-${channel}`}
                      type="number"
                      min={0}
                      max={100}
                      value={cmyk[channel]}
                      onChange={(e) => setCmyk(channel, Number(e.target.value))}
                      className="font-mono"
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground font-mono text-sm">{strings.cmyk}</p>
              <p className="text-muted-foreground text-xs">
                Naive device-independent conversion, not an ICC profile - treat printer output as
                indicative.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Contrast className="h-5 w-5" />
            WCAG Contrast
          </CardTitle>
          <CardDescription>
            This color as text on a background. Large text means 18.66px bold or 24px regular.
          </CardDescription>
          {contrast.white.composited && (
            <p className="text-muted-foreground text-xs">
              Alpha is {Math.round(alpha * 100)}%, so each ratio is measured on the composite that
              actually gets painted. WCAG 2.2 1.4.3 rates the rendered text, not the source color.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ContrastPanel title="On white" swatch="#ffffff" check={contrast.white} />
            <ContrastPanel title="On black" swatch="#000000" check={contrast.black} />
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="bg-input" className="text-sm font-medium">
                Custom background
              </Label>
              <Input
                id="bg-input"
                value={bgText}
                onChange={(e) => setQuery({ bg: e.target.value })}
                placeholder="#0f172a"
                className="font-mono"
                aria-invalid={customBg === null}
                aria-describedby={customBg === null ? "bg-input-error" : undefined}
              />
              {contrast.custom ? (
                <>
                  <div className="flex items-center justify-between">
                    <span
                      className="h-5 w-16 rounded border"
                      style={{ backgroundColor: bgText }}
                      aria-hidden="true"
                    />
                    <Badge variant="outline" className="font-mono">
                      {contrast.custom.ratio.toFixed(2)}:1
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <PassFail label="AA normal" threshold="4.5:1" pass={contrast.custom.aaNormal} />
                    <PassFail label="AAA normal" threshold="7:1" pass={contrast.custom.aaaNormal} />
                    <PassFail label="AA large" threshold="3:1" pass={contrast.custom.aaLarge} />
                    <PassFail
                      label="UI component"
                      threshold="3:1"
                      pass={contrast.custom.uiComponent}
                    />
                  </div>
                </>
              ) : (
                <p
                  id="bg-input-error"
                  role="status"
                  className="text-xs text-red-600 dark:text-red-400"
                >
                  Unrecognised background color. Expected a CSS colour such as #0f172a,
                  rebeccapurple or oklch(0.62 0.19 260).
                </p>
              )}
            </div>
          </div>
          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: customBg ? bgText : "#ffffff", color: preview }}
          >
            <p className="text-sm">Normal text sample - 14px regular on the custom background.</p>
            <p className="text-2xl font-bold">Large text sample</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["HEX", strings.hex],
                ["HEX + alpha", strings.hex8],
                ["RGB", strings.rgb],
                ["HSL", strings.hsl],
                ["HWB", strings.hwb],
                ["CMYK", strings.cmyk],
                ["LAB", strings.lab],
                ["LCH", strings.lch],
                ["OKLab", strings.oklab],
                ["OKLCH", strings.oklch],
                ["Display P3", strings.p3],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <CopyButton value={value} />
                </div>
                <code className="text-muted-foreground text-xs break-all">{value}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
