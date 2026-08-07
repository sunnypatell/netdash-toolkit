// "culori/fn" on purpose: the main entry does not tree-shake (15.3kB vs 7.2kB gzip). an
// unregistered mode fails silently, so lrgb and lab65 are listed though nothing displays them.

import {
  // aliased: culori's useMode is a mode registry, not a react hook, and
  // react-hooks/rules-of-hooks only looks at the callee name
  useMode as registerMode,
  modeRgb,
  modeLrgb,
  modeHsl,
  modeHwb,
  modeLab,
  modeLab65,
  modeLch,
  modeOklab,
  modeOklch,
  modeP3,
  converter,
  formatCss,
  formatHex,
  formatHex8,
  parse,
  wcagContrast,
  differenceCiede2000,
  colorsNamed,
  nearest,
  inGamut,
  clampChroma,
} from "culori/fn"
import type { Color, Rgb, Hsl, Oklch } from "culori/fn"

export const toRgb = registerMode(modeRgb)
export const toHsl = registerMode(modeHsl)
export const toHwb = registerMode(modeHwb)
export const toLab = registerMode(modeLab)
export const toLch = registerMode(modeLch)
export const toOklab = registerMode(modeOklab)
export const toOklch = registerMode(modeOklch)
export const toP3 = registerMode(modeP3)
registerMode(modeLrgb)
registerMode(modeLab65)

export interface Cmyk {
  c: number
  m: number
  y: number
  k: number
}

export interface ColorStrings {
  hex: string
  hex8: string
  rgb: string
  hsl: string
  hwb: string
  lab: string
  lch: string
  oklab: string
  oklch: string
  p3: string
  cmyk: string
}

export interface ContrastCheck {
  ratio: number
  aaNormal: boolean
  aaaNormal: boolean
  aaLarge: boolean
  aaaLarge: boolean
  uiComponent: boolean
  /** a translucent input was flattened first, so the ratio is of the composite */
  composited: boolean
}

const NAMED = Object.keys(colorsNamed)
const nearestNamed = nearest(NAMED, differenceCiede2000())
const ciede2000 = differenceCiede2000()

function roundTo(value: number, precision: number): number {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

export function alphaOf(color: Color): number {
  return color.alpha === undefined ? 1 : color.alpha
}

// culori leaves hue undefined for achromatic colours, which serialises as
// "none". fine per css colour 4, confusing in a converter readout.
function hue(value: number | undefined): number {
  return value === undefined ? 0 : value
}

/** accepts any css colour: hex 3/4/6/8, named, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), color(display-p3 ...) */
export function parseColor(input: string): Color | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // bare hex without the "#" is what people paste out of design tools
  const candidate = /^[0-9a-f]{3,8}$/i.test(trimmed) ? `#${trimmed}` : trimmed
  return parse(candidate) ?? null
}

export function rgbToCmyk(color: Color): Cmyk {
  const { r, g, b } = toRgb(color) as Rgb
  const k = 1 - Math.max(r, g, b)
  const denom = 1 - k
  return {
    c: denom === 0 ? 0 : Math.round(((1 - r - k) / denom) * 100),
    m: denom === 0 ? 0 : Math.round(((1 - g - k) / denom) * 100),
    y: denom === 0 ? 0 : Math.round(((1 - b - k) / denom) * 100),
    k: Math.round(k * 100),
  }
}

export function cmykToRgb(cmyk: Cmyk, alpha = 1): Rgb {
  const c = cmyk.c / 100
  const m = cmyk.m / 100
  const y = cmyk.y / 100
  const k = cmyk.k / 100
  const rgb: Rgb = {
    mode: "rgb",
    r: (1 - c) * (1 - k),
    g: (1 - m) * (1 - k),
    b: (1 - y) * (1 - k),
  }
  return alpha < 1 ? { ...rgb, alpha } : rgb
}

export function rgb255(color: Color): { r: number; g: number; b: number } {
  const c = toRgb(color) as Rgb
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n * 255)))
  return { r: clamp(c.r), g: clamp(c.g), b: clamp(c.b) }
}

export function hslDisplay(color: Color): { h: number; s: number; l: number } {
  const c = toHsl(color) as Hsl
  return {
    h: Math.round(hue(c.h)),
    s: Math.round(c.s * 100),
    l: Math.round(c.l * 100),
  }
}

export function oklchDisplay(color: Color): { l: number; c: number; h: number } {
  const c = toOklch(color) as Oklch
  return {
    l: roundTo(c.l, 4),
    c: roundTo(c.c, 4),
    h: roundTo(hue(c.h), 2),
  }
}

export function toStrings(color: Color): ColorStrings {
  const a = alphaOf(color)
  const { r, g, b } = rgb255(color)
  // 2dp, not the integers the sliders show: an integer hsl() string re-parses up
  // to 5/255 away from the colour it was copied from
  const hslRaw = toHsl(color) as Hsl
  const hsl = {
    h: roundTo(hue(hslRaw.h), 2),
    s: roundTo(hslRaw.s * 100, 2),
    l: roundTo(hslRaw.l * 100, 2),
  }
  const hwb = toHwb(color)
  const lab = toLab(color)
  const lch = toLch(color)
  const oklab = toOklab(color)
  const oklch = oklchDisplay(color)
  const p3 = toP3(color)
  const cmyk = rgbToCmyk(color)
  const suffix = a < 1 ? ` / ${roundTo(a, 3)}` : ""

  return {
    hex: formatHex(toRgb(color)) ?? "#000000",
    hex8: formatHex8(toRgb(color)) ?? "#000000ff",
    rgb: a < 1 ? `rgb(${r} ${g} ${b} / ${roundTo(a, 3)})` : `rgb(${r} ${g} ${b})`,
    hsl: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%${suffix})`,
    hwb: `hwb(${roundTo(hue(hwb.h), 2)} ${roundTo(hwb.w * 100, 2)}% ${roundTo(hwb.b * 100, 2)}%${suffix})`,
    lab: `lab(${roundTo(lab.l, 2)}% ${roundTo(lab.a, 2)} ${roundTo(lab.b, 2)}${suffix})`,
    lch: `lch(${roundTo(lch.l, 2)}% ${roundTo(lch.c, 2)} ${roundTo(hue(lch.h), 2)}${suffix})`,
    oklab: `oklab(${roundTo(oklab.l, 4)} ${roundTo(oklab.a, 4)} ${roundTo(oklab.b, 4)}${suffix})`,
    oklch: `oklch(${oklch.l} ${oklch.c} ${oklch.h}${suffix})`,
    p3: `color(display-p3 ${roundTo(p3.r, 4)} ${roundTo(p3.g, 4)} ${roundTo(p3.b, 4)}${suffix})`,
    cmyk: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
  }
}

type Triple = { r: number; g: number; b: number }

const WHITE: Triple = { r: 1, g: 1, b: 1 }

function srgbTriple(color: Color): Triple {
  const c = toRgb(srgbFallback(color)) as Rgb
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  return { r: clamp(c.r), g: clamp(c.g), b: clamp(c.b) }
}

// source-over in gamma-encoded srgb, which is what the compositor actually does
function flatten(over: Color, under: Triple): Rgb {
  const a = alphaOf(over)
  const c = srgbTriple(over)
  if (a >= 1) return { mode: "rgb", r: c.r, g: c.g, b: c.b }
  return {
    mode: "rgb",
    r: c.r * a + under.r * (1 - a),
    g: c.g * a + under.g * (1 - a),
    b: c.b * a + under.b * (1 - a),
  }
}

const UNKNOWN_CONTRAST: ContrastCheck = {
  ratio: NaN,
  aaNormal: false,
  aaaNormal: false,
  aaLarge: false,
  aaaLarge: false,
  uiComponent: false,
  composited: false,
}

// WCAG 2.2 1.4.3 measures text as rendered, so alpha is composited first (50% black on white is
// 3.98:1, not 21:1) and out-of-sRGB input is gamut-mapped to the swatch actually painted
export function contrastCheck(
  foreground: Color | string,
  background: Color | string
): ContrastCheck {
  const fg = typeof foreground === "string" ? parseColor(foreground) : foreground
  const bg = typeof background === "string" ? parseColor(background) : background
  if (!fg || !bg) return UNKNOWN_CONTRAST

  const backdrop = flatten(bg, WHITE)
  const ratio = wcagContrast(flatten(fg, backdrop), backdrop)
  if (!Number.isFinite(ratio)) return UNKNOWN_CONTRAST

  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaaNormal: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
    uiComponent: ratio >= 3,
    composited: alphaOf(fg) < 1 || alphaOf(bg) < 1,
  }
}

/** closest css named colour plus whether it is an exact match */
export function nearestNamedColor(color: Color): { name: string; exact: boolean } {
  const hex = formatHex(toRgb(color)) ?? "#000000"
  const name = nearestNamed(hex)[0] ?? "black"
  return { name, exact: ciede2000(hex, name) < 0.5 }
}

export function isInSrgbGamut(color: Color): boolean {
  return inGamut("rgb")(color)
}

/** oklch/lab can describe colours sRGB cannot; this is the sRGB-safe stand-in */
export function srgbFallback(color: Color): Color {
  return isInSrgbGamut(color) ? color : clampChroma(color, "oklch")
}

// css needs a concrete value for style props; formatCss on a wide-gamut mode
// would hand the browser something older engines drop entirely
export function cssPreview(color: Color): string {
  const { r, g, b } = rgb255(srgbFallback(color))
  const a = alphaOf(color)
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${roundTo(a, 3)})` : `rgb(${r}, ${g}, ${b})`
}

export { formatCss, converter }
