import { cleanup, render, fireEvent, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { loadTool } from "@/lib/tool-loaders"
import { settled } from "./settle"

// 4.1.3, the inverse failure. these are synchronous calculators, so a result
// exists for every intermediate value the user types. announcing each one read
// the whole conversion table four times while typing "1000". polite does not
// fix that, it queues it, so the user hears every keystroke before the answer.

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

function liveText(container: HTMLElement): string {
  return Array.from(container.querySelectorAll('[role="status"], [aria-live]'))
    .map((n) => n.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" | ")
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("wcag 4.1.3: a derived result does not announce on every keystroke", () => {
  it("bandwidth-calculator announces once, after the typing stops", async () => {
    const Tool = (await loadTool("bandwidth-calculator")).default
    const { container } = render(
      <Providers>
        <Tool />
      </Providers>
    )
    await settled(container, "bandwidth-calculator")

    const input = container.querySelector<HTMLInputElement>(
      'input[type="number"], input[inputmode]'
    )
    expect(input, "no numeric field, so this proves nothing").not.toBeNull()

    const announcements: string[] = []
    for (const value of ["1", "10", "100", "1000"]) {
      fireEvent.change(input!, { target: { value } })
      await act(async () => {
        vi.advanceTimersByTime(80)
      })
      announcements.push(liveText(container))
    }

    const spoken = new Set(announcements.filter(Boolean))
    expect(
      spoken.size,
      `announced ${spoken.size} times while typing, so the user hears every intermediate value: ${[...spoken].join(" >> ")}`
    ).toBe(0)

    // and it does arrive once the user stops
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(
      liveText(container),
      "nothing was announced at all, which is the opposite failure"
    ).not.toBe("")
  }, 20000)

  // the nesting check lives in tests/unit/wcag-nested-live-regions.test.ts. a
  // rendered version of it was vacuous: at rest these tools show no ResultCard,
  // so restoring the wrapper on cable-calculator left it green.
})
