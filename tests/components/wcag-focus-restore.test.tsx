import { cleanup, render, fireEvent } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { tools } from "@/lib/tool-registry"
import { settled } from "./settle"
import { loadTool } from "@/lib/tool-loaders"

// 2.4.3: a self-removing button drops focus to <body>; axe cannot see it, the markup is fine

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

// each entry names a control that deletes the row it lives in
const SELF_REMOVING = [
  { slug: "vlsm-planner", label: /^Remove subnet requirement/ },
  { slug: "vlan-manager", label: /^Delete VLAN/ },
  { slug: "acl-generator", label: /^Delete rule/ },
] as const

// url-encoder and vlan-manager/ports match too, but sit behind a tab the adapter cannot switch

afterEach(cleanup)

describe("wcag 2.4.3: focus survives a control that deletes itself", () => {
  it.each(SELF_REMOVING.map((c) => [c.slug, c] as const))(
    "%s keeps focus somewhere useful",
    async (slug, target) => {
      const tool = tools.find((t) => t.slug === slug)
      expect(tool, `${slug} is not in the registry`).toBeDefined()
      const Tool = (await loadTool(tool!.slug)).default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settled(container, slug)

      const buttons = Array.from(container.querySelectorAll("button")).filter((b) =>
        target.label.test(b.getAttribute("aria-label") ?? "")
      )
      // without this the whole case passes by finding nothing to click
      expect(
        buttons.length,
        `${slug}: no control matching ${target.label}, so this proves nothing`
      ).toBeGreaterThan(0)

      const button = buttons[0]
      button.focus()
      expect(document.activeElement, `${slug}: could not focus the control`).toBe(button)

      fireEvent.click(button)

      expect(button.isConnected, `${slug}: the control did not remove itself`).toBe(false)
      expect(
        document.activeElement,
        `${slug}: focus fell to <body> after the row was deleted, so a keyboard user is thrown to the top of the page`
      ).not.toBe(document.body)
      expect(document.activeElement, `${slug}: focus left the tool entirely`).not.toBeNull()
      expect(container.contains(document.activeElement)).toBe(true)
    },
    20000
  )
})
