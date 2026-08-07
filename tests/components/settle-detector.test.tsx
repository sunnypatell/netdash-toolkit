import { describe, expect, it } from "vitest"

// every tool-scanning suite leans on this detector, so prove it fires before trusting a green
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
    // textContent runs a tab strip into the fallback, so every PanelFallback opens with a space
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
    // no boundary between ACL and Loading, so the marker is what new panels are held to
    expect(pendingFallback(withText("Extended ACLLoading panel..."))).toBe(false)
  })

  it.each(["Downloading a file", "Reloading the page", "No results yet", "Payload size"])(
    "does not fire on %j",
    (text) => {
      expect(pendingFallback(withText(text))).toBe(false)
    }
  )
})
