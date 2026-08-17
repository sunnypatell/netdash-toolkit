import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// nothing else reads firestore.rules, so a tightened rule breaks a client call
// silently: projectShares once granted read to the recipient only, killing
// unsharing. the emulator needs a jre, so this asserts structure, not behaviour.

const RULES = readFileSync(join(process.cwd(), "firestore.rules"), "utf8")

function block(name: string): string {
  const start = RULES.indexOf(`match /${name}/`)
  expect(start, `no match block for ${name}`).toBeGreaterThan(-1)
  // the path segment has its own braces, so the block opens at the last one on the line
  const eol = RULES.indexOf("\n", start)
  const open = RULES.lastIndexOf("{", eol)
  let depth = 0
  for (let i = open; i < RULES.length; i++) {
    if (RULES[i] === "{") depth++
    if (RULES[i] === "}" && --depth === 0) return RULES.slice(start, i + 1)
  }
  throw new Error(`unbalanced braces in ${name}`)
}

function clause(source: string, verb: string): string {
  const line = new RegExp(`allow[^;]*\\b${verb}\\b[^;]*;`, "s").exec(source)
  expect(line, `${verb} is not granted at all`).not.toBeNull()
  return line![0]
}

describe("firestore.rules matches what the client actually queries", () => {
  it("parses the blocks the client uses", () => {
    // guards the helpers above: a typo'd name would make every assertion vacuous
    expect(block("projectShares")).toContain("allow")
    expect(block("userIndex")).toContain("allow")
  })

  it("lets the owner read their own share records", () => {
    // both owner-side callers filter by sharedWithUserId, and firestore denies a
    // query it cannot prove safe, so without this the whole query fails
    const read = clause(block("projectShares"), "read")
    expect(read).toContain("resource.data.ownerId == request.auth.uid")
  })

  it("still lets the recipient read the share that grants them access", () => {
    const read = clause(block("projectShares"), "read")
    expect(read).toContain("resource.data.sharedWithUserId == request.auth.uid")
  })

  it("lets the owner delete share records when the project goes", () => {
    // deleteAllSharesForProject runs as the owner on project delete
    const del = clause(block("projectShares"), "delete")
    expect(del).toContain("resource.data.ownerId == request.auth.uid")
  })

  it("keeps every projectShares grant behind auth", () => {
    const shares = block("projectShares")
    const grants = shares.match(/allow[^;]*;/gs) ?? []
    expect(grants.length, "no grants found, so the assertion below proves nothing").toBe(4)
    for (const grant of grants) {
      expect(grant, `an unauthenticated grant: ${grant}`).toContain("isAuthenticated()")
    }
  })

  it("lets only the owner create or delete a project", () => {
    const projects = block("projects")
    expect(clause(projects, "create")).toContain("isOwner(userId)")
    expect(clause(projects, "delete")).toContain("isOwner(userId)")
  })

  it("does not let a collaborator take over a project they can edit", () => {
    // an edit grant that does not pin ownerId lets a collaborator take the project
    const update = clause(block("projects"), "update")
    expect(update).toContain("request.resource.data.ownerId == resource.data.ownerId")
    expect(update).toContain("request.resource.data.sharedWith == resource.data.sharedWith")
  })

  it("keeps the profile doc to what the sharing ui renders", () => {
    // /users/{uid} is world-readable to signed-in users by design, so it stays
    // harmless only while nothing beyond a name and avatar is written there
    const written = /doc\(firestore, "users", user\.uid\)[\s\S]{0,400}?\)/.exec(
      readFileSync(join(process.cwd(), "contexts/project-context.tsx"), "utf8")
    )
    expect(written, "the profile write moved, so this assertion is stale").not.toBeNull()
    expect(written![0]).not.toContain("lastSeen")
    expect(written![0]).not.toContain("providerData")
  })
})
