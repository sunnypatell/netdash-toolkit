import { describe, expect, it } from "vitest"
import { metadata as authActionMetadata } from "@/app/auth/action/layout"
import { MODE_TITLES } from "@/app/auth/action/titles"

// /auth/action is a client component: the title comes from a sibling layout, narrowed per ?mode=

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
