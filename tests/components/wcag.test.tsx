import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import axe from "axe-core"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { tools } from "@/lib/tool-registry"

// automated wcag 2.2 aa gate. axe cannot prove conformance on its own - roughly
// a third of the success criteria need human judgement - but it does catch the
// mechanically detectable failures, and it catches them on all 48 tools in one
// run instead of a manual pass per tool. the criteria axe cannot see are
// covered by the assertions further down and by docs/accessibility.

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: "tag",
    // wcag2a + wcag2aa + wcag21a + wcag21aa + wcag22aa is exactly the 2.2 AA set
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  rules: {
    // happy-dom has no layout engine, so contrast is computed against a page
    // that never painted. contrast is asserted from the token values instead,
    // in tests/unit/contrast.test.ts
    "color-contrast": { enabled: false },
  },
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

async function violationsOf(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 160)),
  }))
}

afterEach(cleanup)

describe("wcag 2.2 aa: every tool", () => {
  it.each(tools.map((t) => [t.slug, t] as const))(
    "%s has no detectable violations",
    async (slug, tool) => {
      const mod = await tool.load()
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      const violations = await violationsOf(container)
      expect(violations, `${slug}:\n${JSON.stringify(violations, null, 2)}`).toEqual([])
    },
    20000
  )
})
