import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { getToolBySlug, tools } from "@/lib/tool-registry"
import { settle, settled } from "./settle"
import { loadTool } from "@/lib/tool-loaders"

// 4.1.3 and 3.3.1: axe cannot see a region that should have been there, the result is async

// from the registry, so a tool that starts doing network i/o is covered the moment it says so
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

// Alert is itself a live region, and a static notice must not satisfy this for a tool
const RESULT_REGION = ['[role="status"]', '[role="alert"]', '[role="log"]', "[aria-live]"].join(
  ", "
)

function resultRegions(container: HTMLElement): Element[] {
  return [...container.querySelectorAll(RESULT_REGION)].filter(
    (el) => !el.matches("[data-slot=alert]")
  )
}

afterEach(cleanup)

describe("4.1.3 status messages: async tools announce their results", () => {
  it("the registry still declares a meaningful set of async tools", () => {
    // if this collapses to nothing, every assertion below passes vacuously
    expect(ASYNC_TOOLS.length).toBeGreaterThanOrEqual(10)
  })

  it.each(ASYNC_TOOLS.map((t) => [t.slug, t] as const))(
    "%s renders at least one live region",
    async (slug, tool) => {
      const mod = await loadTool(tool.slug)
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settled(container, slug)

      const regions = resultRegions(container)
      expect(
        regions.length,
        `${slug} does network i/o but renders no role="status", role="alert" or aria-live, ` +
          `so a screen reader user hears nothing when a result or an error arrives`
      ).toBeGreaterThan(0)
    }
  )

  // assertive re-reads on every keystroke and talks over the user; the primitives use polite
  it.each(ASYNC_TOOLS.map((t) => [t.slug, t] as const))(
    "%s uses no aria-live=assertive",
    async (slug, tool) => {
      const mod = await loadTool(tool.slug)
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settled(container, slug)

      const shouty = [...container.querySelectorAll('[aria-live="assertive"]')].map((el) =>
        el.outerHTML.slice(0, 120)
      )
      expect(shouty, `${slug} interrupts the screen reader:\n${shouty.join("\n")}`).toEqual([])
    }
  )
})

describe("3.3.1 error identification: every message is reachable from its field", () => {
  // at rest, zero of the 48 carry aria-invalid and six render aria-describedby, so pin the six
  it("the resting scan still has something to inspect", async () => {
    let withDescribedBy = 0
    for (const tool of tools) {
      const Tool = (await loadTool(tool.slug)).default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settled(container, tool.slug)
      if (container.querySelector("[aria-describedby]")) withDescribedBy++
      cleanup()
    }
    expect(
      withDescribedBy,
      "no tool renders an aria-describedby at rest, so the scan below asserts nothing"
    ).toBeGreaterThanOrEqual(5)
  }, 120000)

  // a dangling id is dropped silently; relay panels legitimately point at a sibling lazy chunk
  it.each(tools.map((t) => [t.slug, t] as const))(
    "%s resolves the describedby references it renders",
    async (slug, tool) => {
      const mod = await loadTool(tool.slug)
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settled(container, slug)

      const dangling: string[] = []
      for (const el of container.querySelectorAll("[aria-describedby]")) {
        for (const id of (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)) {
          // an error id exists only while the error is on screen, named "-error" by convention
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

  // aria-invalid with no description says something is wrong but not what
  it.each(tools.map((t) => [t.slug, t] as const))(
    "%s pairs every aria-invalid field with a description",
    async (slug, tool) => {
      const mod = await loadTool(tool.slug)
      const Tool = mod.default
      const { container } = render(
        <Providers>
          <Tool />
        </Providers>
      )
      await settled(container, slug)

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

// the scans above are the resting tree; a region that is never populated announces nothing
describe("3.3.1 / 4.1.3: the association holds once a real error is produced", () => {
  // driven directly: the parent holds this in nuqs query state, which the adapter never writes back
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
    const Tool = (await loadTool(tool!.slug)).default
    const { container } = render(
      <Providers>
        <Tool />
      </Providers>
    )
    await settled(container, "email-diagnostics")

    const field = screen.getByLabelText(/^domain$/i)
    await user.type(field, "not a domain")
    await user.click(screen.getByRole("button", { name: /run diagnostics/i }))
    await settled(container, "email-diagnostics")

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
