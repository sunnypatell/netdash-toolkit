import { describe, expect, it } from "vitest"
import {
  classifyStatus,
  cleanQuery,
  detectQueryType,
  flattenEntities,
  normalizeStatus,
  parseJCard,
  parseRdapError,
  redactedFieldNames,
  selfLink,
  type RDAPEntity,
} from "@/lib/rdap"

describe("detectQueryType", () => {
  it("routes each query shape to its rdap path", () => {
    expect(detectQueryType("example.com")).toBe("domain")
    expect(detectQueryType("AS15169")).toBe("asn")
    expect(detectQueryType("15169")).toBe("asn")
    expect(detectQueryType("192.0.2.1")).toBe("ip")
    expect(detectQueryType("192.0.2.0/24")).toBe("ip")
    expect(detectQueryType("2001:db8::1")).toBe("ip")
  })
})

describe("cleanQuery", () => {
  it("reduces a url to the ldh name and strips the root dot", () => {
    expect(cleanQuery("https://Example.com/path?q=1", "domain")).toBe("example.com")
    expect(cleanQuery("example.com.", "domain")).toBe("example.com")
    expect(cleanQuery("AS15169", "asn")).toBe("15169")
  })
})

describe("classifyStatus (rfc 9083 10.2.2)", () => {
  it("does not read 'inactive' as active", () => {
    expect(classifyStatus("active")).toBe("positive")
    expect(classifyStatus("inactive")).toBe("negative")
  })

  it("does not read 'revoked' as ok", () => {
    expect(classifyStatus("revoked")).toBe("negative")
  })

  it("treats holds and pending delete as bad news", () => {
    expect(classifyStatus("client hold")).toBe("negative")
    expect(classifyStatus("server hold")).toBe("negative")
    expect(classifyStatus("pending delete")).toBe("negative")
    expect(classifyStatus("redemption period")).toBe("negative")
  })

  it("treats the epp-derived prohibitions as a warning, not a failure", () => {
    expect(classifyStatus("client transfer prohibited")).toBe("warning")
    expect(classifyStatus("server delete prohibited")).toBe("warning")
    expect(classifyStatus("locked")).toBe("warning")
  })

  it("accepts the epp camelCase spelling some servers still send", () => {
    expect(normalizeStatus("clientTransferProhibited")).toBe("client transfer prohibited")
    expect(classifyStatus("clientHold")).toBe("negative")
  })

  it("leaves an unknown status neutral rather than guessing", () => {
    expect(classifyStatus("something new")).toBe("neutral")
  })
})

describe("parseJCard (rfc 7095)", () => {
  const entity: RDAPEntity = {
    handle: "REG-1",
    roles: ["registrar"],
    vcardArray: [
      "vcard",
      [
        ["version", {}, "text", "4.0"],
        ["fn", {}, "text", "Example Registrar"],
        ["org", {}, "text", "Example Inc"],
        ["email", {}, "text", "abuse@example.com"],
        ["email", {}, "text", "support@example.com"],
        ["tel", { type: "voice" }, "uri", "tel:+1.5551234"],
        ["tel", { type: "fax" }, "uri", "tel:+1.5555678"],
        ["adr", {}, "text", ["", "", "1 Example St", "Springfield", "IL", "62701", "US"]],
      ],
    ],
  }

  it("keeps every email and phone instead of letting the last one win", () => {
    const contact = parseJCard(entity)
    expect(contact.emails).toEqual(["abuse@example.com", "support@example.com"])
    expect(contact.phones).toEqual(["tel:+1.5551234", "tel:+1.5555678"])
  })

  it("joins the seven adr components in order (rfc 6350 6.3.1)", () => {
    expect(parseJCard(entity).address).toBe("1 Example St, Springfield, IL, 62701, US")
  })

  it("survives an entity with no vcard at all", () => {
    const contact = parseJCard({ handle: "X" })
    expect(contact).toMatchObject({ handle: "X", emails: [], phones: [], roles: [] })
  })
})

describe("flattenEntities (rfc 9083 5.1)", () => {
  it("finds a contact nested inside another entity", () => {
    const contacts = flattenEntities([
      {
        handle: "REG",
        roles: ["registrar"],
        entities: [{ handle: "ABUSE", roles: ["abuse"] }],
      },
    ])
    expect(contacts.map((c) => c.handle)).toEqual(["REG", "ABUSE"])
    expect(contacts[1].depth).toBe(1)
  })

  it("stops recursing on a self-referential response instead of hanging", () => {
    const loop: RDAPEntity = { handle: "A" }
    loop.entities = [loop]
    expect(flattenEntities([loop]).length).toBeLessThanOrEqual(6)
  })
})

describe("parseRdapError (rfc 9083 6)", () => {
  it("does not claim a 404 means the object is unregistered", () => {
    const error = parseRdapError(404, null, "example.test")
    expect(error.noService).toBe(true)
    expect(error.message).toMatch(/publishes no RDAP service/)
  })

  it("uses the server's own title and description when it sends one", () => {
    const error = parseRdapError(
      404,
      { errorCode: 404, title: "Not found", description: ["no such domain"] },
      "x.com"
    )
    expect(error.message).toContain("Not found - no such domain")
  })

  it("passes other statuses through with the http code", () => {
    expect(parseRdapError(500, null, "x.com")).toMatchObject({ noService: false })
    expect(parseRdapError(429, null, "x.com").message).toMatch(/HTTP 429/)
  })
})

describe("response provenance", () => {
  it("surfaces the server that actually answered", () => {
    expect(
      selfLink([
        { rel: "related", href: "https://example.com" },
        { rel: "self", href: "https://rdap.verisign.com/com/v1/domain/EXAMPLE.COM" },
      ])
    ).toBe("https://rdap.verisign.com/com/v1/domain/EXAMPLE.COM")
    expect(selfLink(undefined)).toBeUndefined()
  })

  it("lists the fields a registry says it withheld (rfc 9537)", () => {
    expect(
      redactedFieldNames({
        ldhName: "example.com",
        redacted: [{ name: { description: "Registrant Name" } }, { name: { type: "tech email" } }],
      })
    ).toEqual(["Registrant Name", "tech email"])
  })
})
