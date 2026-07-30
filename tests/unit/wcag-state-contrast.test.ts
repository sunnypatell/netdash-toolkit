import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// wcag 2.2 sc 1.4.11 non-text contrast, level aa:
// https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
//
// tests/unit/contrast.test.ts checks the token pairs that carry text (1.4.3) and
// the boundary/ring tokens. this file covers the pairs that signal a *state*:
// the menu and listbox highlight that marks which row has roving focus. that
// highlight is a fill swap rather than a ring, so it needs 3:1 against the
// surface it sits on to be distinguishable from the unfocused rows.

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
  // components/ui/dropdown-menu.tsx and components/ui/select.tsx both mark the
  // focused row with `focus:bg-accent` over `--popover`
  it("the dark theme menu highlight clears 3:1 against the popover surface", () => {
    const r = ratio(hex("dark", "accent"), hex("dark", "popover"))
    expect(r, `--accent on --popover is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })

  // the same highlight in the light theme measures 2.54:1, which is below the
  // floor. it is recorded here rather than skipped so the number is checked
  // rather than remembered, and so that fixing --accent fails this test and
  // prompts an update to docs/accessibility-conformance.md. the mitigation is
  // that the row's text colour swaps at the same time, asserted below.
  it("the light theme menu highlight is a known open gap, still measuring under 3:1", () => {
    const r = ratio(hex("light", "accent"), hex("light", "popover"))
    expect(
      r,
      `--accent on --popover is now ${r.toFixed(2)}:1. if this reached 3:1, promote 1.4.11 to full support in docs/accessibility-conformance.md and turn this into a >= 3 assertion.`
    ).toBeLessThan(3)
    // it is not arbitrarily bad either; a regression below 2:1 is a real problem
    expect(r).toBeGreaterThan(2)
  })

  it("the focused row's text stays readable on the highlight, in both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      const r = ratio(hex(theme, "accent-foreground"), hex(theme, "accent"))
      expect(r, `--accent-foreground on --accent in ${theme} is ${r.toFixed(2)}:1`).toBeGreaterThan(
        4.5
      )
    }
  })

  // the destructive focus ring used to be drawn at 20% alpha, which composited to
  // roughly 1.2:1 and left that variant with no visible focus state. it is opaque
  // now, so the token itself has to clear 3:1 on the surfaces it lands on.
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
