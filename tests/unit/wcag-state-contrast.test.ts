import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// 1.4.11 for the pairs that signal state: the roving-focus highlight is a fill swap, so 3:1 binds it

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8")

function tokensIn(selector: string): Record<string, string> {
  const block = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)
  if (!block) throw new Error(`no ${selector} block in app/globals.css`)
  const out: Record<string, string> = {}
  for (const m of block[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const themes = { light: tokensIn(":root"), dark: tokensIn("\\.dark") }

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
  expect(value, `--${token} missing from the ${theme} theme`).toMatch(/^#[0-9a-fA-F]{6}$/)
  return value
}

describe("1.4.11 state indicators", () => {
  // dropdown-menu.tsx and select.tsx both mark the focused row with `focus:bg-accent` over --popover
  it("the dark theme menu highlight clears 3:1 against the popover surface", () => {
    const r = ratio(hex("dark", "accent"), hex("dark", "popover"))
    expect(r, `--accent on --popover is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })

  // was 2.54:1 while --accent was emerald-500; emerald-700 took it to 5.48:1
  it("the light theme menu highlight clears 3:1 against the popover surface", () => {
    const r = ratio(hex("light", "accent"), hex("light", "popover"))
    expect(r, `--accent on --popover is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })

  it("the focused row's text stays readable on the highlight, in both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      const r = ratio(hex(theme, "accent-foreground"), hex(theme, "accent"))
      expect(r, `--accent-foreground on --accent in ${theme} is ${r.toFixed(2)}:1`).toBeGreaterThan(
        4.5
      )
    }
  })

  // the same family one level down, and harder because --sidebar is not white
  it("the light theme sidebar highlight clears 3:1", () => {
    const r = ratio(hex("light", "sidebar-accent"), hex("light", "sidebar"))
    expect(r, `--sidebar-accent on --sidebar is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })

  it("the dark theme sidebar highlight clears 3:1", () => {
    const r = ratio(hex("dark", "sidebar-accent"), hex("dark", "sidebar"))
    expect(r, `--sidebar-accent on --sidebar is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })

  // this ring was 20% alpha, composited to ~1.2:1; opaque now, so the token itself has to pass
  it("2.4.7: the destructive focus ring clears 3:1 on the page surfaces", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const surface of ["background", "card", "popover"] as const) {
        const r = ratio(hex(theme, "destructive"), hex(theme, surface))
        expect(
          r,
          `--destructive on --${surface} in ${theme} is ${r.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })
})

// --destructive is a foreground too: alert on bg-card, menu on bg-popover, dialog on bg-background
describe("1.4.3 --destructive as a foreground", () => {
  // a red dark enough for the light surfaces was too dark for the dark ones, so it is per theme
  const PASSING: Array<[keyof typeof themes, string]> = [
    ["light", "background"],
    ["light", "popover"],
    ["light", "card"],
    ["dark", "background"],
    ["dark", "card"],
    ["dark", "popover"],
  ]

  it.each(PASSING)("%s: error text on --%s clears 4.5:1", (theme, surface) => {
    const r = ratio(hex(theme, "destructive"), hex(theme, surface))
    expect(
      r,
      `--destructive on --${surface} in ${theme} is ${r.toFixed(2)}:1`
    ).toBeGreaterThanOrEqual(4.5)
  })

  // the alert description was drawn at 90% alpha, costing another 0.4 of a ratio point
  it("no destructive text is drawn at partial alpha", () => {
    const offenders: string[] = []
    for (const rel of readdirSync(join("components", "ui"), { encoding: "utf8" })) {
      if (!rel.endsWith(".tsx")) continue
      const file = join("components", "ui", rel)
      for (const m of readFileSync(file, "utf8").matchAll(/text-destructive\/(\d+)/g)) {
        offenders.push(`${file}: ${m[0]}`)
      }
    }
    expect(
      offenders,
      `a translucent foreground composites against whatever is behind it, so its contrast is not knowable:\n${offenders.join("\n")}`
    ).toEqual([])
  })
})
