import { describe, expect, it } from "vitest"
import {
  combinedFieldValue,
  describeStatus,
  fieldValues,
  firstFieldValue,
  isValidFieldName,
  parseResponseBlocks,
} from "@/lib/http-header-parse"

describe("parseResponseBlocks", () => {
  it("parses one block per status line, as curl -L prints a redirect chain", () => {
    const blocks = parseResponseBlocks(
      [
        "HTTP/1.1 301 Moved Permanently",
        "location: https://example.com/",
        "",
        "HTTP/2 200",
        "content-type: text/html; charset=utf-8",
      ].join("\n")
    )
    expect(blocks).toHaveLength(2)
    expect(blocks[0].status).toBe(301)
    expect(blocks[0].statusText).toBe("Moved Permanently")
    expect(blocks[1].httpVersion).toBe("2")
    expect(firstFieldValue(blocks[1], "Content-Type")).toBe("text/html; charset=utf-8")
  })

  it("tolerates a paste of bare field lines with no status line", () => {
    const blocks = parseResponseBlocks("server: nginx\nx-frame-options: DENY")
    expect(blocks).toHaveLength(1)
    expect(blocks[0].status).toBe(0)
    expect(describeStatus(blocks[0])).toBe("no status line")
    expect(blocks[0].fields).toHaveLength(2)
  })

  it("stops at the blank line that ends the header section (rfc 9112 2.1)", () => {
    // curl -i prints the body too, and body text with a colon is not a header
    const blocks = parseResponseBlocks(
      ["HTTP/1.1 200 OK", "content-type: text/html", "", "<p>Warning: not a header</p>"].join("\n")
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0].fields.map((f) => f.name)).toEqual(["content-type"])
  })

  it("replaces an obs-fold continuation with a space rather than dropping it", () => {
    const blocks = parseResponseBlocks(
      ["HTTP/1.1 200 OK", "content-security-policy: default-src 'self';", "  img-src *"].join("\n")
    )
    expect(firstFieldValue(blocks[0], "content-security-policy")).toBe(
      "default-src 'self'; img-src *"
    )
  })

  it("rejects a line whose field name is not a token (rfc 9110 5.1)", () => {
    const blocks = parseResponseBlocks(["HTTP/1.1 200 OK", "not a name: value"].join("\n"))
    expect(blocks[0].fields).toEqual([])
  })

  it("keeps a status line with no reason phrase", () => {
    const blocks = parseResponseBlocks("HTTP/2 204")
    expect(blocks[0].status).toBe(204)
    expect(describeStatus(blocks[0])).toBe("204")
  })

  it("keeps every repeated field line instead of collapsing to the last", () => {
    const blocks = parseResponseBlocks(
      [
        "HTTP/1.1 200 OK",
        "set-cookie: a=1; HttpOnly",
        "set-cookie: b=2; Secure",
        "strict-transport-security: max-age=0",
        "strict-transport-security: max-age=31536000",
      ].join("\n")
    )
    expect(fieldValues(blocks[0], "set-cookie")).toHaveLength(2)
    // rfc 6797 8.1 says process only the first, so the order has to survive
    expect(firstFieldValue(blocks[0], "strict-transport-security")).toBe("max-age=0")
    expect(combinedFieldValue(blocks[0], "strict-transport-security")).toBe(
      "max-age=0, max-age=31536000"
    )
  })

  it("matches field names case-insensitively (rfc 9110 5.1)", () => {
    const blocks = parseResponseBlocks("HTTP/1.1 200 OK\nX-Frame-Options: DENY")
    expect(firstFieldValue(blocks[0], "x-frame-options")).toBe("DENY")
  })
})

describe("isValidFieldName", () => {
  it("accepts tchar names and rejects everything else", () => {
    expect(isValidFieldName("x-custom_header.1")).toBe(true)
    expect(isValidFieldName("x custom")).toBe(false)
    expect(isValidFieldName("x:custom")).toBe(false)
    expect(isValidFieldName("")).toBe(false)
  })
})
