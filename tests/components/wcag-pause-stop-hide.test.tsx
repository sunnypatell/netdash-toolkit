import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { settled } from "./settle"

// wcag 2.2 sc 2.2.2 pause, stop, hide (a):
// https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
//
// three tools start a clock on mount that updates indefinitely: the current-time
// card, the jwt countdown, and the cron next-run projection. the criterion wants
// a mechanism to stop it, and "there is a button" is not the same claim as "the
// thing actually stops". so the interval itself is what is asserted here.
//
// only setInterval is faked. setTimeout stays real because settled() waits on it,
// and vi.getTimerCount() then counts exactly the intervals these tools own: it
// goes from one to zero when the pause takes effect, and back to one on resume.
// deleting the `if (paused) return` guard leaves the button toggling its
// aria-pressed while the clock keeps running, and that is the input this fails on.

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

interface Clock {
  slug: string
  load: () => Promise<{ default: () => React.JSX.Element }>
  // jwt-decoder only runs its countdown once a token with a time claim is loaded
  arm?: (container: HTMLElement) => void
}

const CLOCKS: Clock[] = [
  {
    slug: "timestamp-converter",
    load: async () => ({
      default: (await import("@/components/tools/timestamp-converter")).TimestampConverter,
    }),
  },
  {
    slug: "cron-parser",
    load: async () => ({
      default: (await import("@/components/tools/cron-parser")).CronParser,
    }),
  },
  {
    slug: "jwt-decoder",
    load: async () => ({
      default: (await import("@/components/tools/jwt-decoder")).JWTDecoder,
    }),
    arm: (container) => {
      const sample = [...container.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Load Sample"
      )
      expect(
        sample,
        "jwt-decoder no longer has a Load Sample button to arm the countdown"
      ).toBeDefined()
      fireEvent.click(sample as HTMLButtonElement)
    },
  },
]

function toggleOf(container: HTMLElement): HTMLButtonElement {
  const pressable = [...container.querySelectorAll("button[aria-pressed]")]
  expect(
    pressable.length,
    "expected exactly one aria-pressed toggle, which is the pause control"
  ).toBe(1)
  return pressable[0] as HTMLButtonElement
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("2.2.2: every automatically updating clock can be stopped", () => {
  it.each(CLOCKS.map((c) => [c.slug, c] as const))("%s stops and restarts", async (slug, clock) => {
    const Tool = (await clock.load()).default
    const { container } = render(
      <Providers>
        <Tool />
      </Providers>
    )
    await settled(container, slug)
    clock.arm?.(container)

    expect(
      vi.getTimerCount(),
      `${slug} registered no interval, so this test is not exercising a live clock`
    ).toBeGreaterThan(0)

    const toggle = toggleOf(container)

    // 2.2.2 wants a mechanism, and a mechanism a sighted user cannot identify is
    // not one. an icon-only toggle would leave this empty.
    expect(
      toggle.textContent?.trim(),
      `${slug}'s pause control carries no visible label text`
    ).toMatch(/pause/i)
    expect(toggle.getAttribute("aria-pressed")).toBe("false")

    fireEvent.click(toggle)
    expect(toggle.getAttribute("aria-pressed")).toBe("true")
    expect(toggle.textContent?.trim(), `${slug} does not relabel on pause`).toMatch(/resume/i)
    expect(
      vi.getTimerCount(),
      `${slug} still has an interval running after its pause control was pressed, so the ` +
        `control changes its own state and nothing else`
    ).toBe(0)

    fireEvent.click(toggle)
    expect(toggle.getAttribute("aria-pressed")).toBe("false")
    expect(
      vi.getTimerCount(),
      `${slug} never restarts after resume, so the pause is one-way`
    ).toBeGreaterThan(0)
  })
})
