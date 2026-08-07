import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { tools } from "@/lib/tool-registry"
import { settled } from "./settle"
import { loadTool } from "@/lib/tool-loaders"

// 2.5.3: axe's label-content-name-mismatch is experimental and untagged, so the tagged run skips it

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

/** text a sighted user actually sees: excludes sr-only and aria-hidden subtrees */
function visibleText(element: Element): string {
  const clone = element.cloneNode(true) as Element
  for (const hidden of clone.querySelectorAll('.sr-only, [aria-hidden="true"], svg')) {
    hidden.remove()
  }
  return normalise(clone.textContent ?? "")
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

type Mismatch = { html: string; visible: string; name: string }

// operable controls only: a textarea's text is its value, not its label, so 2.5.3 does not bind it
const CONTROLS = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
]
  .map((selector) => `${selector}[aria-label]`)
  .join(", ")

// matched rather than counted, so a fix elsewhere just stops using an entry instead of failing
const KNOWN_OPEN: Array<{ visible: string; name: string }> = []

// a radix select trigger is a <button role="combobox">, so the tag alone is not enough
const VALUE_ROLES = new Set(["combobox", "textbox", "searchbox", "spinbutton", "listbox"])

function mismatchesIn(container: HTMLElement): Mismatch[] {
  const out: Mismatch[] = []
  for (const element of container.querySelectorAll(CONTROLS)) {
    if (VALUE_ROLES.has(element.getAttribute("role") ?? "")) continue
    const name = normalise(element.getAttribute("aria-label") ?? "")
    const visible = visibleText(element)
    if (!visible || !name) continue
    // visible text with no letters carries no word for a speech user to say
    if (!/[a-z]/.test(visible)) continue
    if (name.includes(visible)) continue
    out.push({ html: element.outerHTML.slice(0, 140), visible, name })
  }
  return out
}

afterEach(cleanup)

describe("2.5.3 label in name", () => {
  it.each(tools.map((t) => [t.slug, t] as const))(
    "%s: every visible label appears in its accessible name",
    async (slug, tool) => {
      const mod = await loadTool(tool.slug)
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      // ran synchronously until now: on the 19 lazy tools it saw 6 of reference-hub's 61 buttons
      await settled(container, slug)
      const mismatches = mismatchesIn(container).filter(
        (m) => !KNOWN_OPEN.some((known) => known.visible === m.visible && known.name === m.name)
      )
      expect(
        mismatches,
        `${slug}: the accessible name must contain the visible text, or speech input cannot address the control:\n${JSON.stringify(mismatches, null, 2)}`
      ).toEqual([])
    },
    20000
  )
})
