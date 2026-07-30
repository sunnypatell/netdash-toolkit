import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { tools } from "@/lib/tool-registry"
import { settled } from "./settle"

// wcag 2.2 sc 2.5.3 label in name, level a:
// https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html
//
// where a control shows text, its accessible name has to contain that text. this
// matters for speech input: someone saying "click copy" needs the name to include
// the word they can see. the failure mode is an aria-label written as a fuller
// description that drops the visible word, for example a button reading "Copy"
// named "Duplicate this row".
//
// axe ships label-content-name-mismatch for this, but it is an experimental rule
// and carries no wcag tag, so the tag-filtered run in tests/components/wcag.test.tsx
// does not include it. this checks all 48 tools directly.

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

// the criterion binds user interface components, not labelled containers. a
// role="region" wrapper named after its heading is correct and must not be
// reported, so the query is restricted to things a user can operate.
// value-displaying controls are deliberately absent. the text inside a textarea,
// a text input, or a closed combobox is that control's *value*, not its label,
// and 2.5.3 constrains the label. including them reported a readonly textarea
// holding a generated router config as a mismatch against its own aria-label.
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

// open findings recorded in docs/src/content/docs/accessibility-conformance.md, in files owned by
// other workstreams. matched rather than counted, so a fix elsewhere does not
// break this suite: an entry that stops matching simply stops being used.
// the dns-tools "Clear cache" / "Clear DNS cache" mismatch was the only entry
// and is fixed, so nothing is exempt any more.
const KNOWN_OPEN: Array<{ visible: string; name: string }> = []

// a radix select trigger is a <button role="combobox">, so the tag alone is not
// enough to tell a command from a value display
const VALUE_ROLES = new Set(["combobox", "textbox", "searchbox", "spinbutton", "listbox"])

function mismatchesIn(container: HTMLElement): Mismatch[] {
  const out: Mismatch[] = []
  for (const element of container.querySelectorAll(CONTROLS)) {
    if (VALUE_ROLES.has(element.getAttribute("role") ?? "")) continue
    const name = normalise(element.getAttribute("aria-label") ?? "")
    const visible = visibleText(element)
    if (!visible || !name) continue
    // a control whose visible text is only digits or punctuation carries no word
    // for a speech user to say, so there is nothing for the name to contain
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
      const mod = await tool.load()
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      // this suite ran synchronously until now, so on the 19 tools whose panels
      // are lazy it inspected the tab strip: 6 of reference-hub's 61 buttons
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
