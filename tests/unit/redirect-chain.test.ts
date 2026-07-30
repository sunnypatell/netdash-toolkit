import { describe, expect, it } from "vitest"
import { parseResponseBlocks } from "@/lib/http-header-parse"
import { buildRedirectChain } from "@/lib/redirect-chain"

const chain = (raw: string, start: string) => buildRedirectChain(parseResponseBlocks(raw), start)

describe("buildRedirectChain", () => {
  it("resolves every form of Location against the current hop (rfc 9110 10.2.2)", () => {
    const result = chain(
      [
        "HTTP/1.1 301 Moved Permanently",
        "location: https://example.com/a",
        "",
        "HTTP/1.1 302 Found",
        "location: /b",
        "",
        "HTTP/1.1 307 Temporary Redirect",
        "location: //other.example/c",
        "",
        "HTTP/2 200",
      ].join("\n"),
      "http://example.com"
    )
    expect(result.hops.map((h) => h.url)).toEqual([
      "http://example.com",
      "https://example.com/a",
      "https://example.com/b",
      "https://other.example/c",
    ])
    expect(result.finalUrl).toBe("https://other.example/c")
    expect(result.truncated).toBe(false)
    expect(result.isHttpsUpgrade).toBe(true)
  })

  it("detects an https upgrade when the scheme is uppercase (rfc 3986 3.1)", () => {
    const result = chain(
      ["HTTP/1.1 301 Moved Permanently", "location: https://example.com/", "", "HTTP/2 200"].join(
        "\n"
      ),
      "HTTP://EXAMPLE.COM"
    )
    expect(result.isHttpsUpgrade).toBe(true)
  })

  it("does not follow a 304, which is a cache validator and not a redirect", () => {
    const result = chain(
      ["HTTP/1.1 304 Not Modified", "location: https://example.com/elsewhere"].join("\n"),
      "https://example.com"
    )
    expect(result.hops).toHaveLength(1)
    expect(result.hops[0].resolved).toBeUndefined()
    expect(result.warnings.join(" ")).toMatch(/cache validator/)
  })

  it("flags an https to http downgrade", () => {
    const result = chain(
      ["HTTP/1.1 302 Found", "location: http://example.com/", "", "HTTP/1.1 200 OK"].join("\n"),
      "https://example.com"
    )
    expect(result.warnings.join(" ")).toMatch(/Downgrade at hop 1/)
  })

  it("reports a loop once and stops walking it", () => {
    const result = chain(
      [
        "HTTP/1.1 301 Moved Permanently",
        "location: https://example.com/b",
        "",
        "HTTP/1.1 301 Moved Permanently",
        "location: https://example.com/a",
        "",
        "HTTP/1.1 301 Moved Permanently",
        "location: https://example.com/b",
      ].join("\n"),
      "https://example.com/a"
    )
    const loops = result.warnings.filter((w) => w.includes("Redirect loop"))
    expect(loops).toHaveLength(1)
    expect(result.hops).toHaveLength(2)
  })

  it("says the destination is not final when the last block still redirects", () => {
    const result = chain(
      ["HTTP/1.1 301 Moved Permanently", "location: https://example.com/next"].join("\n"),
      "https://example.com"
    )
    expect(result.truncated).toBe(true)
    expect(result.warnings.join(" ")).toMatch(/not final/)
  })

  it("warns that 301, 302 and 303 rewrite a POST to GET (rfc 9110 15.4)", () => {
    const result = chain(
      ["HTTP/1.1 303 See Other", "location: /done", "", "HTTP/2 200"].join("\n"),
      "https://example.com/submit"
    )
    expect(result.warnings.join(" ")).toMatch(/rewrites a POST to GET/)
  })

  it("does not warn about method rewriting for 307 and 308", () => {
    const result = chain(
      ["HTTP/1.1 308 Permanent Redirect", "location: /done", "", "HTTP/2 200"].join("\n"),
      "https://example.com/submit"
    )
    expect(result.warnings.join(" ")).not.toMatch(/rewrites a POST/)
  })

  it("reports an unparsable Location instead of silently ending the chain", () => {
    const result = chain(
      ["HTTP/1.1 301 Moved Permanently", "location: http://[not a url"].join("\n"),
      "https://example.com"
    )
    expect(result.warnings.join(" ")).toMatch(/unparsable Location/)
  })

  it("flags a chain that ends on an error status", () => {
    const result = chain(
      ["HTTP/1.1 301 Moved Permanently", "location: /gone", "", "HTTP/1.1 410 Gone"].join("\n"),
      "https://example.com"
    )
    expect(result.warnings.join(" ")).toMatch(/ends on an error: 410 Gone/)
  })

  it("treats a 3xx with no Location as the end of the chain", () => {
    const result = chain("HTTP/1.1 300 Multiple Choices", "https://example.com")
    expect(result.hops).toHaveLength(1)
    expect(result.truncated).toBe(false)
  })
})
