import { describe, expect, it } from "vitest"

// settle() is the gate every tool-scanning suite depends on, so a detector that
// stops matching would silently let all of them scan a shell. eight gates in
// this repo have already passed for the wrong reason; this one proves it fires
// before anything trusts a green.
import { pendingFallback } from "./settle"

function withText(text: string): HTMLElement {
  const el = document.createElement("div")
  el.textContent = text
  return el
}

describe("the fallback detector fires on every shape a shell is written in", () => {
  it.each([
    "Loading...",
    "Loading panel...",
    "Loading table...",
    "Loading Subnet Calculator",
    "loading",
    // textContent concatenates siblings, so a tab strip sitting beside a
    // fallback runs the two together. every PanelFallback opens with a space
    // for exactly this reason; these are the real concatenated strings.
    "Extended ACL Loading panel...",
    "Channel Planning Loading...",
  ])("catches %j", (text) => {
    expect(pendingFallback(withText(text))).toBe(true)
  })

  it("fires on a marked fallback whatever its wording says", () => {
    const el = document.createElement("div")
    el.innerHTML = `<div data-panel-fallback>one moment</div>`
    expect(pendingFallback(el)).toBe(true)
  })

  it("cannot see a fallback whose text runs straight into the tab before it", () => {
    // no boundary exists between ACL and Loading, so no regex can find one.
    // pinned so the leading space in every PanelFallback stays load-bearing,
    // and so the marker above is the thing new panels are held to.
    expect(pendingFallback(withText("Extended ACLLoading panel..."))).toBe(false)
  })

  it.each(["Downloading a file", "Reloading the page", "No results yet", "Payload size"])(
    "does not fire on %j",
    (text) => {
      expect(pendingFallback(withText(text))).toBe(false)
    }
  )
})
