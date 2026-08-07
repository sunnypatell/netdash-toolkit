import { act } from "@testing-library/react"
import { expect } from "vitest"

// unwaited, a suite scans a 64 node tab strip instead of the 797 node tool
export async function settle(container: HTMLElement, maxTicks = 25): Promise<number> {
  let previous = -1
  let stable = 0
  for (let i = 0; i < maxTicks; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    const count = container.querySelectorAll("*").length
    stable = count === previous ? stable + 1 : 0
    previous = count
    // a lazy chunk holds the count still for ticks: network-tester goes 23,23,23,23,56 from cold
    if (stable >= STABLE_TICKS && count > MIN_RENDERED_NODES && !pendingFallback(container)) {
      return count
    }
  }
  return previous
}

// under this the panel never resolved and every later assertion checks an empty shell
export const MIN_RENDERED_NODES = 25

// reference-hub's tab strip alone is 64 nodes, so two quiet ticks over a shell clear the floor
const STABLE_TICKS = 3

// the data-panel-fallback marker is what closes this; the text arm cannot be made reliable, see
// docs/src/content/docs/contributing/tests-and-gates.md
const PENDING_FALLBACK = /(?:^|[^a-z])loading(?![a-z])/i

export function pendingFallback(container: HTMLElement): boolean {
  if (container.querySelector("[data-panel-fallback]")) return true
  return PENDING_FALLBACK.test(container.textContent ?? "")
}

// the one shared gate: the 2.5.3 suite had none and scanned 6 of reference-hub's 61 buttons
export async function settled(container: HTMLElement, slug: string): Promise<number> {
  const nodes = await settle(container)
  expect(
    nodes,
    `${slug} rendered only ${nodes} nodes, so the suite would scan a shell rather than the tool`
  ).toBeGreaterThan(MIN_RENDERED_NODES)
  expect(
    pendingFallback(container),
    `${slug} still shows a Suspense fallback after settling, so its lazy panel never resolved`
  ).toBe(false)
  return nodes
}
