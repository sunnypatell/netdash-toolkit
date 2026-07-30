import { act } from "@testing-library/react"
import { expect } from "vitest"

// 14 tools now render their tab panels through React.lazy. testing-library
// renders synchronously, so without waiting, a suite sees only the tab strip:
// measured on reference-hub, 64 nodes and 6 buttons instead of 797 and 61. an
// axe run against that passes vacuously, which is worse than no gate at all.
//
// waits until the node count stops changing, so it covers lazy chunks resolving
// and any effect that renders after them.
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
    // a lazy chunk can hold the count still for several ticks before it
    // resolves - network-tester measures [23,23,23,23,56,...] from cold - so one
    // repeat is not evidence the tree has settled, and neither is any count that
    // is still only the tab strip. keep waiting until all three are true.
    if (stable >= STABLE_TICKS && count > MIN_RENDERED_NODES && !pendingFallback(container)) {
      return count
    }
  }
  return previous
}

// a tool that renders almost nothing means the panel never resolved, and every
// assertion after it would be checking an empty shell. fail loudly instead.
export const MIN_RENDERED_NODES = 25

// how many consecutive identical tick counts count as quiet. two was enough for
// every tool measured warm, but a node floor of 25 is below the resting shell of
// 13 of the 48 tools - reference-hub's tab strip alone is 64 nodes - so on a
// slower machine two quiet ticks over a shell would satisfy the floor and the
// suite would scan the shell. the fallback check below is the property that
// actually closes that; this is the margin around it.
const STABLE_TICKS = 3

// every lazy tool renders its Suspense fallback as a local PanelFallback reading
// "Loading...", "Loading panel..." or "Loading table...". while any of those is
// on screen the tree is a shell by definition, whatever the node count says.
const PENDING_FALLBACK = /\bloading\b[a-z ]*\.\.\./i

export function pendingFallback(container: HTMLElement): boolean {
  return PENDING_FALLBACK.test(container.textContent ?? "")
}

// the shared post-render gate. every suite that scans a rendered tool has to
// prove it scanned the tool rather than the shell, and each one that grew its
// own copy of that check grew a different one: the 2.5.3 suite had none at all
// and scanned 6 of reference-hub's 61 buttons.
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
