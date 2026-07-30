import { describe, expect, it } from "vitest"
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
} from "@/lib/color-convert"

function parsed(input: string): Color {
  const color = parseColor(input)
  if (!color) throw new Error(`expected ${input} to parse`)
  return color
}

describe("parsing accepts every css colour form", () => {
  it("accepts hex shorthand instead of silently rejecting it", () => {
    expect(rgb255(parsed("#fff"))).toEqual({ r: 255, g: 255, b: 255 })
    expect(rgb255(parsed("fff"))).toEqual({ r: 255, g: 255, b: 255 })
    expect(rgb255(parsed("#0a0"))).toEqual({ r: 0, g: 170, b: 0 })
  })

  it("accepts 4- and 8-digit hex with alpha", () => {
    expect(alphaOf(parsed("#ffff"))).toBe(1)
    expect(alphaOf(parsed("#00000080"))).toBeCloseTo(0.502, 3)
    expect(rgb255(parsed("#3b82f680"))).toEqual({ r: 59, g: 130, b: 246 })
  })

  it("accepts named colours", () => {
    expect(rgb255(parsed("rebeccapurple"))).toEqual({ r: 102, g: 51, b: 153 })
    expect(rgb255(parsed("tomato"))).toEqual({ r: 255, g: 99, b: 71 })
  })

  it.each([
    "rgb(59 130 246)",
    "rgba(59, 130, 246, 0.5)",
    "hsl(217 91% 60%)",
    "hwb(217 23% 4%)",
    "lab(54.6% 8.76 -65.79)",
    "lch(54.6% 66.4 277.6)",
    "oklab(0.623 -0.033 -0.185)",
    "oklch(0.62 0.19 260)",
    "color(display-p3 0.3 0.5 0.93)",
  ])("accepts %s", (input) => {
    expect(parseColor(input)).not.toBeNull()
  })

  it("preserves the authored mode so nothing round-trips through rgb", () => {
    expect(parsed("oklch(0.62 0.19 260)").mode).toBe("oklch")
    expect(parsed("hsl(217 91% 60%)").mode).toBe("hsl")
    expect(parsed("lab(54.6% 8.76 -65.79)").mode).toBe("lab")
  })

  it("rejects nonsense so the ui can show an error", () => {
    for (const input of ["", "  ", "notacolor", "#ff", "#fffff", "rgb(oops)"]) {
      expect(parseColor(input), input).toBeNull()
    }
  })
})

describe("hue survives extremes when hsl is authoritative", () => {
  it("keeps hue at zero saturation", () => {
    // the round-trip bug: hsl -> rounded rgb -> hsl loses hue whenever s=0
    const grey: Color = { mode: "hsl", h: 217, s: 0, l: 0.5 }
    expect(hslDisplay(grey)).toEqual({ h: 217, s: 0, l: 50 })
  })

  it("keeps hue at l=0 and l=100", () => {
    expect(hslDisplay({ mode: "hsl", h: 300, s: 0.9, l: 0 })).toEqual({ h: 300, s: 90, l: 0 })
    expect(hslDisplay({ mode: "hsl", h: 300, s: 0.9, l: 1 })).toEqual({ h: 300, s: 90, l: 100 })
  })

  it("loses nothing when only saturation then hue is changed", () => {
    // simulates the slider path: state stays in hsl mode across edits
    let state: Color = { mode: "hsl", h: 0, s: 0, l: 0.5 }
    state = { mode: "hsl", h: 217, s: hslDisplay(state).s / 100, l: hslDisplay(state).l / 100 }
    expect(hslDisplay(state).h).toBe(217)
    state = { mode: "hsl", h: hslDisplay(state).h, s: 0.9, l: hslDisplay(state).l / 100 }
    expect(hslDisplay(state)).toEqual({ h: 217, s: 90, l: 50 })
  })

  it("reports hue 0 rather than NaN for an achromatic rgb colour", () => {
    expect(hslDisplay(parsed("#808080"))).toEqual({ h: 0, s: 0, l: 50 })
    expect(oklchDisplay(parsed("#808080")).h).toBe(0)
  })
})

describe("cmyk is bidirectional", () => {
  it("converts rgb to cmyk", () => {
    expect(rgbToCmyk(parsed("#3b82f6"))).toEqual({ c: 76, m: 47, y: 0, k: 4 })
    expect(rgbToCmyk(parsed("#000000"))).toEqual({ c: 0, m: 0, y: 0, k: 100 })
    expect(rgbToCmyk(parsed("#ffffff"))).toEqual({ c: 0, m: 0, y: 0, k: 0 })
  })

  it("converts cmyk back to rgb", () => {
    expect(rgb255(cmykToRgb({ c: 0, m: 100, y: 100, k: 0 }))).toEqual({ r: 255, g: 0, b: 0 })
    expect(rgb255(cmykToRgb({ c: 0, m: 0, y: 0, k: 100 }))).toEqual({ r: 0, g: 0, b: 0 })
    expect(rgb255(cmykToRgb({ c: 100, m: 0, y: 100, k: 0 }))).toEqual({ r: 0, g: 255, b: 0 })
  })

  it("round-trips within rounding tolerance", () => {
    const start = parsed("#3b82f6")
    const back = rgb255(cmykToRgb(rgbToCmyk(start)))
    const original = rgb255(start)
    for (const channel of ["r", "g", "b"] as const) {
      expect(Math.abs(back[channel] - original[channel])).toBeLessThanOrEqual(3)
    }
  })

  it("carries alpha through", () => {
    expect(alphaOf(cmykToRgb({ c: 0, m: 0, y: 0, k: 0 }, 0.4))).toBe(0.4)
  })
})

describe("output strings", () => {
  it("emits every space", () => {
    const strings = toStrings(parsed("#3b82f6"))
    expect(strings.hex).toBe("#3b82f6")
    expect(strings.hex8).toBe("#3b82f6ff")
    expect(strings.rgb).toBe("rgb(59 130 246)")
    // 2dp, not integers: see the round-trip fidelity test below
    expect(strings.hsl).toBe("hsl(217.22 91.22% 59.8%)")
    expect(strings.hwb).toMatch(/^hwb\(/)
    expect(strings.lab).toMatch(/^lab\(/)
    expect(strings.lch).toMatch(/^lch\(/)
    expect(strings.oklab).toMatch(/^oklab\(/)
    expect(strings.oklch).toMatch(/^oklch\(/)
    expect(strings.p3).toMatch(/^color\(display-p3 /)
    expect(strings.cmyk).toBe("cmyk(76%, 47%, 0%, 4%)")
  })

  it("includes alpha in every notation when it is below 1", () => {
    const strings = toStrings(parsed("#3b82f680"))
    expect(strings.rgb).toMatch(/\/ 0\.502\)$/)
    expect(strings.hsl).toMatch(/\/ 0\.502\)$/)
    expect(strings.oklch).toMatch(/\/ 0\.502\)$/)
    expect(strings.hex8).toBe("#3b82f680")
  })

  it("round-trips its own output", () => {
    const original = parsed("#3b82f6")
    const strings = toStrings(original)
    for (const value of [strings.hex, strings.rgb, strings.hsl, strings.oklch, strings.lab]) {
      const back = parseColor(value)
      expect(back, value).not.toBeNull()
      const rgb = rgb255(back!)
      const expected = rgb255(original)
      for (const channel of ["r", "g", "b"] as const) {
        expect(
          Math.abs(rgb[channel] - expected[channel]),
          `${value} ${channel}`
        ).toBeLessThanOrEqual(2)
      }
    }
  })

  it("gives css a concrete sRGB value even for wide-gamut input", () => {
    expect(cssPreview(parsed("#3b82f6"))).toBe("rgb(59, 130, 246)")
    expect(cssPreview(parsed("#3b82f680"))).toMatch(/^rgba\(59, 130, 246, 0\.502\)$/)
    expect(cssPreview(parsed("oklch(0.7 0.35 150)"))).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
  })
})

describe("wcag contrast", () => {
  it("black on white is 21:1 and passes everything", () => {
    const check = contrastCheck("#000000", "#ffffff")
    expect(check.ratio).toBeCloseTo(21, 5)
    expect(check).toMatchObject({
      aaNormal: true,
      aaaNormal: true,
      aaLarge: true,
      aaaLarge: true,
      uiComponent: true,
    })
  })

  it("identical colours are 1:1 and fail everything", () => {
    const check = contrastCheck("#3b82f6", "#3b82f6")
    expect(check.ratio).toBeCloseTo(1, 5)
    expect(check.aaLarge).toBe(false)
  })

  it("catches the classic mid-blue-on-white failure", () => {
    const check = contrastCheck("#3b82f6", "#ffffff")
    expect(check.ratio).toBeCloseTo(3.68, 2)
    expect(check.aaNormal).toBe(false)
    expect(check.aaLarge).toBe(true)
    expect(check.aaaLarge).toBe(false)
  })

  it("applies the thresholds at their exact boundaries", () => {
    const at = (ratio: number) => ({
      aaNormal: ratio >= 4.5,
      aaaNormal: ratio >= 7,
      aaLarge: ratio >= 3,
    })
    // sanity check of the threshold table itself against known pairs
    expect(at(4.5)).toEqual({ aaNormal: true, aaaNormal: false, aaLarge: true })
    const grey = contrastCheck("#767676", "#ffffff")
    expect(grey.ratio).toBeGreaterThanOrEqual(4.5)
    expect(grey.aaNormal).toBe(true)
    expect(grey.aaaNormal).toBe(false)
  })

  it("is symmetric", () => {
    expect(contrastCheck("#123456", "#fedcba").ratio).toBeCloseTo(
      contrastCheck("#fedcba", "#123456").ratio,
      10
    )
  })

  // 1.4.3 measures the text as rendered, so alpha has to be composited first.
  // ignoring it reported 50% black on white as 21:1, a wrong pass.
  it("composites a translucent foreground instead of reading it as opaque", () => {
    const half = contrastCheck("rgb(0 0 0 / 0.5)", "#ffffff")
    expect(half.composited).toBe(true)
    // 50% black over white is #808080, which is a little under 4:1
    expect(half.ratio).toBeCloseTo(contrastCheck("#808080", "#ffffff").ratio, 1)
    expect(half.ratio).toBeLessThan(5)
    expect(half.aaNormal).toBe(false)
  })

  it("treats a fully transparent foreground as the background, not as black", () => {
    expect(contrastCheck("#00000000", "#ffffff").ratio).toBeCloseTo(1, 5)
  })

  it("flattens a translucent background over white rather than ignoring its alpha", () => {
    const check = contrastCheck("#000000", "rgb(255 255 255 / 0.5)")
    expect(check.composited).toBe(true)
    expect(check.ratio).toBeCloseTo(21, 5)
  })

  it("marks an opaque pair as not composited", () => {
    expect(contrastCheck("#000000", "#ffffff").composited).toBe(false)
  })

  // it used to throw a TypeError out of culori on anything unparsable
  it("returns NaN and fails every threshold for input it cannot parse", () => {
    for (const bad of ["notacolour", "", "#ff", "rgb(", "oklch(nope)"]) {
      const check = contrastCheck(bad, "#ffffff")
      expect(Number.isNaN(check.ratio)).toBe(true)
      expect(check.aaNormal).toBe(false)
      expect(check.aaLarge).toBe(false)
      expect(check.uiComponent).toBe(false)
    }
  })

  // the ratio has to describe the swatch that gets painted, and a wide-gamut
  // colour is painted gamut-mapped
  it("gamut-maps a wide-gamut colour before measuring it", () => {
    const check = contrastCheck("oklch(0.7 0.35 150)", "#ffffff")
    expect(Number.isFinite(check.ratio)).toBe(true)
    expect(check.ratio).toBeGreaterThan(1)
  })
})

describe("hsl output fidelity", () => {
  // integer hsl() addresses ~4.9e5 states against 16.7M sRGB colours, so a
  // copied hsl(217 91% 60%) used to re-parse up to 5/255 away from its source
  it("round-trips a copied hsl string to within one 8-bit step", () => {
    let worst = 0
    let worstCase = ""
    for (let r = 0; r < 256; r += 7) {
      for (let g = 0; g < 256; g += 7) {
        for (let b = 0; b < 256; b += 7) {
          const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
          const back = parsed(toStrings(parsed(hex)).hsl)
          const backHex = toStrings(back).hex
          const channels = [1, 3, 5].map((i) => Number.parseInt(backHex.slice(i, i + 2), 16))
          const error = Math.max(
            Math.abs(channels[0] - r),
            Math.abs(channels[1] - g),
            Math.abs(channels[2] - b)
          )
          if (error > worst) {
            worst = error
            worstCase = `${hex} -> ${toStrings(parsed(hex)).hsl} -> ${backHex}`
          }
        }
      }
    }
    expect(worst, worstCase).toBeLessThanOrEqual(1)
  })
})

describe("gamut and naming", () => {
  it("detects out-of-sRGB colours", () => {
    expect(isInSrgbGamut(parsed("#3b82f6"))).toBe(true)
    expect(isInSrgbGamut(parsed("oklch(0.7 0.35 150)"))).toBe(false)
  })

  it("names exact and nearest css colours", () => {
    expect(nearestNamedColor(parsed("#663399"))).toEqual({ name: "rebeccapurple", exact: true })
    expect(nearestNamedColor(parsed("#ffffff"))).toEqual({ name: "white", exact: true })
    const near = nearestNamedColor(parsed("#3b82f6"))
    expect(near.exact).toBe(false)
    expect(near.name).toBe("dodgerblue")
  })
})
