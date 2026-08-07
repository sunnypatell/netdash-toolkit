import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { settled } from "./settle"

// 2.2.2: "there is a button" is not "the clock stops", so the interval itself is what is asserted

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
  // setTimeout stays real because settled() waits on it, so the count is exactly these intervals
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

    // a mechanism a sighted user cannot identify is not one; an icon-only toggle leaves this empty
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
