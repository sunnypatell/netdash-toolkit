import { act } from "@testing-library/react"

// 14 tools now render their tab panels through React.lazy. testing-library
// renders synchronously, so without waiting, a suite sees only the tab strip:
// measured on reference-hub, 64 nodes and 6 buttons instead of 797 and 61. an
// axe run against that passes vacuously, which is worse than no gate at all.
//
// waits until the node count stops changing, so it covers lazy chunks resolving
// and any effect that renders after them.
export async function settle(container: HTMLElement, maxTicks = 25): Promise<number> {
  let previous = -1
  for (let i = 0; i < maxTicks; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    const count = container.querySelectorAll("*").length
    if (count === previous) return count
    previous = count
  }
  return previous
}

// a tool that renders almost nothing means the panel never resolved, and every
// assertion after it would be checking an empty shell. fail loudly instead.
export const MIN_RENDERED_NODES = 25
