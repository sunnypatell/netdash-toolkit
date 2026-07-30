import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { tools } from "@/lib/tool-registry"

// mounts all 48 tools for real. a tool that throws on mount, imports something
// missing, or crashes in a provider fails here in seconds, which is the cheap
// rigorous substitute for clicking through every tool by hand.

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProjectProvider>{children}</ProjectProvider>
    </AuthProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("every registered tool mounts", () => {
  it.each(tools.map((t) => [t.slug, t] as const))(
    "%s renders without crashing",
    async (slug, tool) => {
      const errors: unknown[][] = []
      const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(args)
      })

      const mod = await tool.load()
      const Tool = mod.default
      expect(Tool, `${slug} exported no component`).toBeTypeOf("function")

      render(
        <Providers>
          <Tool />
        </Providers>
      )

      // something must actually be on screen; an empty mount is a broken tool
      expect(document.body.textContent?.trim().length ?? 0).toBeGreaterThan(0)

      // react logs thrown render errors through console.error, so treat those as
      // failures while ignoring jsdom's unimplemented-css noise
      const real = errors.filter((e) => {
        const text = String(e[0] ?? "")
        return !/not implemented|Not implemented|css|jsdom/i.test(text)
      })
      expect(real, `${slug} logged react errors: ${JSON.stringify(real.slice(0, 2))}`).toEqual([])

      spy.mockRestore()
    }
  )
})

describe("tool accessibility basics", () => {
  it.each(tools.map((t) => [t.slug, t] as const))("%s exposes a heading", async (slug, tool) => {
    const mod = await tool.load()
    const Tool = mod.default
    render(
      <Providers>
        <Tool />
      </Providers>
    )
    // every tool page needs a heading for screen-reader navigation
    const headings = screen.queryAllByRole("heading")
    expect(headings.length, `${slug} renders no heading`).toBeGreaterThan(0)
  })
})
