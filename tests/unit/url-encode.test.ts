import { describe, expect, it } from "vitest"
import {
  buildUrl,
  decodeUrlText,
  deserializeParams,
  encodeUrlText,
  serializeParams,
  splitUrl,
  URL_ENCODING_REFERENCE,
} from "@/lib/url-encode"

describe("encodeUrlText: the four encodings are not interchangeable", () => {
  const url = "https://ex.com/a b?q=1&r=x/y#f"

  it("encodeURIComponent escapes the reserved delimiters", () => {
    expect(encodeUrlText(url, "component").output).toBe(
      "https%3A%2F%2Fex.com%2Fa%20b%3Fq%3D1%26r%3Dx%2Fy%23f"
    )
  })

  it("encodeURI keeps the URL structure intact", () => {
    expect(encodeUrlText(url, "uri").output).toBe("https://ex.com/a%20b?q=1&r=x/y#f")
  })

  it("form-urlencoded writes a space as +, not %20", () => {
    expect(encodeUrlText("hello world", "form").output).toBe("hello+world")
    expect(encodeUrlText("hello world", "component").output).toBe("hello%20world")
  })

  it("form-urlencoded escapes a literal + so it does not read as a space", () => {
    expect(encodeUrlText("a+b", "form").output).toBe("a%2Bb")
  })
})

// ecma-262 19.2.6.5 leaves !'()* alone; the old table claimed the RFC 3986 escapes instead
describe("the sub-delims encodeURIComponent does not touch", () => {
  it.each(["!", "'", "(", ")", "*"])("leaves %s alone in component mode", (char) => {
    expect(encodeUrlText(char, "component").output).toBe(char)
  })

  it.each([
    ["!", "%21"],
    ["'", "%27"],
    ["(", "%28"],
    [")", "%29"],
    ["*", "%2A"],
  ])("escapes %s to %s in rfc3986 mode", (char, expected) => {
    expect(encodeUrlText(char, "rfc3986").output).toBe(expected)
  })

  it("rfc3986 mode still matches encodeURIComponent everywhere else", () => {
    expect(encodeUrlText("a/b?c=d&e", "rfc3986").output).toBe(encodeURIComponent("a/b?c=d&e"))
  })
})

describe("the reference table is generated, not typed out", () => {
  it("agrees with the platform for every row", () => {
    for (const row of URL_ENCODING_REFERENCE) {
      expect(row.component).toBe(encodeURIComponent(row.char))
      expect(row.uri).toBe(encodeURI(row.char))
    }
  })

  it("records the space row honestly in all four columns", () => {
    const space = URL_ENCODING_REFERENCE.find((row) => row.char === " ")
    expect(space).toMatchObject({ component: "%20", uri: "%20", form: "+", rfc3986: "%20" })
  })

  it("no longer claims ! encodes to %21 under encodeURIComponent", () => {
    const bang = URL_ENCODING_REFERENCE.find((row) => row.char === "!")
    expect(bang?.component).toBe("!")
    expect(bang?.form).toBe("%21")
    expect(bang?.rfc3986).toBe("%21")
  })

  it("shows a multi-byte character as its utf-8 octets", () => {
    const eacute = URL_ENCODING_REFERENCE.find((row) => row.char === "é")
    expect(eacute?.component).toBe("%C3%A9")
  })
})

describe("decodeUrlText", () => {
  it("restores + to a space only in form mode", () => {
    expect(decodeUrlText("a+b", "form").output).toBe("a b")
    expect(decodeUrlText("a+b", "component").output).toBe("a+b")
  })

  it("decodes percent-encoded utf-8", () => {
    expect(decodeUrlText("caf%C3%A9", "component").output).toBe("café")
    expect(decodeUrlText("%F0%9F%98%80", "component").output).toBe("😀")
  })

  it("decodeURI leaves the reserved delimiters encoded", () => {
    expect(decodeUrlText("a%2Fb%20c", "uri").output).toBe("a%2Fb c")
    expect(decodeUrlText("a%2Fb%20c", "component").output).toBe("a/b c")
  })

  it("reports a malformed sequence rather than throwing", () => {
    for (const mode of ["component", "form", "uri"] as const) {
      const result = decodeUrlText("%zz", mode)
      expect(result.output).toBe("")
      expect(result.error).toMatch(/two hex digits/)
    }
  })

  it("round-trips every mode", () => {
    const text = "a b&c=d/é😀+f"
    for (const mode of ["component", "form", "rfc3986"] as const) {
      expect(decodeUrlText(encodeUrlText(text, mode).output, mode).output).toBe(text)
    }
  })
})

describe("encoding a lone surrogate", () => {
  it("reports the URIError instead of crashing", () => {
    const result = encodeUrlText("\ud800", "component")
    expect(result.output).toBe("")
    expect(result.error).toMatch(/unpaired surrogate/)
  })
})

describe("buildUrl", () => {
  it("serialises query values as form-urlencoded, per the URL standard", () => {
    expect(buildUrl("https://ex.com/p", [{ key: "q", value: "hello world" }]).url).toBe(
      "https://ex.com/p?q=hello+world"
    )
  })

  it("skips blank keys", () => {
    expect(
      buildUrl("https://ex.com/p", [
        { key: "", value: "ignored" },
        { key: "a", value: "1" },
      ]).url
    ).toBe("https://ex.com/p?a=1")
  })

  it("rejects a relative base with a usable message", () => {
    const built = buildUrl("ex.com/p", [])
    expect(built.url).toBe("")
    expect(built.error).toMatch(/scheme/)
  })

  it("treats an empty base as nothing to do", () => {
    expect(buildUrl("", [])).toEqual({ url: "", error: null })
  })
})

describe("param round-tripping through the query string", () => {
  it("survives values containing & = and spaces", () => {
    const params = [
      { key: "q", value: "a&b=c d" },
      { key: "empty", value: "" },
    ]
    expect(deserializeParams(serializeParams(params))).toEqual(params)
  })

  it("splits an existing url into a base and its params", () => {
    expect(splitUrl("https://ex.com/a/b?x=1&y=hello+world")).toEqual({
      base: "https://ex.com/a/b",
      params: [
        { key: "x", value: "1" },
        { key: "y", value: "hello world" },
      ],
    })
  })

  it("returns null for something that is not a url", () => {
    expect(splitUrl("not a url")).toBeNull()
  })
})
