import { describe, expect, it } from "vitest"
import { metadata as authActionMetadata } from "@/app/auth/action/layout"
import { MODE_TITLES } from "@/app/auth/action/titles"

// wcag 2.2 sc 2.4.2 page titled, level a:
// https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html
//
// every other route supplies a title through generateMetadata. /auth/action is a
// client component and cannot, so the title comes from a sibling layout, and the
// page narrows it per ?mode= at runtime because one route serves three purposes.
// both halves are asserted here: a layout that loses its export, or a mode that
// gains no title, silently returns the route to the generic site default.

const MODES = ["resetPassword", "verifyEmail", "recoverEmail"] as const

describe("2.4.2 page titled: /auth/action", () => {
  it("the layout supplies a title, since the page cannot", () => {
    const title = authActionMetadata.title
    expect(typeof title, "the title must be a plain string for the root template to wrap").toBe(
      "string"
    )
    expect(title as string).toMatch(/password|email/i)
    // the generic site default is what this exists to replace
    expect(title as string).not.toMatch(/^NetDash Toolkit$/)
  })

  it("is kept out of the index, because it is only reachable from an emailed link", () => {
    expect(authActionMetadata.robots).toMatchObject({ index: false })
  })

  it("names every mode the route serves, plus the invalid case", () => {
    for (const mode of MODES) {
      expect(MODE_TITLES[mode], `no title for ?mode=${mode}`).toBeTruthy()
    }
    expect(MODE_TITLES.invalid, "no title for a missing or unknown mode").toBeTruthy()
  })

  it("gives each mode a distinct title, or the route is still one title for three jobs", () => {
    const titles = [...MODES.map((m) => MODE_TITLES[m]), MODE_TITLES.invalid]
    expect(new Set(titles).size).toBe(titles.length)
  })
})
