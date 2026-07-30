import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { getToolBySlug, tools } from "@/lib/tool-registry"
import { MIN_RENDERED_NODES, settle } from "./settle"

// wcag 2.2 sc 4.1.3 status messages (aa) and sc 3.3.1 error identification (a):
// https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
// https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
//
// axe is silent on both. it can see that a live region is well formed but not
// that a missing one should have been there, because the result only appears
// after an async operation the rule engine never triggers. so the tools that do
// network i/o are asserted here to carry a live region at all, and every error
// message that names an id is asserted to be reachable from the field that
// produced it.
//
// the tool list is derived from runtime.offline === false in the registry rather
// than hardcoded, so a tool that starts doing network i/o is covered the moment
// its registry entry says so.

const ASYNC_TOOLS = tools.filter((tool) => tool.runtime?.offline === false)

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

const LIVE_REGION = '[role="status"], [role="alert"], [role="log"], [aria-live]'

afterEach(cleanup)

describe("4.1.3 status messages: async tools announce their results", () => {
  it("the registry still declares a meaningful set of async tools", () => {
    // if this collapses to nothing, every assertion below passes vacuously
    expect(ASYNC_TOOLS.length).toBeGreaterThanOrEqual(10)
  })

  it.each(ASYNC_TOOLS.map((t) => [t.slug, t] as const))(
    "%s renders at least one live region",
    async (slug, tool) => {
      const mod = await tool.load()
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      const nodes = await settle(container)
      expect(
        nodes,
        `${slug} rendered ${nodes} nodes, so its lazy panel never resolved`
      ).toBeGreaterThan(MIN_RENDERED_NODES)

      const regions = container.querySelectorAll(LIVE_REGION)
      expect(
        regions.length,
        `${slug} does network i/o but renders no role="status", role="alert" or aria-live, ` +
          `so a screen reader user hears nothing when a result or an error arrives`
      ).toBeGreaterThan(0)
    }
  )

  // a region that is assertive re-reads on every keystroke-driven revalidation
  // and talks over the user. the primitives settled on polite for that reason.
  it.each(ASYNC_TOOLS.map((t) => [t.slug, t] as const))(
    "%s uses no aria-live=assertive",
    async (slug, tool) => {
      const mod = await tool.load()
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settle(container)

      const shouty = [...container.querySelectorAll('[aria-live="assertive"]')].map((el) =>
        el.outerHTML.slice(0, 120)
      )
      expect(shouty, `${slug} interrupts the screen reader:\n${shouty.join("\n")}`).toEqual([])
    }
  )
})

describe("3.3.1 error identification: every message is reachable from its field", () => {
  // aria-describedby naming an id that no element carries is silently dropped by
  // assistive technology, which looks identical to no association at all. the
  // relay panels legitimately point at an id rendered by a sibling lazy chunk, so
  // a reference is only a failure when nothing anywhere in the tool supplies it
  // and the referring element is not itself in a collapsed state.
  it.each(tools.map((t) => [t.slug, t] as const))(
    "%s resolves the describedby references it renders",
    async (slug, tool) => {
      const mod = await tool.load()
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settle(container)

      const dangling: string[] = []
      for (const el of container.querySelectorAll("[aria-describedby]")) {
        for (const id of (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)) {
          // an error id only exists while the error is on screen, which is the
          // correct behaviour; those are named "-error" by convention here
          if (id.endsWith("-error")) continue
          if (!container.querySelector(`#${CSS.escape(id)}`)) {
            dangling.push(`${el.tagName.toLowerCase()}[aria-describedby~="${id}"]`)
          }
        }
      }
      expect(
        dangling,
        `${slug}: aria-describedby names an id nothing renders, so the description is dropped:\n${dangling.join("\n")}`
      ).toEqual([])
    }
  )

  // aria-invalid without a description tells the user something is wrong but not
  // what, which is the half-wired state 3.3.1 is about.
  it.each(tools.map((t) => [t.slug, t] as const))(
    "%s pairs every aria-invalid field with a description",
    async (slug, tool) => {
      const mod = await tool.load()
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settle(container)

      const unexplained: string[] = []
      for (const el of container.querySelectorAll('[aria-invalid="true"]')) {
        if (!el.getAttribute("aria-describedby")) {
          unexplained.push(el.outerHTML.slice(0, 140))
        }
      }
      expect(
        unexplained,
        `${slug}: a field marked invalid with no aria-describedby names no reason:\n${unexplained.join("\n")}`
      ).toEqual([])
    }
  )
})

// the assertions above prove a region and an association exist in the resting
// tree. these drive the actual interaction, because a region that is present but
// never populated announces exactly as much as no region at all.
describe("3.3.1 / 4.1.3: the association holds once a real error is produced", () => {
  // the panel is driven directly: the parent holds this value in nuqs query
  // state, which the testing adapter does not write back, so typing into the
  // rendered tool would assert nothing.
  it("port-scanner names the reason a port list was rejected", async () => {
    const { default: CustomPortsPanel } = await import("@/components/tools/port-scanner/custom")
    const { container } = render(
      <Providers>
        <CustomPortsPanel
          value="not-a-port"
          onValueChange={() => {}}
          disabled={false}
          browserMode
          onScan={() => {}}
        />
      </Providers>
    )
    await settle(container, 5)

    const field = screen.getByLabelText(/comma-separated/i)
    expect(field.getAttribute("aria-invalid")).toBe("true")
    const describedBy = field.getAttribute("aria-describedby")
    expect(describedBy, "the rejected field points at no description").toBeTruthy()

    // every id it names must resolve, and together they must say why
    const text = (describedBy ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => {
        const el = container.querySelector(`#${CSS.escape(id)}`)
        expect(el, `aria-describedby names "${id}" but nothing renders it`).not.toBeNull()
        return el?.textContent ?? ""
      })
      .join(" ")
    expect(text).toMatch(/not a port number or range/i)
  })

  it("email-diagnostics announces a rejected domain and ties it to the field", async () => {
    const user = userEvent.setup()
    const tool = getToolBySlug("email-diagnostics")
    expect(tool, "email-diagnostics left the registry").toBeTruthy()
    const Tool = (await tool!.load()).default
    const { container } = render(
      <Providers>
        <Tool />
      </Providers>
    )
    await settle(container)

    const field = screen.getByLabelText(/^domain$/i)
    await user.type(field, "not a domain")
    await user.click(screen.getByRole("button", { name: /run diagnostics/i }))
    await settle(container)

    expect(field.getAttribute("aria-invalid")).toBe("true")
    const id = field.getAttribute("aria-describedby")
    expect(id, "the invalid field points at no description").toBeTruthy()

    const message = container.querySelector(`#${CSS.escape(id!)}`)
    expect(message, `aria-describedby names "${id}" but nothing renders it`).not.toBeNull()
    expect(message?.textContent ?? "").toMatch(/not a valid domain/i)

    // and it has to be inside something that announces, or it is only visible
    expect(
      message?.closest('[role="alert"], [role="status"], [aria-live]'),
      "the message renders in no live region, so it is never spoken"
    ).not.toBeNull()
  })
})
