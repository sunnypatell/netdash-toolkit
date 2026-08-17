import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// 1.4.3 and 1.4.11 read straight from app/globals.css, so the assertion cannot drift from the css

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8")

function tokensIn(selector: string): Record<string, string> {
  const block = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)
  if (!block) throw new Error(`no ${selector} block in app/globals.css`)
  const out: Record<string, string> = {}
  for (const m of block[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const themes = {
  light: tokensIn(":root"),
  dark: tokensIn("\\.dark"),
}

function channel(c: number) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
function luminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function ratio(a: string, b: string) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function hex(theme: keyof typeof themes, token: string) {
  const value = themes[theme][token]
  expect(value, `--${token} missing from the ${theme} theme`).toBeTruthy()
  // a token that is not an opaque hex composites over something unknown
  expect(value, `--${token} in the ${theme} theme is not an opaque hex`).toMatch(
    /^#[0-9a-fA-F]{6}$/
  )
  return value
}

// foreground token paired with the surface it is designed to sit on
const TEXT_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "popover"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  // `text-destructive` draws every validation message; checking it as a fill only missed four of six
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive", "popover"],
  // the sidebar carries its own token family and needs the same floor
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
]

// --border is deliberately absent: it draws decorative separators, which 1.4.11 does not bind
const UI_PAIRS: Array<[string, string]> = [
  ["input", "background"],
  ["ring", "background"],
  ["ring", "card"],
  ["primary", "background"],
  ["sidebar-ring", "sidebar"],
]

describe.each(["light", "dark"] as const)("%s theme", (theme) => {
  it.each(TEXT_PAIRS)("1.4.3: --%s on --%s clears 4.5:1", (fg, bg) => {
    const r = ratio(hex(theme, fg), hex(theme, bg))
    expect(
      r,
      `--${fg} (${themes[theme][fg]}) on --${bg} (${themes[theme][bg]}) is ${r.toFixed(2)}:1`
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(UI_PAIRS)("1.4.11: --%s clears 3:1 against --%s", (token, surface) => {
    const r = ratio(hex(theme, token), hex(theme, surface))
    expect(
      r,
      `--${token} (${themes[theme][token]}) on --${surface} (${themes[theme][surface]}) is ${r.toFixed(2)}:1`
    ).toBeGreaterThanOrEqual(3)
  })
})

const isColor = (v: string) => /^(#|rgb|hsl|oklch|color-mix)/.test(v)

it("defines the same colour tokens in both themes", () => {
  const colours = (t: Record<string, string>) =>
    Object.entries(t)
      .filter(([, v]) => isColor(v))
      .map(([k]) => k)
      .sort()
  expect(colours(themes.dark)).toEqual(colours(themes.light))
})

// an opaque --ring through shadcn's default 50% alpha composites to 2.09:1, so none may be translucent
const RING_ALPHA = () =>
  new RegExp(
    `(?:ring|outline)-(?:\\[[^\\]\\s]+\\]|[a-z0-9-]+)\\${"/"}(?:\\[[^\\]\\s]+\\]|\\d+%?)`,
    "g"
  )

function ringAlphaOffenders(source: string): string[] {
  return [...source.matchAll(RING_ALPHA())].map((m) => m[0])
}

// a scanner that matches nothing passes forever, so prove it fires first
it("the ring scan actually matches every shape a translucent ring is written in", () => {
  const alpha = "/"
  const known = [
    `ring-ring${alpha}50`,
    `ring-destructive${alpha}20`,
    `ring-red-500${alpha}50`,
    `outline-blue-600${alpha}50`,
    `focus-visible:ring-primary${alpha}[0.5]`,
    `ring-[#ff0000]${alpha}50`,
    `outline-ring${alpha}50`,
  ]
  for (const literal of known) {
    expect(ringAlphaOffenders(literal), `${literal} slipped past the scan`).toHaveLength(1)
  }
  // opaque rings and non-ring alphas must not be swept in
  for (const fine of [
    "ring-offset-2",
    "ring-2 ring-ring",
    "focus-visible:ring-[3px]",
    "outline-none",
  ]) {
    expect(ringAlphaOffenders(fine), fine).toEqual([])
  }
  expect(ringAlphaOffenders("hover:bg-primary/90")).toEqual([])
})

it("2.4.7 and 1.4.11: no ring is drawn at partial alpha", () => {
  const roots = ["components", "app"]
  const offenders: string[] = []
  let scanned = 0
  for (const root of roots) {
    for (const rel of readdirSync(root, { recursive: true, encoding: "utf8" })) {
      // css counts: an `@apply` of the 50% outline utility in globals.css painted every focus outline
      if (!/\.(tsx|ts|css)$/.test(rel)) continue
      scanned++
      const file = join(root, rel)
      for (const hit of ringAlphaOffenders(readFileSync(file, "utf8"))) {
        offenders.push(`${file}: ${hit}`)
      }
    }
  }
  expect(scanned).toBeGreaterThan(40)
  expect(offenders, offenders.join("\n")).toEqual([])
})

it("1.4.11: the destructive ring clears 3:1 on both page backgrounds", () => {
  for (const theme of ["light", "dark"] as const) {
    const r = ratio(hex(theme, "destructive"), hex(theme, "background"))
    expect(
      r,
      `--destructive on --background in ${theme} is ${r.toFixed(2)}:1`
    ).toBeGreaterThanOrEqual(3)
  }
})

it("1.4.11: every ring token is opaque, in both themes", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const token of Object.keys(themes[theme])) {
      if (!token.endsWith("ring")) continue
      expect(
        themes[theme][token],
        `--${token} in the ${theme} theme is translucent, so its contrast depends on the backdrop`
      ).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  }
})
