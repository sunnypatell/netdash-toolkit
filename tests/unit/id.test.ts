import { describe, expect, it } from "vitest"
import { nextId, resetIdCounter } from "@/lib/id"

describe("nextId", () => {
  it("never repeats, even for calls inside the same millisecond", () => {
    resetIdCounter()
    const ids = Array.from({ length: 5000 }, () => nextId("acl"))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("keeps prefixes in their own readable namespace", () => {
    resetIdCounter()
    expect(nextId("acl")).toBe("acl-1")
    expect(nextId("vlsm")).toBe("vlsm-2")
  })

  it("produces ids that are valid html id attributes", () => {
    resetIdCounter()
    for (let i = 0; i < 20; i++) expect(nextId()).toMatch(/^[A-Za-z][\w-]*$/)
  })
})
